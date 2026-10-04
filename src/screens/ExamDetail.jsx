import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { unwrap, useLoad } from '../lib/useLoad.js'
import { formatDay, formatTime } from '../lib/format.js'
import { RESULTS, examStudents, examYear } from '../lib/exams.js'
import { nameClass } from '../lib/students.js'
import { normalize } from '../lib/groups.js'
import { saveErrorMessage } from '../lib/errors.js'
import { useToast } from '../components/Toast.jsx'
import LoadState from '../components/LoadState.jsx'
import EmptyState from '../components/EmptyState.jsx'
import ExamForm from '../components/ExamForm.jsx'
import { useGoBack } from '../components/BackButton.jsx'

async function loadExam(id) {
  const [exam, students] = await Promise.all([
    unwrap(
      supabase
        .from('exams')
        .select('*, trinity_exams(id, result, deleted_at, students(id, name, sex, birth_date))')
        .eq('id', id)
        .single(),
    ),
    unwrap(supabase.from('students').select('id, name, sex').eq('active', true)),
  ])
  students.sort((a, b) => a.name.localeCompare(b.name, 'es'))
  return { exam, students }
}

// One exam (level, date, time) and the students sitting it.
export default function ExamDetail() {
  const { id } = useParams()
  const result = useLoad(() => loadExam(id), [id])
  const exam = result.data?.exam
  const goBack = useGoBack(exam ? `/exams?year=${examYear(exam)}` : '/exams')

  return (
    <main className="screen">
      <button className="back-link" onClick={goBack}>‹ Back</button>
      <LoadState {...result} />
      {exam && <ExamView exam={exam} allStudents={result.data.students} reload={result.reload} onRemoved={goBack} />}
    </main>
  )
}

function ExamView({ exam, allStudents, reload, onRemoved }) {
  const showToast = useToast()
  const [editing, setEditing] = useState(false)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const entries = examStudents(exam)
  const inExam = new Set(entries.map((t) => t.students.id))

  async function saveDetails(fields) {
    await unwrap(supabase.from('exams').update(fields).eq('id', exam.id))
    // Each student's row keeps a copy of the level and date (for backups).
    await unwrap(supabase.from('trinity_exams').update({ level: fields.level, exam_date: fields.exam_date }).eq('exam_id', exam.id))
    showToast('Exam saved')
    setEditing(false)
    reload()
  }

  async function remove() {
    const who = entries.length === 1 ? '1 student' : `${entries.length} students`
    if (!window.confirm(`Remove the ${exam.level} exam${entries.length ? ` and its ${who}` : ''}?`)) return
    try {
      const now = new Date().toISOString()
      await unwrap(supabase.from('trinity_exams').update({ deleted_at: now }).eq('exam_id', exam.id))
      await unwrap(supabase.from('exams').update({ deleted_at: now }).eq('id', exam.id))
      showToast('Exam removed')
      onRemoved()
    } catch (err) {
      setError(saveErrorMessage(err))
    }
  }

  return (
    <>
      <h1>{exam.level}</h1>
      <p className="exam-when">
        {formatDay(exam.exam_date)}
        {exam.exam_time && ` · ${formatTime(exam.exam_time)}`}
      </p>
      {editing ? (
        <ExamForm initial={exam} submitLabel="Save" onSave={saveDetails} onCancel={() => setEditing(false)} />
      ) : (
        <button className="btn-secondary" onClick={() => setEditing(true)}>Change exam, date or time</button>
      )}

      <section className="section">
        <h2>
          Students
          {entries.length > 0 && <span className="count-chip">{entries.length}</span>}
        </h2>

        {adding ? (
          <AddStudents
            exam={exam}
            students={allStudents.filter((s) => !inExam.has(s.id))}
            onDone={(added) => {
              setAdding(false)
              if (added) reload()
            }}
          />
        ) : (
          <button className="btn-primary" onClick={() => setAdding(true)}>+ Add students</button>
        )}

        {entries.length === 0 && !adding && (
          <EmptyState emoji="🙋" title="No students yet">Tap “Add students” and tick everyone sitting this exam.</EmptyState>
        )}

        <ul className="card-list">
          {entries.map((t) => (
            <li key={t.id}>
              <Link to={`/exams/entry/${t.id}`} className="card">
                <span className={`card-title ${nameClass(t.students)}`}>{t.students.name} ›</span>
                <span className="muted">
                  {t.result ? <strong className={`result-${t.result}`}>{RESULTS[t.result]}</strong> : 'Result: –'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {entries.length > 0 && (
        <section className="section">
          <Link to={`/exams/${exam.id}/message`} className="btn-secondary">💬 Message all parents</Link>
        </section>
      )}

      <section className="section">
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn-secondary" onClick={remove}>Remove this exam</button>
      </section>
    </>
  )
}

// Tick everyone sitting the exam, then one tap saves them all.
function AddStudents({ exam, students, onDone }) {
  const showToast = useToast()
  const [picked, setPicked] = useState(new Set())
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const shown = search ? students.filter((s) => normalize(s.name).includes(normalize(search))) : students

  function toggle(id) {
    const next = new Set(picked)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setPicked(next)
  }

  async function save() {
    setError('')
    setBusy(true)
    try {
      const rows = [...picked].map((studentId) => ({
        exam_id: exam.id,
        student_id: studentId,
        level: exam.level,
        exam_date: exam.exam_date,
      }))
      await unwrap(supabase.from('trinity_exams').insert(rows))
      showToast(rows.length === 1 ? '1 student added' : `${rows.length} students added`)
      onDone(true)
    } catch (err) {
      setError(saveErrorMessage(err))
      setBusy(false)
    }
  }

  return (
    <div className="slot-box">
      {students.length === 0 ? (
        <p>Every student is already in this exam.</p>
      ) : (
        <>
          <input type="search" placeholder="Search by name" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search by name" />
          <div className="pick-list">
            {shown.map((s) => (
              <label key={s.id} className="checkbox-row">
                <input type="checkbox" checked={picked.has(s.id)} onChange={() => toggle(s.id)} />
                <span className={nameClass(s)}>{s.name}</span>
              </label>
            ))}
            {shown.length === 0 && <p className="muted">No one called “{search.trim()}”.</p>}
          </div>
        </>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="btn-row">
        <button type="button" className="btn-secondary" onClick={() => onDone(false)}>Cancel</button>
        <button className="btn-primary" onClick={save} disabled={busy || picked.size === 0}>
          {busy ? 'Saving…' : picked.size === 0 ? 'Add' : picked.size === 1 ? 'Add 1 student' : `Add ${picked.size} students`}
        </button>
      </div>
    </div>
  )
}
