import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { unwrap, useLoad } from '../lib/useLoad.js'
import { currentEnrollments, normalize } from '../lib/groups.js'
import LoadState from '../components/LoadState.jsx'

async function loadStudents() {
  const [students, groups] = await Promise.all([
    unwrap(supabase.from('students').select('*, enrollments(group_id, end_date, groups(name))')),
    unwrap(supabase.from('groups').select('id, name').eq('active', true).order('name')),
  ])
  students.sort((a, b) => a.name.localeCompare(b.name, 'es'))
  return { students, groups }
}

export default function Students() {
  const result = useLoad(loadStudents, [])
  const [search, setSearch] = useState('')
  // "active" = all active students, "inactive", or a group id
  const [filter, setFilter] = useState('active')

  let students = []
  if (result.data) {
    students = result.data.students.filter((s) => {
      if (filter === 'inactive') return !s.active
      if (!s.active) return false
      if (filter === 'active') return true
      return currentEnrollments(s.enrollments).some((e) => String(e.group_id) === filter)
    })
    if (search) students = students.filter((s) => normalize(s.name).includes(normalize(search)))
  }

  return (
    <main className="screen">
      <h1>Students</h1>
      <LoadState {...result} />

      {result.data && (
        <>
          <Link to="/students/new" className="btn-primary">+ Add students</Link>

          <div className="filters">
            <input
              type="search"
              placeholder="Search by name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search by name"
            />
            <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Which students">
              <option value="active">All students</option>
              {result.data.groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
              <option value="inactive">Inactive students</option>
            </select>
          </div>

          {result.data.students.length === 0 ? (
            <p className="empty">No students yet. Tap “Add students” to add your first ones.</p>
          ) : students.length === 0 ? (
            <p className="empty">No students match. Try another name or group.</p>
          ) : (
            <ul className="card-list">
              {students.map((s) => (
                <li key={s.id}>
                  <Link to={`/students/${s.id}`} className="card">
                    <span className="card-title">{s.name}</span>
                    <span className="muted">
                      {currentEnrollments(s.enrollments).map((e) => e.groups.name).join(', ') || 'No group'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  )
}
