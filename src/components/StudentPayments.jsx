import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { unwrap, useLoad } from '../lib/useLoad.js'
import { currentMonthISO, formatDate, formatMoney, formatMonth, parseAmount } from '../lib/format.js'
import { METHODS, STATUS_LABELS, activePayments, ensureCharges, loadSettings, withStatus } from '../lib/payments.js'
import { saveErrorMessage } from '../lib/errors.js'
import { CHARGE_KINDS } from '../lib/fees.js'
import { useToast } from './Toast.jsx'
import LoadState from './LoadState.jsx'
import PayPanel from './PayPanel.jsx'

async function loadCharges(studentId) {
  const settings = await loadSettings()
  await ensureCharges(currentMonthISO()) // so this month's fee shows even if Payments wasn't opened yet
  const charges = await unwrap(
    supabase
      .from('charges')
      .select('*, students(id, name), groups(id, name), payments(*)')
      .eq('student_id', studentId)
      .is('deleted_at', null)
      .order('month', { ascending: false }),
  )
  return charges.map((c) => withStatus(c, settings.due_day))
}

// A student's payment history: one card per monthly fee, newest first.
export default function StudentPayments({ studentId }) {
  const result = useLoad(() => loadCharges(studentId), [studentId])
  const [paying, setPaying] = useState(null) // charge id with the pay panel open
  const [editing, setEditing] = useState(null) // charge id being edited
  const charges = result.data
  const owed = charges?.reduce((sum, c) => sum + c.balance, 0) ?? 0

  return (
    <section className="section">
      <h2>Payments</h2>
      <LoadState {...result} />
      {charges && (
        <>
          {charges.length === 0 ? (
            <p className="empty">No fees yet. They appear once the student is in a group.</p>
          ) : (
            <p className={owed > 0 ? 'error' : 'success'}>{owed > 0 ? `Owes ${formatMoney(owed)} in total` : 'Nothing owed ✓'}</p>
          )}
          <ul className="card-list">
            {charges.map((c) => (
              <li key={c.id} className={`card charge-card status-${c.status}`}>
                <div className="charge-top">
                  <span className="charge-name">
                    <span className="card-title">{formatMonth(c.month)}</span>
                    <span className="muted">{c.kind === 'materials' ? CHARGE_KINDS.materials : c.groups?.name}</span>
                  </span>
                  <span className="charge-right">
                    <span className={`chip chip-${c.status}`}>{STATUS_LABELS[c.status]}</span>
                    <span>{formatMoney(c.amount)}</span>
                  </span>
                </div>
                {c.note && <p className="muted charge-note">Note: {c.note}</p>}
                <PaymentLines charge={c} reload={result.reload} />

                {editing === c.id ? (
                  <EditCharge
                    charge={c}
                    onDone={() => {
                      setEditing(null)
                      result.reload()
                    }}
                  />
                ) : paying === c.id ? (
                  <PayPanel
                    charge={c}
                    onCancel={() => setPaying(null)}
                    onSaved={() => {
                      setPaying(null)
                      result.reload()
                    }}
                  />
                ) : (
                  <div className="btn-row">
                    {c.status !== 'paid' && <button className="btn-primary" onClick={() => setPaying(c.id)}>Mark paid</button>}
                    <button className="btn-secondary" onClick={() => setEditing(c.id)}>Change fee</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

// The payments of one fee, each with a Remove button.
function PaymentLines({ charge, reload }) {
  const showToast = useToast()
  const payments = activePayments(charge).sort((a, b) => a.paid_on.localeCompare(b.paid_on))
  if (payments.length === 0) return null

  async function remove(payment) {
    // Deleting is the one place we ask first (see the UX rules).
    if (!window.confirm(`Remove the payment of ${formatMoney(payment.amount)} from ${formatDate(payment.paid_on)}?`)) return
    try {
      // Never really deleted: marked as removed, so it can be recovered.
      await unwrap(supabase.from('payments').update({ deleted_at: new Date().toISOString() }).eq('id', payment.id))
      showToast('Payment removed')
      reload()
    } catch (err) {
      showToast(saveErrorMessage(err))
    }
  }

  return (
    <ul className="payment-lines">
      {payments.map((p) => (
        <li key={p.id}>
          <span>
            Paid {formatMoney(p.amount)} · {METHODS[p.method]} · {formatDate(p.paid_on)}
          </span>
          <button className="btn-text" onClick={() => remove(p)}>Remove</button>
        </li>
      ))}
    </ul>
  )
}

// Change one month's fee (discount, late fee, joined mid-month…) with a note.
function EditCharge({ charge, onDone }) {
  const [amount, setAmount] = useState(String(charge.amount))
  const [note, setNote] = useState(charge.note || '')
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const value = parseAmount(amount)
    if (value === null) return setError('Type the fee, for example 20000. Use 0 if they pay nothing this month.')
    try {
      // amount_edited = true: price changes won't overwrite it anymore.
      await unwrap(
        supabase.from('charges').update({ amount: value, note: note.trim() || null, amount_edited: true }).eq('id', charge.id),
      )
      onDone()
    } catch (err) {
      setError(saveErrorMessage(err))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="slot-box">
      <label>
        {charge.kind === 'materials' ? 'Materials' : 'Fee'} for {formatMonth(charge.month)}
        <input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
      </label>
      <label>
        Why? <span className="optional">(optional)</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Sibling discount" />
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="btn-row">
        <button type="button" className="btn-secondary" onClick={onDone}>Cancel</button>
        <button className="btn-primary">Save fee</button>
      </div>
    </form>
  )
}
