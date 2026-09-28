import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { unwrap, useLoad } from '../lib/useLoad.js'
import { formatDate, todayISO } from '../lib/format.js'
import { LEVELS, RESULTS, examYear, groupByLevel } from '../lib/exams.js'
import { saveErrorMessage } from '../lib/errors.js'
import { useToast } from '../components/Toast.jsx'
import LoadState from '../components/LoadState.jsx'

async function loadExams() {
  const [exams, students] = await Promise.all([
    unwrap(supabase.from('trinity_exams').select('*, students(id, name, birth_date)').is('deleted_at', null)),
    unwrap(supabase.from('students').select('id, name').eq('active', true)),
  ])
  students.sort((a, b) => a.name.localeCompare(b.name, 'es'))
  return { exams, students }
}

export default function Exams() {
  // The year lives in the URL (/exams?year=2025) so coming back from an
  // exam returns to the same year.
  const [params, setParams] = useSearchParams()
  const thisYear = Number(todayISO().slice(0, 4))
  const year = Number(params.get('year')) || thisYear
  const goTo = (y) => setParams(y === thisYear ? {} : { year: String(y) }, { replace: true })

  const result = useLoad(loadExams, [])
  const [adding, setAdding] = useState(false)

  const exams = result.data?.exams.filter((e) => examYear(e) === year) ?? []
  // Everyone sits in the same week, so a new exam starts with the date
  // already used this year (the most common one).
  const usualDate = mostCommon(exams.map((e) => e.exam_date).filter(Boolean))

  return (
    <main className="screen">
      <header className="day-nav">
        <button className="btn-icon" onClick={() => goTo(year - 1)} aria-label="Previous year">‹</button>
        <div>
          <h1>Trinity exams</h1>
          <p className="muted">{year}</p>
        </div>
        <button className="btn-icon" onClick={() => goTo(year + 1)} aria-label="Next year" disabled={year > thisYear}>›</button>
      </header>
      <LoadState {...result} />

      {result.data && (
        <>
          {adding ? (
            <AddExam
              students={result.data.students}
              defaultDate={usualDate || ''}
              onDone={() => {
                setAdding(false)
                result.reload()
              }}
            />
          ) : (
            <button className="btn-primary" onClick={() => setAdding(true)}>+ Add exam</button>
          )}

          {exams.length === 0 && !adding && (
            <p className="empty">No exams in {year}. Tap “Add exam” for each student who will sit the Trinity exam.</p>
          )}

          {groupByLevel(exams).map(([level, list]) => (
            <section key={level ?? 'none'} className="section">
              <h2>
                {level ?? 'No level yet'} <span className="muted">· {list.length === 1 ? '1 student' : `${list.length} students`}</span>
              </h2>
              <ul className="card-list">
                {list.map((exam) => (
                  <li key={exam.id}>
                    <Link to={`/exams/${exam.id}`} className="card">
                      <span className="card-title">{exam.students.name} ›</span>
                      <span>{exam.exam_date ? formatDate(exam.exam_date) : 'No exam date yet'}</span>
                      <span className="muted">
                        {exam.students.birth_date ? `Born ${formatDate(exam.students.birth_date)}` : 'Birth date not saved'}
                        {' · '}
                        {exam.result ? (
                          <strong className={`result-${exam.result}`}>{RESULTS[exam.result]}</strong>
                        ) : (
                          'Result: –'
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </main>
  )
}

function mostCommon(values) {
  const counts = {}
  for (const v of values) counts[v] = (counts[v] || 0) + 1
  return Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || null
}

function AddExam({ students, defaultDate, onDone }) {
  const showToast = useToast()
  const [studentId, setStudentId] = useState('')
  const [level, setLevel] = useState('')
  const [date, setDate] = useState(defaultDate)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

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
      <p className="muted">The name and birth date come from the student’s details. Add the result later by tapping the exam.</p>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="btn-row">
        <button type="button" className="btn-secondary" onClick={onDone}>Cancel</button>
        <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Add exam'}</button>
      </div>
    </form>
  )
}
