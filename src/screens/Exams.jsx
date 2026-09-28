import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { unwrap, useLoad } from '../lib/useLoad.js'
import { formatDate, todayISO } from '../lib/format.js'
import { saveErrorMessage } from '../lib/errors.js'
import { useToast } from '../components/Toast.jsx'
import LoadState from '../components/LoadState.jsx'

// Trinity College London exam levels: GESE Grades 1–12 and ISE.
const LEVELS = [
  ...Array.from({ length: 12 }, (_, i) => `GESE Grade ${i + 1}`),
  'ISE Foundation', 'ISE I', 'ISE II', 'ISE III', 'ISE IV',
]

// How Trinity reports results. Empty = no result yet.
const RESULTS = { fail: 'Fail', pass: 'Pass', merit: 'Merit', distinction: 'Distinction' }

async function loadExams() {
  const [exams, students] = await Promise.all([
    unwrap(supabase.from('trinity_exams').select('*, students(id, name, birth_date)').is('deleted_at', null)),
    unwrap(supabase.from('students').select('id, name').eq('active', true)),
  ])
  students.sort((a, b) => a.name.localeCompare(b.name, 'es'))
  return { exams, students }
}

export default function Exams() {
  const result = useLoad(loadExams, [])
  const [adding, setAdding] = useState(false)
  const today = todayISO()

  // Upcoming (or no date yet) first, soonest first; then past, newest first.
  const exams = result.data?.exams ?? []
  const upcoming = exams
    .filter((e) => !e.exam_date || e.exam_date >= today)
    .sort((a, b) => (a.exam_date || '9999').localeCompare(b.exam_date || '9999') || a.students.name.localeCompare(b.students.name, 'es'))
  const past = exams.filter((e) => e.exam_date && e.exam_date < today).sort((a, b) => b.exam_date.localeCompare(a.exam_date))

  return (
    <main className="screen">
      <h1>Trinity exams</h1>
      <LoadState {...result} />

      {result.data && (
        <>
          {adding ? (
            <AddExam
              students={result.data.students}
              onDone={() => {
                setAdding(false)
                result.reload()
              }}
            />
          ) : (
            <button className="btn-primary" onClick={() => setAdding(true)}>+ Add exam</button>
          )}

          {exams.length === 0 && !adding && (
            <p className="empty">No exams yet. Tap “Add exam” when a student signs up for a Trinity exam.</p>
          )}
          {upcoming.length > 0 && <ExamTable title={`Upcoming (${upcoming.length})`} exams={upcoming} reload={result.reload} />}
          {past.length > 0 && <ExamTable title={`Past (${past.length})`} exams={past} reload={result.reload} />}
        </>
      )}
    </main>
  )
}

function AddExam({ students, onDone }) {
  const [studentId, setStudentId] = useState('')
  const [level, setLevel] = useState('')
  const [date, setDate] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const showToast = useToast()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await unwrap(
        supabase.from('trinity_exams').insert({ student_id: Number(studentId), level: level || null, exam_date: date || null }),
      )
      showToast('Exam added')
      onDone()
    } catch (err) {
      setError(saveErrorMessage(err))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="slot-box">
      <label>
        Student
        <select value={studentId} onChange={(e) => setStudentId(e.target.value)} required>
          <option value="" disabled>Choose a student</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </label>
      <label>
        Exam level
        <select value={level} onChange={(e) => setLevel(e.target.value)}>
          <option value="">Not decided yet</option>
          {LEVELS.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
      </label>
      <label>
        Exam date <span className="optional">(if known)</span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <p className="muted">The name and birth date come from the student’s details. The result is added later, in the table.</p>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="btn-row">
        <button type="button" className="btn-secondary" onClick={onDone}>Cancel</button>
        <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Add exam'}</button>
      </div>
    </form>
  )
}

// The 5-column grid. Level, date and result are edited right in the table
// and saved as soon as they change. On a narrow screen the table scrolls
// sideways while the name column stays in place.
function ExamTable({ title, exams, reload }) {
  const showToast = useToast()

  async function change(exam, field, value) {
    try {
      await unwrap(supabase.from('trinity_exams').update({ [field]: value || null }).eq('id', exam.id))
      showToast('Saved')
      reload()
    } catch (err) {
      showToast(saveErrorMessage(err))
    }
  }

  async function remove(exam) {
    if (!window.confirm(`Remove ${exam.students.name}’s exam${exam.level ? ` (${exam.level})` : ''}?`)) return
    try {
      await unwrap(supabase.from('trinity_exams').update({ deleted_at: new Date().toISOString() }).eq('id', exam.id))
      showToast('Exam removed')
      reload()
    } catch (err) {
      showToast(saveErrorMessage(err))
    }
  }

  return (
    <section className="section">
      <h2>{title}</h2>
      <div className="table-scroll">
        <table className="exam-table">
          <thead>
            <tr>
              <th scope="col">Student</th>
              <th scope="col">Birth date</th>
              <th scope="col">Level</th>
              <th scope="col">Exam date</th>
              <th scope="col">Result</th>
            </tr>
          </thead>
          <tbody>
            {exams.map((exam) => (
              <tr key={exam.id}>
                <th scope="row">
                  <Link to={`/students/${exam.students.id}`}>{exam.students.name}</Link>
                  <button className="btn-text btn-remove" onClick={() => remove(exam)} aria-label={`Remove ${exam.students.name}’s exam`}>
                    Remove
                  </button>
                </th>
                <td>{exam.students.birth_date ? formatDate(exam.students.birth_date) : <span className="muted">Not saved</span>}</td>
                <td>
                  <select value={exam.level || ''} onChange={(e) => change(exam, 'level', e.target.value)} aria-label="Exam level">
                    <option value="">–</option>
                    {LEVELS.map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <input type="date" value={exam.exam_date || ''} onChange={(e) => change(exam, 'exam_date', e.target.value)} aria-label="Exam date" />
                </td>
                <td>
                  <select
                    value={exam.result || ''}
                    onChange={(e) => change(exam, 'result', e.target.value)}
                    aria-label="Result"
                    className={exam.result ? `result-${exam.result}` : ''}
                  >
                    <option value="">–</option>
                    {Object.entries(RESULTS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
