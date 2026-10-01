import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { unwrap } from '../lib/useLoad.js'
import { currentMonthISO, parseAmount } from '../lib/format.js'
import { saveErrorMessage } from '../lib/errors.js'
import { useToast } from '../components/Toast.jsx'
import SlotFields, { NEW_SLOT, slotRows } from '../components/SlotFields.jsx'

export default function GroupNew() {
  const navigate = useNavigate()
  const showToast = useToast()
  const [name, setName] = useState('')
  const [level, setLevel] = useState('')
  const [notes, setNotes] = useState('')
  const [price, setPrice] = useState('')
  const [slots, setSlots] = useState([NEW_SLOT])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (slots.some((s) => s.weekdays.length === 0)) return setError('Pick at least one day for each class time.')
    setBusy(true)
    try {
      // 1. the group itself; .select().single() gives us back its new id
      const group = await unwrap(
        supabase
          .from('groups')
          .insert({ name: name.trim(), level: level.trim() || null, notes: notes.trim() || null })
          .select()
          .single(),
      )
      // 2. its weekly class times: one row per day
      await unwrap(supabase.from('group_slots').insert(slots.flatMap((s) => slotRows(s, group.id))))
      // 3. its price, starting this month
      const amount = parseAmount(price)
      if (amount !== null) {
        await unwrap(
          supabase.from('group_prices').insert({ group_id: group.id, amount, effective_month: currentMonthISO() }),
        )
      }
      showToast(`${group.name} created`)
      navigate(`/groups/${group.id}`, { replace: true })
    } catch (err) {
      setError(saveErrorMessage(err))
      setBusy(false)
    }
  }

  return (
    <main className="screen">
      <Link to="/groups" className="back-link">‹ Groups</Link>
      <h1>New group</h1>

      <form onSubmit={handleSubmit}>
        <label>
          Group name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kids A1" required />
        </label>
        <label>
          Level <span className="optional">(optional)</span>
          <input value={level} onChange={(e) => setLevel(e.target.value)} placeholder="e.g. Beginners" />
        </label>
        <label>
          Monthly price
          <input
            inputMode="numeric"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="e.g. 25000"
          />
        </label>

        <h2>Class times</h2>
        {slots.map((slot, i) => (
          <div key={i} className="slot-box">
            <SlotFields slot={slot} onChange={(s) => setSlots(slots.map((old, j) => (j === i ? s : old)))} />
            {slots.length > 1 && (
              <button type="button" className="btn-text" onClick={() => setSlots(slots.filter((_, j) => j !== i))}>
                Remove this time
              </button>
            )}
          </div>
        ))}
        <button type="button" className="btn-secondary" onClick={() => setSlots([...slots, NEW_SLOT])}>
          + Another class time (if a day is at a different time)
        </button>

        <label className="section">
          Notes <span className="optional">(optional)</span>
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>

        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Create group'}
        </button>
      </form>
    </main>
  )
}
