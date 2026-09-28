// Student helpers: contacts and age.
//
// Each student has one or more contacts (mum, dad, or the student
// themselves) in the student_contacts table. The first contact with a
// phone is the "main" one: birthday and group messages go there.
import { supabase } from './supabase.js'
import { unwrap } from './useLoad.js'
import { todayISO } from './format.js'

export const EMPTY_CONTACT = { name: '', phone: '' }

// Load contacts with: .select('*, student_contacts(*)')
export function sortedContacts(student) {
  return [...(student.student_contacts || [])].sort((a, b) => a.position - b.position)
}

export function mainContact(student) {
  return sortedContacts(student).find((c) => c.phone) || null
}

// Trims the typed contacts and drops completely empty rows.
export function cleanContacts(contacts) {
  return contacts
    .map((c) => ({ name: (c.name || '').trim(), phone: (c.phone || '').trim() }))
    .filter((c) => c.name || c.phone)
}

// "At least one contact" means at least one phone number to call.
export function hasPhone(contacts) {
  return cleanContacts(contacts).some((c) => c.phone)
}

// Replaces a student's contacts with `contacts`. The new ones are saved
// first and the old ones removed after, so a failed save never leaves the
// student with no contacts. A contact without a name gets the student's.
export async function saveContacts(studentId, studentName, contacts, oldIds = []) {
  const rows = cleanContacts(contacts).map((c, i) => ({
    student_id: studentId,
    name: c.name || studentName,
    phone: c.phone || null,
    position: i + 1,
  }))
  if (rows.length > 0) await unwrap(supabase.from('student_contacts').insert(rows))
  if (oldIds.length > 0) await unwrap(supabase.from('student_contacts').delete().in('id', oldIds))
}

// Age in whole years on a date (today by default). null without a birth date.
export function ageOn(birthDate, date = todayISO()) {
  if (!birthDate) return null
  const [by, bm, bd] = birthDate.split('-').map(Number)
  const [y, m, d] = date.split('-').map(Number)
  const hadBirthday = m > bm || (m === bm && d >= bd)
  return y - by - (hadBirthday ? 0 : 1)
}
