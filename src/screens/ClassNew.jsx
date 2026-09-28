import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { unwrap, useLoad } from '../lib/useLoad.js'
import { formatDay, todayISO } from '../lib/format.js'
import { saveErrorMessage } from '../lib/errors.js'
import { useToast } from '../components/Toast.jsx'
import LoadState from '../components/LoadState.jsx'
import { DURATIONS } from '../components/SlotFields.jsx'

function loadGroups() {
  return unwrap(supabase.from('groups').select('id, name').eq('active', true).order('name'))
}

// A one-off extra class (e.g. to make up a cancelled one). It's saved
// straight into `sessions` with no weekly slot.
export default function ClassNew() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const showToast = useToast()
  const result = useLoad(loadGroups, [])
  const [groupId, setGroupId] = useState(params.get('group') || '')
  const [date, setDate] = useState(params.get('date') || todayISO())
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
    <main className="screen">
      <Link to={`/?date=${date}`} className="back-link">‹ Today</Link>
      <h1>Extra class</h1>
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
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Add extra class'}</button>
        </form>
      )}
    </main>
  )
}
