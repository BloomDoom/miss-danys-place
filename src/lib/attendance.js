// Attendance insights (asistencia): % per student and per group.
//
// Only classes where attendance was SAVED count. A class nobody saved
// tells us nothing (we don't know who came), so it's left out instead of
// being counted as "everyone present".
import { supabase } from './supabase.js'
import { unwrap } from './useLoad.js'
import { studentsOn } from './sessions.js'

// Loads and calculates attendance between two dates.
// Pass groupIds to only look at some groups (e.g. one student's groups).
export async function loadAttendance(from, to, groupIds = null) {
  let query = supabase
    .from('sessions')
    .select('id, group_id, date, groups(id, name)')
    .not('attendance_saved_at', 'is', null)
    .eq('cancelled', false)
    .gte('date', from)
    .lte('date', to)
  if (groupIds) query = query.in('group_id', groupIds)
  const sessions = await unwrap(query)
  if (sessions.length === 0) return computeAttendance([], [], [])

  const ids = [...new Set(sessions.map((s) => s.group_id))]
  const [enrollments, absences] = await Promise.all([
    unwrap(supabase.from('enrollments').select('student_id, group_id, start_date, end_date, students(id, name, active)').in('group_id', ids)),
    unwrap(supabase.from('absences').select('session_id, student_id').in('session_id', sessions.map((s) => s.id)).is('deleted_at', null)),
  ])
  return computeAttendance(sessions, enrollments, absences)
}

// The pure calculation (no database), so it can be tested.
// Returns:
//   students: [{ student, classes, absences, rate }]  most absences first
//   groups:   [{ group, classes, attended, expected, rate }]
//   overall:  { attended, expected, rate }
// rate = share of classes attended, 0–1 (null if there were no classes).
export function computeAttendance(sessions, enrollments, absences) {
  const byStudent = new Map()
  const byGroup = new Map()

  for (const session of sessions) {
    const absentIds = new Set(absences.filter((a) => a.session_id === session.id).map((a) => a.student_id))
    const roster = studentsOn(
      enrollments.filter((e) => e.group_id === session.group_id),
      session.date,
      absentIds,
    )
    const g = byGroup.get(session.group_id) || { group: session.groups, classes: 0, attended: 0, expected: 0 }
    g.classes++

    for (const student of roster) {
      const s = byStudent.get(student.id) || { student, classes: 0, absences: 0 }
      s.classes++
      g.expected++
      if (absentIds.has(student.id)) s.absences++
      else g.attended++
      byStudent.set(student.id, s)
    }
    byGroup.set(session.group_id, g)
  }

  const rate = (attended, total) => (total > 0 ? attended / total : null)
  const students = [...byStudent.values()]
    .map((s) => ({ ...s, rate: rate(s.classes - s.absences, s.classes) }))
    .sort((a, b) => b.absences - a.absences || a.rate - b.rate || a.student.name.localeCompare(b.student.name, 'es'))
  const groups = [...byGroup.values()]
    .map((g) => ({ ...g, rate: rate(g.attended, g.expected) }))
    .sort((a, b) => a.group.name.localeCompare(b.group.name, 'es'))
  const attended = groups.reduce((sum, g) => sum + g.attended, 0)
  const expected = groups.reduce((sum, g) => sum + g.expected, 0)

  return { students, groups, overall: { attended, expected, rate: rate(attended, expected) } }
}

// 0.9 → "90%"
export function formatRate(rate) {
  return rate === null ? '–' : `${Math.round(rate * 100)}%`
}
