import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { unwrap, useLoad } from '../lib/useLoad.js'
import { currentEnrollments, normalize } from '../lib/groups.js'
import { loadPendingMakeups } from '../lib/makeups.js'
import { nameClass } from '../lib/students.js'
import LoadState from '../components/LoadState.jsx'
import EmptyState from '../components/EmptyState.jsx'
import MakeupBanner from '../components/MakeupBanner.jsx'

async function loadStudents() {
  const [students, groups, pending] = await Promise.all([
    unwrap(supabase.from('students').select('*, enrollments(group_id, end_date, groups(name))')),
    unwrap(supabase.from('groups').select('id, name').eq('active', true).order('name')),
    loadPendingMakeups(),
  ])
  students.sort((a, b) => a.name.localeCompare(b.name, 'es'))
  return { students, groups, pending }
}

// [['A', [Ana, Andrés]], ['B', [Beto]], ...]. Accents don't matter (Á → A).
function byLetter(students) {
  const groups = new Map()
  for (const s of students) {
    const letter = normalize(s.name).charAt(0).toUpperCase() || '#'
    if (!groups.has(letter)) groups.set(letter, [])
    groups.get(letter).push(s)
  }
  return [...groups.entries()]
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
          <MakeupBanner pending={result.data.pending} />
          <Link to="/insights" className="makeup-banner">
            <span><strong>Attendance</strong> · who is missing classes</span>
            <span aria-hidden="true">›</span>
          </Link>

          {/* Pinned at the top while scrolling, so search and "+ Add" are always at hand */}
          <div className="filters">
            <div className="filters-row">
              <input
                type="search"
                placeholder="Search by name"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search by name"
              />
              <Link to="/students/new" className="btn-primary btn-add" aria-label="Add students">+ Add</Link>
            </div>
            <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Which students">
              <option value="active">All students ({result.data.students.filter((s) => s.active).length})</option>
              {result.data.groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
              <option value="inactive">Inactive students</option>
            </select>
          </div>

          {result.data.students.length === 0 ? (
            <EmptyState emoji="👋" title="No students yet">Tap “+ Add” to welcome your first students.</EmptyState>
          ) : students.length === 0 ? (
            <EmptyState emoji="🔍" title="Nobody found">Check the spelling, or pick another group.</EmptyState>
          ) : (
            // Grouped by first letter (A, B, C…) so the list is easy to scan.
            byLetter(students).map(([letter, list]) => (
              <section key={letter} aria-label={letter}>
                <h2 className="letter-header">{letter}</h2>
                <ul className="card-list">
                  {list.map((s) => (
                    <li key={s.id}>
                      <Link to={`/students/${s.id}`} className="card">
                        <span className={`card-title ${nameClass(s)}`}>{s.name}</span>
                        <span className="muted">
                          {currentEnrollments(s.enrollments).map((e) => e.groups.name).join(', ') || 'No group'}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </>
      )}
    </main>
  )
}
