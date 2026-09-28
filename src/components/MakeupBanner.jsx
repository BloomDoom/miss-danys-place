import { Link } from 'react-router-dom'
import { makeupState } from '../lib/makeups.js'

// "Make-ups: 2 to sort out · 1 scheduled ›", shown on Today and Students
// while any make-ups are pending. `pending` = loadPendingMakeups().
export default function MakeupBanner({ pending }) {
  if (pending.length === 0) return null
  const scheduled = pending.filter((a) => makeupState(a) === 'scheduled').length
  const toSort = pending.length - scheduled // to schedule, or needing an answer
  const parts = [toSort > 0 && `${toSort} to sort out`, scheduled > 0 && `${scheduled} scheduled`].filter(Boolean)

  return (
    <Link to="/makeups" className={`makeup-banner ${toSort > 0 ? 'needs-action' : ''}`}>
      <span>
        <strong>Make-ups:</strong> {parts.join(' · ')}
      </span>
      <span aria-hidden="true">›</span>
    </Link>
  )
}
