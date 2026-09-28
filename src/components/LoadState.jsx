import { loadErrorMessage } from '../lib/errors.js'

// Shows "Loading…" or an error with a Try again button.
// Pass it what useLoad() returns: <LoadState {...result} />
export default function LoadState({ loading, error, reload }) {
  if (error) {
    return (
      <div className="load-error" role="alert">
        <p>{loadErrorMessage(error)}</p>
        <button className="btn-secondary" onClick={reload}>Try again</button>
      </div>
    )
  }
  if (loading) return <p className="muted">Loading…</p>
  return null
}
