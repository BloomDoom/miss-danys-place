import { useLoad } from '../lib/useLoad.js'
import { loadPendingMakeups, makeupState } from '../lib/makeups.js'
import LoadState from '../components/LoadState.jsx'
import MakeupCard from '../components/MakeupCard.jsx'
import BackButton from '../components/BackButton.jsx'

// Every make-up that still needs something, so nothing lives in her head.
export default function Makeups() {
  const result = useLoad(loadPendingMakeups, [])
  const all = result.data ?? []
  // Things to answer first, then things to schedule, then what's booked.
  const needsAnswer = all.filter((a) => ['check', 'cancelled'].includes(makeupState(a)))
  const toSchedule = all.filter((a) => makeupState(a) === 'missed')
  const scheduled = all.filter((a) => makeupState(a) === 'scheduled')

  const list = (items) => (
    <ul className="card-list">
      {items.map((a) => (
        <li key={a.id}>
          <MakeupCard absence={a} showStudent onChanged={result.reload} />
        </li>
      ))}
    </ul>
  )

  return (
    <main className="screen">
      <BackButton fallback="/" />
      <h1>Make-ups</h1>
      <LoadState {...result} />

      {result.data && all.length === 0 && (
        <p className="empty">No make-ups pending. When you mark someone absent, they’ll show up here.</p>
      )}
      {needsAnswer.length > 0 && (
        <section className="section">
          <h2>Check these ({needsAnswer.length})</h2>
          {list(needsAnswer)}
        </section>
      )}
      {toSchedule.length > 0 && (
        <section className="section">
          <h2>To schedule ({toSchedule.length})</h2>
          {list(toSchedule)}
        </section>
      )}
      {scheduled.length > 0 && (
        <section className="section">
          <h2>Scheduled ({scheduled.length})</h2>
          {list(scheduled)}
        </section>
      )}
    </main>
  )
}
