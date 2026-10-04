import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { unwrap, useLoad } from '../lib/useLoad.js'
import { addDays, formatDay, formatDuration, formatTime, todayISO, weekdayName } from '../lib/format.js'
import { loadSessions, sessionPath } from '../lib/sessions.js'
import { activeSlots, currentEnrollments } from '../lib/groups.js'
import { saveErrorMessage } from '../lib/errors.js'
import { useToast } from '../components/Toast.jsx'
import { nameClass } from '../lib/students.js'
import LoadState from '../components/LoadState.jsx'
import EmptyState from '../components/EmptyState.jsx'
import SlotFields, { NEW_SLOT, slotRows } from '../components/SlotFields.jsx'

function loadGroup(id) {
  return unwrap(
    supabase
      .from('groups')
      .select('*, group_slots(*), enrollments(id, end_date, students(id, name, sex, active))')
      .eq('id', id)
      .single(),
  )
}

export default function GroupDetail() {
  const { id } = useParams()
  const result = useLoad(() => loadGroup(id), [id])
  const group = result.data

  return (
    <main className="screen">
      <Link to="/groups" className="back-link">‹ Groups</Link>
      <LoadState {...result} />
      {group && (
        <>
          <h1>
            {group.name}
            {!group.active && <span className="badge">Inactive</span>}
          </h1>
          <ClassTimes group={group} reload={result.reload} />
          {group.active && <NextClasses group={group} />}
          <Students group={group} />
          <Details group={group} reload={result.reload} />
          <Deactivate group={group} reload={result.reload} />
        </>
      )}
    </main>
  )
}

// Runs a save, shows the error or a toast, then reloads the screen data.
// Returns true if it worked.
async function save(action, { reload, showToast, message, onUndo, setError }) {
  try {
    await action()
    reload()
    if (message) showToast(message, onUndo)
    return true
  } catch (err) {
    setError(saveErrorMessage(err))
    return false
  }
}

