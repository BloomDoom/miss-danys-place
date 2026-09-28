import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLoad } from '../lib/useLoad.js'
import { addDays, formatDay, formatTime, todayISO } from '../lib/format.js'
import { ensureSaved, loadSessions } from '../lib/sessions.js'
import { makeupState, updateMakeup } from '../lib/makeups.js'
import { saveErrorMessage } from '../lib/errors.js'
import { useToast } from './Toast.jsx'
import LoadState from './LoadState.jsx'

// One absence and what to do about its make-up.
// `absence` comes from lib/makeups.js. showStudent = show the student's
// name (on the Make-ups list; not needed on the student's own screen).
export default function MakeupCard({ absence: a, showStudent, onChanged }) {
  const showToast = useToast()
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState('')
  const state = makeupState(a)
  const name = a.students.name

  // Saves new make-up fields, with Undo back to how it was.
  async function change(changes, message) {
    setError('')
    const before = { makeup_status: a.makeup_status, makeup_session_id: a.makeup_session_id }
    try {
      await updateMakeup(a.id, changes)
      setPicking(false)
      onChanged()
      showToast(message, async () => {
        try {
          await updateMakeup(a.id, before)
          onChanged()
        } catch (err) {
          showToast(saveErrorMessage(err))
        }
      })
    } catch (err) {
      setError(saveErrorMessage(err))
    }
  }

  async function schedule(session) {
    setError('')
    try {
      const saved = await ensureSaved(session) // the make-up class needs a saved row to point at
      await change(
        { makeup_status: 'scheduled', makeup_session_id: saved.id },
        `Make-up on ${formatDay(session.date)} at ${formatTime(session.start_time)}`,
      )
    } catch (err) {
      setError(saveErrorMessage(err))
    }
  }

  const missed = `Missed ${a.session.groups.name} on ${formatDay(a.session.date)}`
  const makeupText = a.makeup && `${formatDay(a.makeup.date)} at ${formatTime(a.makeup.start_time)} · ${a.makeup.groups.name}`
  const toMissed = { makeup_status: 'missed', makeup_session_id: null }

  return (
    <div className={`card makeup-card makeup-${state}`}>
      {showStudent ? (
        <Link to={`/students/${a.students.id}`} className="charge-name">
          <span className="card-title">{name} ›</span>
          <span className="muted">{missed}</span>
        </Link>
      ) : (
        <span className="card-title">{missed}</span>
      )}

      {state === 'scheduled' && <p className="makeup-line">Make-up: <strong>{makeupText}</strong></p>}
      {state === 'check' && <p className="makeup-line">Did {name} come to the make-up on <strong>{makeupText}</strong>?</p>}
      {state === 'cancelled' && <p className="makeup-line error">The make-up class was cancelled. Pick another one.</p>}
      {state === 'done' && <p className="makeup-line success">✓ Made up on {makeupText}</p>}
      {state === 'waived' && <p className="makeup-line muted">No make-up needed</p>}

      {picking ? (
        <ClassPicker absence={a} onPick={schedule} onCancel={() => setPicking(false)} />
      ) : (
        <div className="stack">
          {(state === 'missed' || state === 'cancelled') && (
            <button className="btn-primary" onClick={() => setPicking(true)}>Schedule make-up</button>
          )}
          {state === 'missed' && (
            <button className="btn-secondary" onClick={() => change({ makeup_status: 'waived' }, 'No make-up needed')}>
              No make-up needed
            </button>
          )}
          {state === 'check' && (
            <div className="btn-row">
              <button className="btn-primary" onClick={() => change({ makeup_status: 'done' }, 'Make-up done')}>Yes, came</button>
              <button className="btn-secondary" onClick={() => change(toMissed, 'Make-up still needed')}>No</button>
            </div>
          )}
          {state === 'scheduled' && (
            <div className="btn-row">
              <button className="btn-secondary" onClick={() => setPicking(true)}>Change</button>
              <button className="btn-secondary" onClick={() => change(toMissed, 'Make-up cancelled')}>Cancel make-up</button>
            </div>
          )}
          {state === 'waived' && (
            <button className="btn-secondary" onClick={() => change(toMissed, 'Make-up needed again')}>Needs a make-up after all</button>
          )}
        </div>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  )
}

// The next 2 weeks of classes, from every group, grouped by day.
function ClassPicker({ absence, onPick, onCancel }) {
  const today = todayISO()
  const result = useLoad(() => loadSessions(today, addDays(today, 13)), [today])
  // Hide cancelled classes, the class they missed, and the make-up already booked.
  // (Calculated classes have id null, so only compare saved ids.)
  const isSame = (s, id) => s.id !== null && s.id === id
  const options = result.data?.filter(
    (s) => !s.cancelled && !s.movedAway && !isSame(s, absence.session.id) && !isSame(s, absence.makeup_session_id),
  )
  const days = [...new Set(options?.map((s) => s.date))]

  return (
    <div className="picker">
      <p className="pay-question">Which class will {absence.students.name} come to?</p>
      <LoadState {...result} />
      {options?.length === 0 && <p className="empty">No classes in the next 2 weeks.</p>}
      {days.map((day) => (
        <div key={day}>
          <h3 className="picker-day">{formatDay(day)}</h3>
          {options
            .filter((s) => s.date === day)
            .map((s) => (
              <button key={`${s.id ?? 'slot' + s.slot_id}_${s.date}`} className="picker-option" onClick={() => onPick(s)}>
                <strong>{formatTime(s.start_time)}</strong> {s.group.name}
                {s.group_id === absence.session.group_id && <span className="muted"> (own group)</span>}
              </button>
            ))}
        </div>
      ))}
      <button className="btn-text btn-cancel" onClick={onCancel}>Cancel</button>
    </div>
  )
}
