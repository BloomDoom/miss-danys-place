import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { unwrap, useLoad } from '../lib/useLoad.js'
import { formatDay, formatTime } from '../lib/format.js'
import { ensureSaved, loadSession, sessionPath, studentsOn, updateSession } from '../lib/sessions.js'
import { loadMakeupsFor, updateMakeup } from '../lib/makeups.js'
import { saveErrorMessage } from '../lib/errors.js'
import { useToast } from '../components/Toast.jsx'
import LoadState from '../components/LoadState.jsx'
import { useGoBack } from '../components/BackButton.jsx'

// Reached as /class/12 (a saved class) or /class/slot/5/2026-09-29 (a
// weekly class that hasn't been saved yet).
async function loadClass(params) {
  const session = await loadSession(params)
  const [enrollments, absences, makeups] = await Promise.all([
    unwrap(supabase.from('enrollments').select('start_date, end_date, students(id, name, active)').eq('group_id', session.group_id)),
    session.id ? unwrap(supabase.from('absences').select('*').eq('session_id', session.id).is('deleted_at', null)) : [],
    // Students from other classes coming here to make up an absence.
    // (Only saved classes can have make-ups booked into them.)
    session.id ? loadMakeupsFor(session.id) : [],
  ])
  const absentIds = new Set(absences.map((a) => a.student_id))
  return { session, absentIds, makeups, students: studentsOn(enrollments, session.date, absentIds) }
}

export default function ClassDetail() {
  const { id, slotId, date } = useParams()
  const result = useLoad(() => loadClass({ id, slotId, date }), [id, slotId, date])
  const session = result.data?.session
  // She can arrive from Today or from a group, so "Back" returns to the previous screen.
  const goBack = useGoBack(session ? `/?date=${session.date}` : '/')

  return (
    <main className="screen">
      <button className="back-link" onClick={goBack}>‹ Back</button>
      <LoadState {...result} />
      {result.data && (
        <>
          <h1>
            {session.group.name}
            {!session.slot_id && <span className="badge">Extra</span>}
          </h1>
          <p className="class-when">
            {formatDay(session.date)} · {formatTime(session.start_time)} · {session.duration_min} min
          </p>
          {session.original_date && session.original_date !== session.date && (
            <p className="muted">Moved from its usual day, {formatDay(session.original_date)}.</p>
          )}

          {session.cancelled ? (
            <p className="notice">This class is cancelled.</p>
          ) : (
            // key: start the list fresh from the database whenever the class or its saved attendance changes
            <Attendance key={`${session.id}_${session.attendance_saved_at}`} {...result.data} reload={result.reload} onSaved={goBack} />
          )}
          <ClassOptions session={session} reload={result.reload} />
        </>
      )}
    </main>
  )
}

