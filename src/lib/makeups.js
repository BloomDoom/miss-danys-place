// Make-ups: every absence has a make-up status.
//   missed    → needs a make-up class
//   scheduled → booked into a class (makeup_session_id), of any group
//   done      → attended the make-up class
//   waived    → no make-up needed
import { supabase } from './supabase.js'
import { unwrap } from './useLoad.js'
import { todayISO } from './format.js'

// absences points at `sessions` twice (the missed class and the make-up
// class), so we say which link we mean by the constraint name.
const FIELDS = `*,
  students(id, name, active),
  session:sessions!absences_session_id_fkey(id, date, start_time, group_id, groups(id, name)),
  makeup:sessions!absences_makeup_session_id_fkey(id, date, start_time, cancelled, groups(id, name))`

const byMissedDate = (a, b) => a.session.date.localeCompare(b.session.date)

// Absences still waiting for a make-up (active students only).
export async function loadPendingMakeups() {
  const list = await unwrap(
    supabase.from('absences').select(FIELDS).is('deleted_at', null).in('makeup_status', ['missed', 'scheduled']),
  )
  return list.filter((a) => a.students.active).sort(byMissedDate)
}

export async function loadStudentAbsences(studentId) {
  const list = await unwrap(supabase.from('absences').select(FIELDS).eq('student_id', studentId).is('deleted_at', null))
  return list.sort(byMissedDate).reverse() // newest first
}

// Make-up students booked into a class (for its attendance list).
export function loadMakeupsFor(sessionId) {
  return unwrap(
    supabase.from('absences').select(FIELDS).eq('makeup_session_id', sessionId).is('deleted_at', null).in('makeup_status', ['scheduled', 'done']),
  )
}

export function updateMakeup(absenceId, changes) {
  return unwrap(supabase.from('absences').update(changes).eq('id', absenceId))
}

// What the screen should show for an absence. Like makeup_status, plus:
//   'check'     → the make-up date has passed but attendance wasn't saved: did they come?
//   'cancelled' → the make-up class was cancelled: pick another one
export function makeupState(absence) {
  if (absence.makeup_status !== 'scheduled') return absence.makeup_status
  if (!absence.makeup || absence.makeup.cancelled) return 'cancelled'
  if (absence.makeup.date < todayISO()) return 'check'
  return 'scheduled'
}
