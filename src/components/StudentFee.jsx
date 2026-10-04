import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { unwrap, useLoad } from '../lib/useLoad.js'
import { formatMoney } from '../lib/format.js'
import { feeForMonth, loadFeePrices, shareSurname, studentFee } from '../lib/fees.js'
import { nameClass } from '../lib/students.js'
import { saveErrorMessage } from '../lib/errors.js'
import { useToast } from './Toast.jsx'
import LoadState from './LoadState.jsx'

async function loadFee(student) {
  const [prices, students] = await Promise.all([
    loadFeePrices(),
    unwrap(supabase.from('students').select('id, name, sex, family_id').eq('active', true)),
  ])
  students.sort((a, b) => a.name.localeCompare(b.name, 'es'))
  const siblings = student.family_id ? students.filter((s) => s.family_id === student.family_id && s.id !== student.id) : []
  return { fee: feeForMonth(prices), students, siblings }
}

// What the student pays each month: beca and siblings. `onChanged` runs
// after a change, so the payments below show the new fee.
export default function StudentFee({ student, onChanged }) {
  const showToast = useToast()
  const result = useLoad(() => loadFee(student), [student.id, student.family_id])
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  async function save(work, message) {
    setError('')
    try {
      await work()
      showToast(message)
      onChanged()
      return true
    } catch (err) {
      setError(saveErrorMessage(err))
      return false
    }
  }

  function changeBeca(percent) {
    save(
      () => unwrap(supabase.from('students').update({ beca_percent: percent }).eq('id', student.id)),
      percent ? `Beca of ${percent}% saved` : 'No beca',
    )
  }

  // Siblings share a family_id: the lowest one of the two families (or
  // student ids), so joining two families merges them.
  async function addSibling(other) {
    const familyId = Math.min(student.family_id ?? student.id, other.family_id ?? other.id)
    const oldFamilies = [student.family_id, other.family_id].filter(Boolean)
    const ok = await save(async () => {
      await unwrap(supabase.from('students').update({ family_id: familyId }).in('id', [student.id, other.id]))
      if (oldFamilies.length) await unwrap(supabase.from('students').update({ family_id: familyId }).in('family_id', oldFamilies))
    }, `${other.name} linked as a sibling`)
    if (ok) setAdding(false)
  }

  function unlink(sibling) {
    const left = result.data.siblings.filter((s) => s.id !== sibling.id)
    // Nobody left to be a sibling of: this student leaves the family too.
    const ids = left.length === 0 ? [sibling.id, student.id] : [sibling.id]
    save(() => unwrap(supabase.from('students').update({ family_id: null }).in('id', ids)), `${sibling.name} unlinked`)
  }

  if (!result.data) return <LoadState {...result} />
  const { fee, students, siblings } = result.data
  const pays = fee && studentFee(fee, student.beca_percent, siblings.length > 0)

  return (
    <section className="section">
      <h2>Monthly fee</h2>
      {pays ? (
        <p className="fee-line">
          {pays.sibling ? 'Sibling price' : 'Fee'} {formatMoney(pays.base)}
          {pays.beca > 0 && <> − {pays.beca}% beca</>}
          {pays.beca > 0 && <> = <strong>{formatMoney(pays.amount)}</strong></>}
          {' a month'}
        </p>
      ) : (
        <p className="empty">No school fee set yet (Settings).</p>
      )}

      <label>
        Beca <span className="optional">(% off the fee)</span>
        <select value={student.beca_percent} onChange={(e) => changeBeca(Number(e.target.value))}>
          {Array.from({ length: 21 }, (_, i) => i * 5).map((p) => (
            <option key={p} value={p}>{p === 0 ? 'No beca' : `${p}%`}</option>
          ))}
        </select>
      </label>

      <h3>Siblings</h3>
      {siblings.length === 0 && <p className="muted">No brothers or sisters linked.</p>}
      <ul className="row-list">
        {siblings.map((s) => (
          <li key={s.id}>
            <Link to={`/students/${s.id}`} className={nameClass(s)}>{s.name}</Link>
            <button className="btn-text" onClick={() => unlink(s)}>Unlink</button>
          </li>
        ))}
      </ul>
      {adding ? (
        <AddSibling
          student={student}
          candidates={students.filter((s) => s.id !== student.id && !siblings.some((x) => x.id === s.id))}
          onPick={addSibling}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button className="btn-secondary" onClick={() => setAdding(true)}>+ Add sibling</button>
      )}
      {siblings.length > 0 && fee && <p className="muted">Siblings each pay {formatMoney(fee.sibling)} instead of {formatMoney(fee.regular)}.</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  )
}

// A list of students to pick from, with the same surname first.
function AddSibling({ student, candidates, onPick, onCancel }) {
  const [id, setId] = useState('')
  const suggested = candidates.filter((s) => shareSurname(student.name, s.name))
  const others = candidates.filter((s) => !suggested.includes(s))
  const picked = candidates.find((s) => s.id === Number(id))

  return (
    <div className="slot-box">
      <label>
        Who is the brother or sister?
        <select value={id} onChange={(e) => setId(e.target.value)}>
          <option value="" disabled>Choose a student</option>
          {suggested.length > 0 && (
            <optgroup label="Same surname">
              {suggested.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </optgroup>
          )}
          <optgroup label="All students">
            {others.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </optgroup>
        </select>
      </label>
      <div className="btn-row">
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button className="btn-primary" disabled={!picked} onClick={() => onPick(picked)}>Link sibling</button>
      </div>
    </div>
  )
}