function Attendance({ session, students, absentIds, makeups, reload, onSaved }) {
  const showToast = useToast()
  const [absent, setAbsent] = useState(new Set(absentIds))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Make-up students, by student id. Usually they're from another group
  // and get their own rows; if one is also in this group, their normal
  // row just gets the make-up label.
  const makeupFor = new Map(makeups.map((m) => [m.student_id, m]))
  const regularIds = new Set(students.map((s) => s.id))
  const makeupOnly = makeups.filter((m) => !regularIds.has(m.student_id)).map((m) => m.students)
  const everyone = [...students, ...makeupOnly]

  function toggle(studentId) {
    const next = new Set(absent)
    next.has(studentId) ? next.delete(studentId) : next.add(studentId)
    setAbsent(next)
  }

  async function save() {
    setError('')
    setBusy(true)
    try {
      const saved = await ensureSaved(session)
      // Absences only count for this group's own students.
      const added = [...absent].filter((id) => regularIds.has(id) && !absentIds.has(id))
      const removed = [...absentIds].filter((id) => !absent.has(id))
      if (added.length > 0) {
        // upsert: if this student was marked absent before and then
        // un-marked (deleted_at set), bring that row back as a new absence.
        await unwrap(
          supabase.from('absences').upsert(
            added.map((student_id) => ({
              session_id: saved.id, student_id, makeup_status: 'missed', makeup_session_id: null, deleted_at: null,
            })),
            { onConflict: 'session_id,student_id' },
          ),
        )
      }
      if (removed.length > 0) {
        // Never deleted, only marked as removed.
        await unwrap(
          supabase.from('absences').update({ deleted_at: new Date().toISOString() }).eq('session_id', saved.id).in('student_id', removed),
        )
      }
      // Make-up students: came → make-up done. Didn't come → still needs one.
      for (const m of makeups) {
        const came = !absent.has(m.student_id)
        if (came && m.makeup_status !== 'done') await updateMakeup(m.id, { makeup_status: 'done' })
        if (!came) await updateMakeup(m.id, { makeup_status: 'missed', makeup_session_id: null })
      }
      await unwrap(supabase.from('sessions').update({ attendance_saved_at: new Date().toISOString() }).eq('id', saved.id))
      showToast('Attendance saved')
      onSaved()
    } catch (err) {
      setError(saveErrorMessage(err))
      setBusy(false)
      reload()
    }
  }

  if (everyone.length === 0) {
    return <p className="empty">No students in this group on this day. Add students from the Students tab.</p>
  }

  const presentCount = everyone.length - absent.size
  return (
    <section className="section">
      <p>
        Everyone is marked <strong>present</strong>. Tap the students who were <strong>absent</strong>.
      </p>
      <ul className="roster">
        {everyone.map((s) => {
          const isAbsent = absent.has(s.id)
          const makeup = makeupFor.get(s.id)
          return (
            <li key={s.id}>
              <button className={`roster-row ${isAbsent ? 'absent' : ''}`} aria-pressed={isAbsent} onClick={() => toggle(s.id)}>
                <span className="roster-name">
                  {s.name}
                  {makeup && (
                    <span className="makeup-label">
                      Make-up · from {makeup.session.groups.name} ({formatDay(makeup.session.date)})
                    </span>
                  )}
                </span>
                <span className="roster-status">{isAbsent ? '✗ Absent' : '✓ Present'}</span>
              </button>
            </li>
          )
        })}
      </ul>

      <div className="save-bar">
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn-primary" onClick={save} disabled={busy}>
          {busy ? 'Saving…' : `Save · ${presentCount} present, ${absent.size} absent`}
        </button>
      </div>
    </section>
  )
}

function ClassOptions({ session, reload }) {
  const showToast = useToast()
  const navigate = useNavigate()
  const [moving, setMoving] = useState(false)
  const [newDate, setNewDate] = useState(session.date)
  const [newTime, setNewTime] = useState(formatTime(session.start_time))
  const [error, setError] = useState('')

  // Saves changes, then opens the class by its id: a class that was only
  // calculated before now has a saved row.
  async function change(changes, message, undoChanges) {
    setError('')
    try {
      const saved = await updateSession(session, changes)
      navigate(sessionPath(saved), { replace: true })
      reload()
      showToast(message, undoChanges && (() => change(undoChanges, 'Change undone')))
      return true
    } catch (err) {
      setError(saveErrorMessage(err))
      return false
    }
  }

  async function move(e) {
    e.preventDefault()
    const ok = await change(
      { date: newDate, start_time: newTime },
      `Class moved to ${formatDay(newDate)} at ${newTime}`,
      { date: session.date, start_time: session.start_time },
    )
    if (ok) setMoving(false)
  }

  return (
    <section className="section">
      <h2>Change this class only</h2>
      <p className="muted">The usual weekly schedule stays the same.</p>

      {session.cancelled ? (
        <button className="btn-secondary" onClick={() => change({ cancelled: false }, 'Class is back on')}>
          Un-cancel this class
        </button>
      ) : moving ? (
        <form onSubmit={move} className="slot-box">
          <div className="slot-fields two-equal">
            <label>
              New day
              <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} required />
            </label>
            <label>
              New time
              <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} required />
            </label>
          </div>
          <div className="btn-row">
            <button type="button" className="btn-secondary" onClick={() => setMoving(false)}>Cancel</button>
            <button className="btn-primary">Move class</button>
          </div>
        </form>
      ) : (
        <div className="stack">
          <button className="btn-secondary" onClick={() => setMoving(true)}>Move to another day or time</button>
          <button className="btn-secondary" onClick={() => change({ cancelled: true }, 'Class cancelled', { cancelled: false })}>
            Cancel this class
          </button>
        </div>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  )
}
