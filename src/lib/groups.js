// Small helpers about groups, used by several screens.
import { formatTime, weekdayName } from './format.js'

// Active weekly times, sorted Monday→Sunday, then by time.
export function activeSlots(slots) {
  return slots
    .filter((s) => s.active)
    .sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time))
}

// "Tue 18:00 · Thu 18:00"
export function slotsSummary(slots) {
  const active = activeSlots(slots)
  if (active.length === 0) return 'No class times yet'
  return active.map((s) => `${weekdayName(s.weekday).slice(0, 3)} ${formatTime(s.start_time)}`).join(' · ')
}

// Enrollments that are still going (the student hasn't left the group).
export function currentEnrollments(enrollments) {
  return enrollments.filter((e) => !e.end_date)
}

// For searching: lowercase and without accents, so "jose" finds "José".
export function normalize(text) {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
}
