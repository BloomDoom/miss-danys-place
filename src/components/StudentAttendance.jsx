import { Link } from 'react-router-dom'
import { useLoad } from '../lib/useLoad.js'
import { todayISO } from '../lib/format.js'
import { formatRate, loadAttendance } from '../lib/attendance.js'

// One line on the student screen: "Attendance this year: 90% (18 of 20 classes)".
export default function StudentAttendance({ student }) {
  const groupIds = [...new Set(student.enrollments.map((e) => e.group_id))]
  const today = todayISO()
  const result = useLoad(
    () => (groupIds.length ? loadAttendance(today.slice(0, 4) + '-01-01', today, groupIds) : Promise.resolve(null)),
    [student.id],
  )
  const mine = result.data?.students.find((s) => s.student.id === student.id)
  if (!mine) return null // no saved classes yet (or still loading): show nothing

  return (
    <p className="attendance-line">
      <strong>Attendance this year:</strong> {formatRate(mine.rate)} ({mine.classes - mine.absences} of {mine.classes}{' '}
      {mine.classes === 1 ? 'class' : 'classes'}) · <Link to="/insights">See all</Link>
    </p>
  )
}
