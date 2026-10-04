// Trinity exams. They happen once a year, all in the same week, so the
// Exams tab shows one year at a time, ordered by exam level.
//
// An exam (table `exams`) is one level on one date and time. The students
// sitting it are rows in `trinity_exams`, each with their own result.

// Trinity College London levels, in order: GESE Grades 1–12, then ISE.
export const LEVELS = [
  ...Array.from({ length: 12 }, (_, i) => `GESE Grade ${i + 1}`),
  'ISE A1', 'ISE Foundation', 'ISE I', 'ISE II', 'ISE III', 'ISE IV',
]

// How Trinity reports results.
export const RESULTS = { fail: 'Fail', pass: 'Pass', merit: 'Merit', distinction: 'Distinction' }

// The year an exam (or an old entry without one) belongs to: its date, or
// when it was added if there's no date.
export function examYear(exam) {
  return Number((exam.exam_date || exam.created_at).slice(0, 4))
}

// Position of a level in LEVELS (unknown / no level go last).
function levelOrder(level) {
  const i = LEVELS.indexOf(level)
  return i === -1 ? LEVELS.length : i
}

// Exams in level order, then by date and time.
export function sortExams(exams) {
  return [...exams].sort(
    (a, b) =>
      levelOrder(a.level) - levelOrder(b.level) ||
      a.exam_date.localeCompare(b.exam_date) ||
      (a.exam_time || '').localeCompare(b.exam_time || ''),
  )
}

// The students in an exam (not removed), A–Z.
export function examStudents(exam) {
  return (exam.trinity_exams || [])
    .filter((t) => !t.deleted_at)
    .sort((a, b) => a.students.name.localeCompare(b.students.name, 'es'))
}
