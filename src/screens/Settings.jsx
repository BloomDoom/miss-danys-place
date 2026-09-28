import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { unwrap, useLoad } from '../lib/useLoad.js'
import { loadSettings } from '../lib/payments.js'
import { loadErrorMessage, saveErrorMessage } from '../lib/errors.js'
import { buildBackupFiles, saveFiles } from '../lib/backup.js'
import { useToast } from '../components/Toast.jsx'
import LoadState from '../components/LoadState.jsx'

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default function Settings() {
  const result = useLoad(loadSettings, [])

  return (
    <main className="screen">
      <Link to="/groups" className="back-link">‹ Groups</Link>
      <h1>Settings</h1>
      <LoadState {...result} />
      {result.data && <PaymentSettings settings={result.data} reload={result.reload} />}

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
