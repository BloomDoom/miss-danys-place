import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'

export default function Settings() {
  return (
    <main className="screen">
      <Link to="/groups" className="back-link">‹ Groups</Link>
      <h1>Settings</h1>
      <p className="empty">Payment due day and backups will be here.</p>
      <button className="btn-secondary" onClick={() => supabase.auth.signOut()}>
        Log out
      </button>
    </main>
  )
}
