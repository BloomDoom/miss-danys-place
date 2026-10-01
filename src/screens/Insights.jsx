import { Link, useSearchParams } from 'react-router-dom'
import { useLoad } from '../lib/useLoad.js'
import { addDays, addMonths, currentMonthISO, formatMonth, todayISO } from '../lib/format.js'
import { formatRate, loadAttendance } from '../lib/attendance.js'
import LoadState from '../components/LoadState.jsx'
import EmptyState from '../components/EmptyState.jsx'
import BackButton from '../components/BackButton.jsx'

// Last day of a month: the day before the 1st of the next month.
const monthEnd = (month) => addDays(addMonths(month, 1), -1)

export default function Insights() {
  // Month in the URL, like on Payments.
  const [params, setParams] = useSearchParams()
  const thisMonth = currentMonthISO()
  const month = params.get('month') || thisMonth
  const goTo = (m) => setParams(m === thisMonth ? {} : { month: m }, { replace: true })
  const to = month === thisMonth ? todayISO() : monthEnd(month)

  const result = useLoad(() => loadAttendance(month, to), [month])
  const data = result.data

  return (
    <main className="screen">
      <BackButton fallback="/students" />
      <header className="day-nav">
        <button className="btn-icon" onClick={() => goTo(addMonths(month, -1))} aria-label="Previous month">‹</button>
        <div>
          <h1>Attendance</h1>
          <p className="muted">{formatMonth(month)}</p>
        </div>
        <button className="btn-icon" onClick={() => goTo(addMonths(month, 1))} aria-label="Next month" disabled={month >= thisMonth}>›</button>
      </header>

      <LoadState {...result} />

      {data && data.overall.expected === 0 && (
        <EmptyState emoji="📊" title="Nothing to show yet">Numbers for {formatMonth(month)} appear after you save attendance in your classes.</EmptyState>
      )}

      {data && data.overall.expected > 0 && (
        <>
          <section className="summary">
            <p className="big-number">
              {formatRate(data.overall.rate)} <span className="muted">came to class</span>
            </p>
            <p className="muted">Only classes where you saved attendance count.</p>
          </section>

          <section className="section">
            <h2>By group</h2>
            <ul className="card-list">
              {data.groups.map((g) => (
                <li key={g.group.id}>
                  <Link to={`/groups/${g.group.id}`} className="card">
                    <span className="card-title">{g.group.name}</span>
                    <span>
                      <strong>{formatRate(g.rate)}</strong> · {g.classes === 1 ? '1 class' : `${g.classes} classes`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="section">
            <h2>By student</h2>
            <p className="muted">Most absences first.</p>
            <ul className="card-list">
              {data.students
                .filter((s) => s.student.active)
                .map((s) => (
                  <li key={s.student.id}>
                    <Link to={`/students/${s.student.id}`} className={`card attendance-row ${s.absences > 0 ? 'has-absences' : ''}`}>
                      <span className="card-title">{s.student.name}</span>
                      <span>
                        {s.absences === 0
                          ? `Came to all ${s.classes} ${s.classes === 1 ? 'class' : 'classes'} ✓`
                          : `Missed ${s.absences} of ${s.classes} ${s.classes === 1 ? 'class' : 'classes'} · ${formatRate(s.rate)}`}
                      </span>
                    </Link>
                  </li>
                ))}
            </ul>
          </section>
        </>
      )}
    </main>
  )
}
