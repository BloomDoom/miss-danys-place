import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { isConfigured, supabase } from './lib/supabase.js'
import { useOnline } from './lib/useOnline.js'
import Login from './screens/Login.jsx'
import Today from './screens/Today.jsx'
import Payments from './screens/Payments.jsx'
import Students from './screens/Students.jsx'
import Groups from './screens/Groups.jsx'
import Settings from './screens/Settings.jsx'
import TabBar from './components/TabBar.jsx'

export default function App() {
  // undefined = still checking, null = logged out, object = logged in
  const [session, setSession] = useState(undefined)
  const online = useOnline()

  useEffect(() => {
    if (!isConfigured) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    // Runs whenever she logs in or out (or the login is renewed).
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (!isConfigured) {
    return (
      <main className="screen center">
        <p>The app isn't connected to its database yet.</p>
        <p className="muted">Developer: copy .env.example to .env and fill in the Supabase values.</p>
      </main>
    )
  }

  if (session === undefined) {
    return <main className="screen center"><p className="muted">Loading…</p></main>
  }

  return (
    <>
      {!online && (
        <div className="offline-banner" role="alert">
          No internet. Connect to Wi-Fi to see and save your data.
        </div>
      )}

      {session === null ? (
        <Login />
      ) : (
        <>
          <Routes>
            <Route path="/" element={<Today />} />
            <Route path="/payments" element={<Payments />} />
            <Route path="/students" element={<Students />} />
            <Route path="/groups" element={<Groups />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <TabBar />
        </>
      )}
    </>
  )
}
