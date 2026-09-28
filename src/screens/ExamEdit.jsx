import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { unwrap, useLoad } from '../lib/useLoad.js'
import { formatDate } from '../lib/format.js'
import { LEVELS, RESULTS, examYear } from '../lib/exams.js'
import { ageOn } from '../lib/students.js'
import { saveErrorMessage } from '../lib/errors.js'
import { useToast } from '../components/Toast.jsx'
import LoadState from '../components/LoadState.jsx'
import { useGoBack } from '../components/BackButton.jsx'

function loadExam(id) {
  return unwrap(supabase.from('trinity_exams').select('*, students(id, name, birth_date)').eq('id', id).single())
}

// One exam, with big controls: level, date, and the result as buttons.
export default function ExamEdit() {
  const { id } = useParams()
  const result = useLoad(() => loadExam(id), [id])
  const exam = result.data
  const goBack = useGoBack(exam ? `/exams?year=${examYear(exam)}` : '/exams')

  return (
    <main className="screen">
      <button className="back-link" onClick={goBack}>‹ Back</button>
      <LoadState {...result} />
      {/* key: start the form fresh from the saved exam */}
      {exam && <ExamForm key={exam.id} exam={exam} onDone={goBack} />}
    </main>
  )
}

function ExamForm({ exam, onDone }) {
  const showToast = useToast()
  const [level, setLevel] = useState(exam.level || '')
  const [date, setDate] = useState(exam.exam_date || '')
  const [examResult, setExamResult] = useState(exam.result || '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const student = exam.students

  async function save(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await unwrap(
        supabase.from('trinity_exams').update({ level: level || null, exam_date: date || null, result: examResult || null }).eq('id', exam.id),
      )
      showToast('Exam saved')
      onDone()
    } catch (err) {
      setError(saveErrorMessage(err))
      setBusy(false)
    }
  }

  async function remove() {
    if (!window.confirm(`Remove ${student.name}’s exam?`)) return
    try {
      await unwrap(supabase.from('trinity_exams').update({ deleted_at: new Date().toISOString() }).eq('id', exam.id))
      showToast('Exam removed')
      onDone()
    } catch (err) {
      setError(saveErrorMessage(err))
    }
  }

  return (
    <form onSubmit={save}>
      <h1>{student.name}</h1>
      <p>
        {student.birth_date ? (
          `Born ${formatDate(student.birth_date)} (${ageOn(student.birth_date)} years old)`
        ) : (
          <>
            Birth date not saved. <Link to={`/students/${student.id}`}>Add it in the student’s details</Link>.
          </>
        )}
      </p>

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
        Exam date
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>

      <fieldset>
        <legend>Result</legend>
        <div className="result-options">
          {[['', 'No result yet'], ...Object.entries(RESULTS)].map(([key, label]) => (
            <button
              key={key || 'none'}
              type="button"
              className={`result-option ${examResult === key ? 'selected' : ''} ${key ? `result-${key}` : ''}`}
              aria-pressed={examResult === key}
              onClick={() => setExamResult(key)}
            >
              {examResult === key && '✓ '}
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>

      <section className="section">
        <button type="button" className="btn-secondary" onClick={remove}>Remove this exam</button>
      </section>
    </form>
  )
}
