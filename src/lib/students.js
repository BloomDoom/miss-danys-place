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

// ───────── Birthdays

const isLeapYear = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0

// The date of someone's birthday in a given year. Born on Feb 29 → their
// birthday is Feb 28 in years without a Feb 29.
export function birthdayIn(birthDate, year) {
  const [, m, d] = birthDate.split('-')
  if (m === '02' && d === '29' && !isLeapYear(year)) return `${year}-02-28`
  return `${year}-${m}-${d}`
}

// Birthdays between two dates (both included, less than a year apart),
// sorted by date: [{ student, date, turning }]. `turning` = the new age.
export function birthdaysBetween(students, from, to) {
  const years = [...new Set([Number(from.slice(0, 4)), Number(to.slice(0, 4))])]
  const list = []
  for (const student of students) {
    if (!student.birth_date) continue
    for (const year of years) {
      const date = birthdayIn(student.birth_date, year)
      if (date >= from && date <= to) {
        list.push({ student, date, turning: year - Number(student.birth_date.slice(0, 4)) })
      }
    }
  }
  return list.sort((a, b) => a.date.localeCompare(b.date) || a.student.name.localeCompare(b.student.name, 'es'))
}

// A message template with {name} replaced by the student's first name.
export function fillMessage(template, student) {
  const firstName = student.name.trim().split(/\s+/)[0]
  return template.replaceAll('{name}', firstName)
}

// Age in whole years on a date (today by default). null without a birth date.
export function ageOn(birthDate, date = todayISO()) {
  if (!birthDate) return null
  const [by, bm, bd] = birthDate.split('-').map(Number)
  const [y, m, d] = date.split('-').map(Number)
  const hadBirthday = m > bm || (m === bm && d >= bd)
  return y - by - (hadBirthday ? 0 : 1)
}