function ClassTimes({ group, reload }) {
  const showToast = useToast()
  const [adding, setAdding] = useState(false)
  const [newSlot, setNewSlot] = useState(NEW_SLOT)
  const [error, setError] = useState('')
  const slots = activeSlots(group.group_slots)

  // Removing only switches the time off (active = false), so Undo can
  // switch it back on, and past classes keep their link to it.
  const setActive = (slot, active) => unwrap(supabase.from('group_slots').update({ active }).eq('id', slot.id))

  function remove(slot) {
    setError('')
    save(() => setActive(slot, false), {
      reload, showToast, setError,
      message: `${weekdayName(slot.weekday)} ${formatTime(slot.start_time)} removed`,
      onUndo: () => save(() => setActive(slot, true), { reload, showToast, setError }),
    })
  }

  async function add(e) {
    e.preventDefault()
    setError('')
    if (newSlot.weekdays.length === 0) return setError('Pick at least one day.')
    const ok = await save(
      () => unwrap(supabase.from('group_slots').insert(slotRows(newSlot, group.id))),
      { reload, showToast, setError, message: newSlot.weekdays.length > 1 ? 'Class times added' : 'Class time added' },
    )
    if (ok) {
      setAdding(false)
      setNewSlot(NEW_SLOT)
    }
  }

  return (
    <section className="section">
      <h2>Class times</h2>
      {slots.length === 0 && <p className="empty">No class times yet. Add the day and time this group meets.</p>}
      <ul className="row-list">
        {slots.map((slot) => (
          <li key={slot.id}>
            <span>
              <strong>{weekdayName(slot.weekday)} {formatTime(slot.start_time)}</strong>
              <span className="muted"> · {formatDuration(slot.duration_min)}</span>
            </span>
            <button className="btn-text" onClick={() => remove(slot)}>Remove</button>
          </li>
        ))}
      </ul>

      {adding ? (
        <form onSubmit={add} className="slot-box">
          <SlotFields slot={newSlot} onChange={setNewSlot} />
          <div className="btn-row">
            <button type="button" className="btn-secondary" onClick={() => setAdding(false)}>Cancel</button>
            <button className="btn-primary">Save</button>
          </div>
        </form>
      ) : (
        <button className="btn-secondary" onClick={() => setAdding(true)}>+ Add a class time</button>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  )
}

// The group's classes for the next 3 weeks. Tap one to cancel or move it
// (e.g. for a holiday), without changing the weekly schedule.
function NextClasses({ group }) {
  const today = todayISO()
  // group_slots is a dependency so the list updates after adding/removing a time.
  const result = useLoad(() => loadSessions(today, addDays(today, 20), group.id), [group.id, group.group_slots])
  const sessions = result.data?.filter((s) => !s.movedAway)

  return (
    <section className="section">
      <h2>Next classes</h2>
      <LoadState {...result} />
      {sessions && sessions.length === 0 && <p className="empty">No classes in the next 3 weeks.</p>}
      {sessions && (
        <ul className="row-list">
          {sessions.map((s) => (
            <li key={`${s.id ?? 'slot' + s.slot_id}_${s.date}`}>
              <Link to={sessionPath(s)} className={`row-link ${s.cancelled ? 'dimmed' : ''}`}>
                {formatDay(s.date)} · {formatTime(s.start_time)}
                {s.cancelled && ' · Cancelled'}
                {!s.slot_id && ' · Extra'}
                {s.original_date && s.original_date !== s.date && ' · Moved'}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link to={`/class/new?group=${group.id}`} className="btn-secondary">+ Add extra class</Link>
    </section>
  )
}

function Students({ group }) {
  const students = currentEnrollments(group.enrollments)
    .map((e) => e.students)
    .filter((s) => s.active)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))

  return (
    <section className="section">
      <h2>Students ({students.length})</h2>
      {students.length === 0 && <EmptyState emoji="👋" title="No students in this group yet" />}
      <ul className="row-list">
        {students.map((s) => (
          <li key={s.id}>
            <Link to={`/students/${s.id}`} className="row-link"><span className={nameClass(s)}>{s.name}</span> ›</Link>
          </li>
        ))}
      </ul>
      {students.length > 0 && (
        <Link to={`/groups/${group.id}/message`} className="btn-primary">Message this group</Link>
      )}
      <Link to={`/students/new?group=${group.id}`} className="btn-secondary">+ Add students to this group</Link>
    </section>
  )
}

function Details({ group, reload }) {
  const showToast = useToast()
  const [name, setName] = useState(group.name)
  const [level, setLevel] = useState(group.level || '')
  const [notes, setNotes] = useState(group.notes || '')
  const [error, setError] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    setError('')
    save(
      () =>
        unwrap(
          supabase
            .from('groups')
            .update({ name: name.trim(), level: level.trim() || null, notes: notes.trim() || null })
            .eq('id', group.id),
        ),
      { reload, showToast, setError, message: 'Saved' },
    )
  }

  return (
    <section className="section">
      <h2>Name and notes</h2>
      <form onSubmit={handleSubmit}>
        <label>
          Group name
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          Level <span className="optional">(optional)</span>
          <input value={level} onChange={(e) => setLevel(e.target.value)} />
        </label>
        <label>
          Notes <span className="optional">(optional)</span>
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn-secondary">Save changes</button>
      </form>
    </section>
  )
}

function Deactivate({ group, reload }) {
  const showToast = useToast()
  const [error, setError] = useState('')
  const setActive = (active) => unwrap(supabase.from('groups').update({ active }).eq('id', group.id))

  function toggle() {
    setError('')
    const active = !group.active
    save(() => setActive(active), {
      reload, showToast, setError,
      message: active ? 'Group is active again' : 'Group deactivated',
      onUndo: () => save(() => setActive(!active), { reload, showToast, setError }),
    })
  }

  return (
    <section className="section">
      {group.active && <p className="muted">If this group stops meeting, deactivate it. Its history is kept.</p>}
      <button className="btn-secondary" onClick={toggle}>
        {group.active ? 'Deactivate group' : 'Make group active again'}
      </button>
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  )
}
