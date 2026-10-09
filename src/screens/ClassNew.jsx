import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { unwrap, useLoad } from '../lib/useLoad.js'
import { formatDay, formatMoney, parseAmount, todayISO } from '../lib/format.js'
import { saveErrorMessage } from '../lib/errors.js'
import { useToast } from '../components/Toast.jsx'
import LoadState from '../components/LoadState.jsx'
import { DURATIONS } from '../components/SlotFields.jsx'

function loadGroups() {
  return unwrap(supabase.from('groups').select('id, name').eq('active', true).order('name'))
}

// Active students, plus the price of the last private class (to suggest it).
async function loadPrivateOptions() {
  const [students, last] = await Promise.all([
    unwrap(supabase.from('students').select('id, name').eq('active', true).order('name')),
    unwrap(
      supabase.from('sessions').select('price').not('student_id', 'is', null).not('price', 'is', null)
        .order('created_at', { ascending: false }).limit(1),
    ),
  ])
  return { students, lastPrice: last[0]?.price ?? null }
}

// Adding a one-off class. First she picks what kind:
//   * Group class: an extra class for a group (e.g. to make up a cancelled one).
//   * Private class: one student, with its own price.
// Both are saved straight into `sessions` with no weekly slot.
// Coming from a group (?group=5) skips the question.
export default function ClassNew() {
  const [params] = useSearchParams()
  const [type, setType] = useState(params.get('group') ? 'group' : null)
  const date = params.get('date') || todayISO()

  return (
    <main className="screen">
      {type ? (
        <button className="back-link" onClick={() => setType(null)}>‹ Back</button>
      ) : (
        <Link to={`/?date=${date}`} className="back-link">‹ Today</Link>
      )}

      {type === null && (
        <>
          <h1>New class</h1>
          <p className="muted">What kind of class is it?</p>
          <div className="stack">
            <button className="card class-type" onClick={() => setType('group')}>
              <span className="card-title">👥 Group class</span>
              <span className="muted">An extra class for one of your groups, for example to make up a cancelled one.</span>
            </button>
            <button className="card class-type" onClick={() => setType('private')}>
              <span className="card-title">🧑‍🏫 Private class</span>
              <span className="muted">A class for one student, with its own price.</span>
            </button>
          </div>
        </>
      )}
      {type === 'group' && <GroupClassForm initialDate={date} initialGroup={params.get('group') || ''} />}
      {type === 'private' && <PrivateClassForm initialDate={date} />}
    </main>
  )
}

// Day, time and length: the same for both kinds of class.
function WhenFields({ date, setDate, time, setTime, duration, setDuration }) {
  return (
    <>
      <label>
        Day
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </label>
      <div className="slot-fields two-equal">
        <label>
          Time
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
        </label>
        <label>
          Length
          <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
            {DURATIONS.map((m) => (
              <option key={m} value={m}>{m} min</option>
            ))}
          </select>
        </label>
      </div>
    </>
  )
}

function GroupClassForm({ initialDate, initialGroup }) {
  const navigate = useNavigate()
  const showToast = useToast()
  const result = useLoad(loadGroups, [])
  const [groupId, setGroupId] = useState(initialGroup)
  const [date, setDate] = useState(initialDate)
  const [time, setTime] = useState('18:00')
  const [duration, setDuration] = useState(60)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await unwrap(
        supabase.from('sessions').insert({ group_id: Number(groupId), date, start_time: time, duration_min: duration }),
      )
      showToast(`Extra class added on ${formatDay(date)}`)
      navigate(`/?date=${date}`)
    } catch (err) {
      setError(saveErrorMessage(err))
      setBusy(false)
    }
  }

  return (
    <>
      <h1>Group class</h1>
      <p className="muted">A one-time class, for example to make up a cancelled one.</p>
      <LoadState {...result} />

      {result.data && (
        <form onSubmit={handleSubmit}>
          <label>
            Group
            <select value={groupId} onChange={(e) => setGroupId(e.target.value)} required>
              <option value="" disabled>Choose a group</option>
              {result.data.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </label>
          <WhenFields {...{ date, setDate, time, setTime, duration, setDuration }} />
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Add extra class'}</button>
        </form>
      )}
    </>
  )
}

function PrivateClassForm({ initialDate }) {
  const navigate = useNavigate()
  const showToast = useToast()
  const result = useLoad(loadPrivateOptions, [])
  const [studentId, setStudentId] = useState('')
  const [date, setDate] = useState(initialDate)
  const [time, setTime] = useState('18:00')
  const [duration, setDuration] = useState(60)
  const [price, setPrice] = useState(null) // null = not typed yet, use the last price
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const lastPrice = result.data?.lastPrice
  const priceText = price ?? (lastPrice ? String(lastPrice) : '')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const value = parseAmount(priceText)
    if (value === null) return setError('Type the price, for example 15000. Use 0 if it’s free.')
    setBusy(true)
    try {
      // The price becomes a charge on Payments by itself (see supabase/08-private-classes.sql).
      await unwrap(
        supabase.from('sessions').insert({
          student_id: Number(studentId), price: value, date, start_time: time, duration_min: duration,
        }),
      )
      const name = result.data.students.find((s) => s.id === Number(studentId))?.name
      showToast(`Private class with ${name} on ${formatDay(date)}`)
      navigate(`/?date=${date}`)
    } catch (err) {
      setError(saveErrorMessage(err))
      setBusy(false)
    }
  }

  return (
    <>
      <h1>Private class</h1>
      <p className="muted">One student, with its own price. The price shows on Payments so you can mark it paid.</p>
      <LoadState {...result} />

      {result.data && (
        <form onSubmit={handleSubmit}>
          <label>
            Student
            <select value={studentId} onChange={(e) => setStudentId(e.target.value)} required>
              <option value="" disabled>Choose a student</option>
              {result.data.students.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
          <p className="muted">
            Not in the list? <Link to="/students/new">Add the student first</Link> (no group needed).
          </p>
          <WhenFields {...{ date, setDate, time, setTime, duration, setDuration }} />
          <label>
            Price
            <input inputMode="numeric" value={priceText} onChange={(e) => setPrice(e.target.value)} placeholder="e.g. 15000" required />
          </label>
          {lastPrice && price === null && <p className="muted">Same as the last private class ({formatMoney(lastPrice)}).</p>}
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Add private class'}</button>
        </form>
      )}
    </>
  )
}
