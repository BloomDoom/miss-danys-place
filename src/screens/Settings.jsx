import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { unwrap, useLoad } from '../lib/useLoad.js'
import { loadSettings } from '../lib/payments.js'
import { feeForMonth, loadFeePrices } from '../lib/fees.js'
import { addMonths, currentMonthISO, formatMoney, formatMonth, parseAmount } from '../lib/format.js'
import { loadErrorMessage, saveErrorMessage } from '../lib/errors.js'
import { buildBackupFiles, saveFiles } from '../lib/backup.js'
import { useToast } from '../components/Toast.jsx'
import LoadState from '../components/LoadState.jsx'
import RewardTypes from '../components/RewardTypes.jsx'

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default function Settings() {
  const result = useLoad(loadSettings, [])

  return (
    <main className="screen">
      <Link to="/groups" className="back-link">‹ Groups</Link>
      <h1>Settings</h1>
      <LoadState {...result} />
      {result.data && (
        <>
          <FeeSettings />
          <PaymentSettings settings={result.data} reload={result.reload} />
          <BirthdayMessage settings={result.data} reload={result.reload} />
          <RewardTypes />
        </>
      )}

      <Backup />

      <section className="section">
        <h2>Loading data</h2>
        <ul className="card-list">
          <li>
            <Link to="/settings/import" className="card">
              <span className="card-title">Import from a spreadsheet</span>
              <span className="muted">Add many groups or students at once from a CSV file</span>
            </Link>
          </li>
        </ul>
      </section>

      <section className="section">
        <button className="btn-secondary" onClick={() => supabase.auth.signOut()}>
          Log out
        </button>
      </section>
    </main>
  )
}

// The text of the "Send birthday message" button on Today.
function BirthdayMessage({ settings, reload }) {
  const showToast = useToast()
  const [text, setText] = useState(settings.birthday_message)
  const [error, setError] = useState('')

  async function save(e) {
    e.preventDefault()
    setError('')
    if (!text.trim()) return setError('Write a message first.')
    try {
      await unwrap(supabase.from('settings').update({ birthday_message: text.trim() }).eq('id', 1))
      reload()
      showToast('Birthday message saved')
    } catch (err) {
      setError(saveErrorMessage(err))
    }
  }

  return (
    <section className="section">
      <h2>Birthday message</h2>
      <form onSubmit={save}>
        <label>
          Message
          <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} />
        </label>
        <p className="muted">{'{name}'} is replaced by the student’s first name. You can still change the text in WhatsApp before sending.</p>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn-secondary" disabled={text.trim() === settings.birthday_message}>Save message</button>
      </form>
    </section>
  )
}

