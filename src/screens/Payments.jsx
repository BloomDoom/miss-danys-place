import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { unwrap, useLoad } from '../lib/useLoad.js'
import { addMonths, currentMonthISO, formatMoney, formatMonth } from '../lib/format.js'
import { METHODS, METHOD_COLORS, STATUS_LABELS, ensureCharges, loadSettings, sortByStatus, totalsByMethod, withStatus } from '../lib/payments.js'
import { nameClass } from '../lib/students.js'
import { normalize } from '../lib/groups.js'
import LoadState from '../components/LoadState.jsx'
import EmptyState from '../components/EmptyState.jsx'
import PayPanel from '../components/PayPanel.jsx'

async function loadMonth(month) {
  const settings = await loadSettings()
  const skipped = settings.skip_months.includes(Number(month.slice(5, 7)))
  await ensureCharges(month) // creates the month's charges the first time
  const charges = await unwrap(
    supabase
      .from('charges')
      .select('*, students(id, name, sex), groups(id, name), payments(*)')
      .eq('month', month)
      .is('deleted_at', null),
  )
  return { skipped, charges: sortByStatus(charges.map((c) => withStatus(c, settings.due_day))) }
}

export default function Payments() {
  // Month in the URL (/payments?month=2026-09-01), like the day on Today.
  const [params, setParams] = useSearchParams()
  const thisMonth = currentMonthISO()
  const month = params.get('month') || thisMonth
  const goTo = (m) => setParams(m === thisMonth ? {} : { month: m }, { replace: true })
  // Next month is allowed, for people who pay in advance.
  const canGoForward = month < addMonths(thisMonth, 1)

  const result = useLoad(() => loadMonth(month), [month])
  const [openId, setOpenId] = useState(null) // the charge whose "Mark paid" panel is open
  const [search, setSearch] = useState('')

  const charges = result.data?.charges
  const expected = charges?.reduce((sum, c) => sum + c.amount, 0) ?? 0
  const collected = charges?.reduce((sum, c) => sum + Math.min(c.paid, c.amount), 0) ?? 0
  const owing = charges?.filter((c) => c.status !== 'paid').length ?? 0
  const byMethod = charges ? totalsByMethod(charges) : []
  const shown = search ? charges?.filter((c) => normalize(c.students.name).includes(normalize(search))) : charges

  return (
    <main className="screen">
      <header className="day-nav">
        <button className="btn-icon" onClick={() => goTo(addMonths(month, -1))} aria-label="Previous month">‹</button>
        <div>
          <h1>Payments</h1>
          <p className="muted">{formatMonth(month)}</p>
        </div>
        <button
          className="btn-icon"
          onClick={() => goTo(addMonths(month, 1))}
          aria-label="Next month"
          disabled={!canGoForward}
        >›</button>
      </header>
      {month !== thisMonth && (
        <button className="btn-secondary" onClick={() => goTo(thisMonth)}>Back to this month</button>
      )}

      <LoadState {...result} />

      {result.data?.skipped && (
        <EmptyState emoji="🏖️" title={`No fees in ${formatMonth(month)}`}>Holidays! You can change this in Settings.</EmptyState>
      )}

      {charges && !result.data.skipped && (
        <>
          {charges.length === 0 ? (
            <EmptyState emoji="💰" title="No fees this month yet">
              Fees appear here for students in a group that has a price.
            </EmptyState>
          ) : (
            <section className="summary">
              <p className="big-number">
                {formatMoney(collected)} <span className="muted">of {formatMoney(expected)}</span>
              </p>
              <div className="progress" aria-hidden="true">
                <div style={{ width: `${expected ? (collected / expected) * 100 : 0}%` }} />
              </div>
              <p>{owing === 0 ? 'Everyone has paid 🎉' : owing === 1 ? '1 student still has to pay' : `${owing} students still have to pay`}</p>
              {byMethod.length > 0 && <MethodChart totals={byMethod} />}
            </section>
          )}

          {charges.length > 0 && (
            <input
              type="search"
              className="payments-search"
              placeholder="Search by name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search by name"
            />
          )}
          {search && shown.length === 0 && <p className="empty">No one called “{search.trim()}” has a fee this month.</p>}

          <ul className="card-list">
            {shown.map((c) => (
              <li key={c.id} className={`card charge-card status-${c.status}`}>
                {/* The whole top (name, group, status, amount) opens the student */}
                <Link to={`/students/${c.students.id}`} className="charge-top">
                  <span className="charge-name">
                    <span className={`card-title ${nameClass(c.students)}`}>{c.students.name}</span>
                    <span className="muted">{c.groups.name}</span>
                  </span>
                  <span className="charge-right">
                    <span className={`chip chip-${c.status}`}>{STATUS_LABELS[c.status]}</span>
                    <span>{c.status === 'paid' ? formatMoney(c.amount) : `${formatMoney(c.balance)} left`}</span>
                  </span>
                  <span className="card-chevron" aria-hidden="true">›</span>
                </Link>

                {c.status !== 'paid' &&
                  (openId === c.id ? (
                    <PayPanel
                      charge={c}
                      onCancel={() => setOpenId(null)}
                      onSaved={() => {
                        setOpenId(null)
                        result.reload()
                      }}
                    />
                  ) : (
                    <button className="btn-primary" onClick={() => setOpenId(c.id)}>Mark paid</button>
                  ))}
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  )
}

// How the money came in: one bar split by payment method, with each
// method's share and amount written underneath (so it isn't color alone).
// The methods keep their order and color, whatever the amounts.
function MethodChart({ totals }) {
  const amounts = Object.fromEntries(totals)
  const total = totals.reduce((sum, [, amount]) => sum + amount, 0)
  const methods = Object.keys(METHODS).filter((m) => amounts[m])
  const percent = (m) => Math.round((amounts[m] / total) * 100)

  return (
    <div className="method-chart">
      <p className="method-chart-title">How they paid</p>
      <div className="method-bar" aria-hidden="true">
        {methods.map((m) => (
          <div key={m} style={{ flexGrow: amounts[m], background: METHOD_COLORS[m] }} title={`${METHODS[m]}: ${percent(m)}%`} />
        ))}
      </div>
      <ul className="method-legend" aria-label="Collected by payment method">
        {methods.map((m) => (
          <li key={m}>
            <span className="method-dot" style={{ background: METHOD_COLORS[m] }} aria-hidden="true" />
            <span className="method-name">{METHODS[m]}</span>
            <strong>{percent(m)}%</strong>
            <span className="muted">{formatMoney(amounts[m])}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
