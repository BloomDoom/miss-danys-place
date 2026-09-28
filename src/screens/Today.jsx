import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { unwrap, useLoad } from '../lib/useLoad.js'
import { addDays, formatDate, formatDay, formatTime, isoWeekday, todayISO, weekdayName } from '../lib/format.js'
import { loadSessions, sessionPath, studentsOn, updateSession } from '../lib/sessions.js'
import { saveErrorMessage } from '../lib/errors.js'
import { useToast } from '../components/Toast.jsx'
import LoadState from '../components/LoadState.jsx'

async function loadDay(date) {
  const sessions = await loadSessions(date, date)
  const groupIds = [...new Set(sessions.map((s) => s.group_id))]
  const savedIds = sessions.filter((s) => s.id).map((s) => s.id)
  const [enrollments, absences] = await Promise.all([
    groupIds.length
      ? unwrap(supabase.from('enrollments').select('group_id, start_date, end_date, students(id, name, active)').in('group_id', groupIds))
      : [],
    savedIds.length
      ? unwrap(supabase.from('absences').select('session_id').in('session_id', savedIds).is('deleted_at', null))
      : [],
  ])
  return sessions.map((s) => ({
    ...s,
    studentCount: studentsOn(enrollments.filter((e) => e.group_id === s.group_id), s.date).length,
    absentCount: absences.filter((a) => a.session_id === s.id).length,
  }))
}

// The day's name for the big title.
function dayTitle(date) {
  const today = todayISO()
  if (date === today) return 'Today'
  if (date === addDays(today, 1)) return 'Tomorrow'
  if (date === addDays(today, -1)) return 'Yesterday'
  return weekdayName(isoWeekday(date))
}

export default function Today() {
  // The day being shown lives in the URL (/?date=2026-09-29), so coming
  // back from a class returns to the same day.
  const [params, setParams] = useSearchParams()
  const date = params.get('date') || todayISO()
  const goTo = (newDate) => setParams(newDate === todayISO() ? {} : { date: newDate }, { replace: true })

  const result = useLoad(() => loadDay(date), [date])
  const sessions = result.data

  return (
    <main className="screen">
      <header className="day-nav">
        <button className="btn-icon" onClick={() => goTo(addDays(date, -1))} aria-label="Previous day">‹</button>
        <div>
          <h1>{dayTitle(date)}</h1>
          <p className="muted">{weekdayName(isoWeekday(date))} {formatDate(date)}</p>
        </div>
        <button className="btn-icon" onClick={() => goTo(addDays(date, 1))} aria-label="Next day">›</button>
      </header>
      {date !== todayISO() && (
        <button className="btn-secondary" onClick={() => goTo(todayISO())}>Back to today</button>
      )}

      <LoadState {...result} />

      {sessions && (
        <>
          {sessions.length === 0 ? (
            <p className="empty">No classes on this day. Use the arrows to see other days.</p>
          ) : (
            <ul className="card-list">
              {sessions.map((s) => (
                <li key={`${s.id ?? 'slot' + s.slot_id}_${s.date}`}>
                  <SessionCard session={s} />
                </li>
              ))}
            </ul>
          )}

          <Link to={`/class/new?date=${date}`} className="btn-secondary">+ Add extra class</Link>
          <CancelDay sessions={sessions} reload={result.reload} />
        </>
      )}
    </main>
  )
}

function SessionCard({ session: s }) {
  let status = null
  if (s.movedAway) status = <span className="status muted">Moved to {formatDay(s.movedAway.date)} at {formatTime(s.movedAway.start_time)}</span>
  else if (s.cancelled) status = <span className="status status-cancelled">Cancelled</span>
  else if (s.attendance_saved_at) {
    status = (
      <span className="status status-done">
        ✓ Attendance saved{s.absentCount > 0 && ` · ${s.absentCount} absent`}
      </span>
    )
  }

  const dimmed = s.cancelled || s.movedAway
  return (
    <Link to={sessionPath(s)} className={`card session-card ${dimmed ? 'dimmed' : ''}`}>
      <span className="session-time">{formatTime(s.start_time)}</span>
      <span className="session-info">
        <span className="card-title">
          {s.group.name}
          {!s.slot_id && <span className="badge">Extra</span>}
        </span>
        <span className="muted">{s.studentCount === 1 ? '1 student' : `${s.studentCount} students`}</span>
        {status}
      </span>
    </Link>
  )
}

// For holidays: cancel every class of the day in one tap (with Undo).
function CancelDay({ sessions, reload }) {
  const showToast = useToast()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const toCancel = sessions.filter((s) => !s.cancelled && !s.movedAway)
  if (toCancel.length < 2) return null // for one class, use the class screen

  // Returns the saved rows (with ids), or null if it failed.
  async function setCancelled(list, cancelled) {
    setError('')
    setBusy(true)
    try {
      const saved = []
      for (const s of list) saved.push(await updateSession(s, { cancelled }))
      return saved
    } catch (err) {
      setError(saveErrorMessage(err))
      return null
    } finally {
      setBusy(false)
      reload()
    }
  }

  async function cancelAll() {
    const saved = await setCancelled(toCancel, true)
    if (saved) showToast(`${saved.length} classes cancelled`, () => setCancelled(saved, false))
  }

  return (
    <section className="section">
      <button className="btn-secondary" onClick={cancelAll} disabled={busy}>
        {busy ? 'Cancelling…' : 'Cancel all classes this day'}
      </button>
      <p className="muted">For holidays. You can undo it right after.</p>
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  )
}