// Two steps because of an iPhone rule: the Share sheet only opens right
// after a tap, and reading all the data takes a few seconds. So: tap 1
// reads the data, tap 2 opens the Share sheet.
function Backup() {
  const [files, setFiles] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function prepare() {
    setError('')
    setMessage('')
    setBusy(true)
    try {
      setFiles(await buildBackupFiles())
    } catch (err) {
      setError(loadErrorMessage(err))
    }
    setBusy(false)
  }

  async function save() {
    setError('')
    try {
      await saveFiles(files)
      setFiles(null)
      setMessage('Backup done ✓')
    } catch (err) {
      if (err.name === 'AbortError') return // she closed the Share sheet
      console.error(err)
      setError("The backup files couldn't be saved. Try again.")
    }
  }

  return (
    <section className="section">
      <h2>Backup</h2>
      <p className="muted">
        Saves a copy of everything (students, classes, payments) as spreadsheet files. Do it once a month and keep
        the files somewhere safe, like Google Drive or your email.
      </p>
      {files ? (
        <button className="btn-primary" onClick={save}>Save backup files</button>
      ) : (
        <button className="btn-secondary" onClick={prepare} disabled={busy}>
          {busy ? 'Preparing…' : 'Make a backup'}
        </button>
      )}
      {message && <p className="success" role="status">{message}</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  )
}

// Changes save straight away (no Save button) and show a short message.
function PaymentSettings({ settings, reload }) {
  const showToast = useToast()
  const [error, setError] = useState('')

  async function save(changes, message) {
    setError('')
    try {
      await unwrap(supabase.from('settings').update(changes).eq('id', 1))
      reload()
      showToast(message)
    } catch (err) {
      setError(saveErrorMessage(err))
    }
  }

  function toggleMonth(n) {
    const months = settings.skip_months.includes(n)
      ? settings.skip_months.filter((m) => m !== n)
      : [...settings.skip_months, n].sort((a, b) => a - b)
    save({ skip_months: months }, settings.skip_months.includes(n) ? `Fees back on in ${MONTH_NAMES[n - 1]}` : `No fees in ${MONTH_NAMES[n - 1]}`)
  }

  return (
    <>
      <section className="section">
        <h2>Payments</h2>
        <label>
          Fees are due on day
          <select value={settings.due_day} onChange={(e) => save({ due_day: Number(e.target.value) }, 'Due day saved')}>
            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </label>
        <p className="muted">After this day, unpaid fees show as Overdue.</p>
      </section>

      <section className="section">
        <h2>No fees in these months</h2>
        <p className="muted">For example January, if there are no classes.</p>
        <div className="month-grid">
          {MONTH_NAMES.map((name, i) => (
            <label key={name} className="checkbox-row">
              <input type="checkbox" checked={settings.skip_months.includes(i + 1)} onChange={() => toggleMonth(i + 1)} />
              {name}
            </label>
          ))}
        </div>
      </section>
      {error && <p className="error" role="alert">{error}</p>}
    </>
  )
}

// The monthly fee for everyone, and the lower price for siblings. Each
// change starts in a month she picks; earlier months keep the old fee.
function FeeSettings() {
  const showToast = useToast()
  const result = useLoad(loadFeePrices, [])
  const thisMonth = currentMonthISO()
  const [changing, setChanging] = useState(false)
  const [regular, setRegular] = useState('')
  const [sibling, setSibling] = useState('')
  const [month, setMonth] = useState(thisMonth)
  const [error, setError] = useState('')
  // She can pick from 2 months back to 3 months ahead.
  const monthChoices = [-2, -1, 0, 1, 2, 3].map((n) => addMonths(thisMonth, n))

  if (!result.data) return <LoadState {...result} />
  const prices = result.data
  const current = feeForMonth(prices, thisMonth)
  const upcoming = prices.filter((p) => p.effective_month > thisMonth)
  const history = [...prices].reverse()

  function startChange() {
    setRegular(current ? String(current.regular) : '')
    setSibling(current ? String(current.sibling) : '')
    setChanging(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const values = { regular: parseAmount(regular), sibling: parseAmount(sibling) }
    if (values.regular === null || values.sibling === null) return setError('Type both fees, for example 80000 and 70000.')
    try {
      // "upsert" = insert, or update if a fee already starts that same month.
      await unwrap(supabase.from('fee_prices').upsert({ ...values, effective_month: month }, { onConflict: 'effective_month' }))
      showToast(`New fee saved from ${formatMonth(month)}`)
      setChanging(false)
      setMonth(thisMonth)
      result.reload()
    } catch (err) {
      setError(saveErrorMessage(err))
    }
  }

  return (
    <section className="section">
      <h2>Monthly fee</h2>
      {current ? (
        <>
          <p className="big-number">{formatMoney(current.regular)}</p>
          <p>Siblings: <strong>{formatMoney(current.sibling)}</strong> each</p>
          <p className="muted">Since {formatMonth(current.effective_month)}. In April everyone also pays materials ({formatMoney(current.regular)}).</p>
        </>
      ) : (
        <p className="empty">No fee yet. Tap “Change fee” to set one.</p>
      )}
      {upcoming.map((p) => (
        <p key={p.id}>
          From {formatMonth(p.effective_month)}: <strong>{formatMoney(p.regular)}</strong>, siblings {formatMoney(p.sibling)}
        </p>
      ))}

      {changing ? (
        <form onSubmit={handleSubmit} className="slot-box">
          <div className="slot-fields two-equal">
            <label>
              Fee
              <input inputMode="numeric" value={regular} onChange={(e) => setRegular(e.target.value)} placeholder="e.g. 80000" />
            </label>
            <label>
              Siblings
              <input inputMode="numeric" value={sibling} onChange={(e) => setSibling(e.target.value)} placeholder="e.g. 70000" />
            </label>
          </div>
          <label>
            Starting from which month?
            <select value={month} onChange={(e) => setMonth(e.target.value)}>
              {monthChoices.map((m) => (
                <option key={m} value={m}>{formatMonth(m)}</option>
              ))}
            </select>
          </label>
          <p className="muted">Months before this keep their old fee. Becas are taken off each student’s fee.</p>
          {error && <p className="error" role="alert">{error}</p>}
          <div className="btn-row">
            <button type="button" className="btn-secondary" onClick={() => setChanging(false)}>Cancel</button>
            <button className="btn-primary">Save fee</button>
          </div>
        </form>
      ) : (
        <button className="btn-secondary" onClick={startChange}>Change fee</button>
      )}

      {history.length > 1 && (
        <details>
          <summary>Fee history</summary>
          <ul className="row-list">
            {history.map((p) => (
              <li key={p.id}>
                <span>From {formatMonth(p.effective_month)}</span>
                <strong>{formatMoney(p.regular)} · {formatMoney(p.sibling)}</strong>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
