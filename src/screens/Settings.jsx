import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'

export default function Settings() {
  return (
    <main className="screen">
      <Link to="/groups" className="back-link">‹ Groups</Link>
      <h1>Settings</h1>

      <ul className="card-list">
        <li>
          <Link to="/settings/import" className="card">
            <span className="card-title">Import from a spreadsheet</span>
            <span className="muted">Add many groups or students at once from a CSV file</span>
          </Link>
        </li>
      </ul>

      <section className="section">
        <button className="btn-secondary" onClick={() => supabase.auth.signOut()}>
          Log out
        </button>
      </section>
    </main>
  )
}
