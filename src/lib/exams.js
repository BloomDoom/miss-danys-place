// Trinity exams. They happen once a year, all in the same week, so the
// Exams tab shows one year at a time, ordered by exam level.

// Trinity College London levels, in order: GESE Grades 1–12, then ISE.
export const LEVELS = [
  ...Array.from({ length: 12 }, (_, i) => `GESE Grade ${i + 1}`),
  'ISE Foundation', 'ISE I', 'ISE II', 'ISE III', 'ISE IV',
]

// How Trinity reports results.
export const RESULTS = { fail: 'Fail', pass: 'Pass', merit: 'Merit', distinction: 'Distinction' }

// The year an exam belongs to: its date, or when it was added if there's
// no date yet.
export function examYear(exam) {
  return Number((exam.exam_date || exam.created_at).slice(0, 4))
}

// Position of a level in LEVELS (unknown / no level go last).
function levelOrder(level) {
  const i = LEVELS.indexOf(level)
  return i === -1 ? LEVELS.length : i
}

// Groups exams by level, in level order, names A–Z inside each level:
// [['GESE Grade 1', [exam, exam]], ..., [null, [exams without a level]]]
export function groupByLevel(exams) {
  const sorted = [...exams].sort(
    (a, b) => levelOrder(a.level) - levelOrder(b.level) || a.students.name.localeCompare(b.students.name, 'es'),
  )
  const groups = new Map()
  for (const exam of sorted) {
    const key = LEVELS.includes(exam.level) ? exam.level : null
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(exam)
  }
  return [...groups.entries()]
}
