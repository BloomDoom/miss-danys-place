import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { unwrap, useLoad } from '../lib/useLoad.js'
import { addMonths, currentMonthISO, formatMoney, formatMonth } from '../lib/format.js'
import { METHODS, STATUS_LABELS, ensureCharges, loadSettings, sortByStatus, totalsByMethod, withStatus } from '../lib/payments.js'
import LoadState from '../components/LoadState.jsx'
import PayPanel from '../components/PayPanel.jsx'

async function loadMonth(month) {
  const settings = await loadSettings()
  const skipped = settings.skip_months.includes(Number(month.slice(5, 7)))
  await ensureCharges(month) // creates the month's charges the first time
  const charges = await unwrap(
    supabase
      .from('charges')
      .select('*, students(id, name), groups(id, name), payments(*)')
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

  const charges = result.data?.charges
  const expected = charges?.reduce((sum, c) => sum + c.amount, 0) ?? 0
  const collected = charges?.reduce((sum, c) => sum + Math.min(c.paid, c.amount), 0) ?? 0
  const owing = charges?.filter((c) => c.status !== 'paid').length ?? 0
  const byMethod = charges ? totalsByMethod(charges) : []

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
        <p className="empty">No fees in {formatMonth(month)}. You can change this in Settings.</p>
      )}

      {charges && !result.data.skipped && (
        <>
          {charges.length === 0 ? (
            <p className="empty">
              No fees this month yet. Fees appear here for students who are in a group that has a price.
            </p>
          ) : (
            <section className="summary">
              <p className="big-number">
                {formatMoney(collected)} <span className="muted">of {formatMoney(expected)}</span>
              </p>
              <div className="progress" aria-hidden="true">
                <div style={{ width: `${expected ? (collected / expected) * 100 : 0}%` }} />
              </div>
              <p>{owing === 0 ? 'Everyone has paid 🎉' : owing === 1 ? '1 student still has to pay' : `${owing} students still have to pay`}</p>
              {byMethod.length > 0 && (
                <ul className="method-totals" aria-label="Collected by payment method">
                  {byMethod.map(([method, total]) => (
                    <li key={method}>
                      <span>{METHODS[method]}</span>
                      <strong>{formatMoney(total)}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <ul className="card-list">
            {charges.map((c) => (
              <li key={c.id} className={`card charge-card status-${c.status}`}>
                {/* The whole top (name, group, status, amount) opens the student */}
                <Link to={`/students/${c.students.id}`} className="charge-top">
                  <span className="charge-name">
                    <span className="card-title">{c.students.name}</span>
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
