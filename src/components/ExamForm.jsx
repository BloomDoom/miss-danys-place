import { useState } from 'react'
import { LEVELS } from '../lib/exams.js'
import { saveErrorMessage } from '../lib/errors.js'

// Level, date and time of an exam. Used to create one (Exams) and to
// change it (the exam's screen). `onSave` gets { level, exam_date, exam_time }.
export default function ExamForm({ initial, submitLabel, onSave, onCancel }) {
  const [level, setLevel] = useState(initial.level || '')
  const [date, setDate] = useState(initial.exam_date || '')
  const [time, setTime] = useState(initial.exam_time?.slice(0, 5) || '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await onSave({ level, exam_date: date, exam_time: time || null })
    } catch (err) {
      setError(saveErrorMessage(err))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="slot-box">
      <label>
        Exam
        <select value={level} onChange={(e) => setLevel(e.target.value)} required>
          <option value="" disabled>Choose the exam</option>
          {LEVELS.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
      </label>
      <div className="slot-fields two-equal">
        <label>
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label>
          Time <span className="optional">(if known)</span>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="btn-row">
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>
      </div>
    </form>
  )
}
