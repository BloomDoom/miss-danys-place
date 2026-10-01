import { useLoad } from '../lib/useLoad.js'
import { loadStudentAbsences } from '../lib/makeups.js'
import LoadState from './LoadState.jsx'
import EmptyState from './EmptyState.jsx'
import MakeupCard from './MakeupCard.jsx'

// A student's absences, newest first, each with its make-up status.
export default function StudentAbsences({ studentId }) {
  const result = useLoad(() => loadStudentAbsences(studentId), [studentId])

  return (
    <section className="section">
      <h2>Absences and make-ups</h2>
      <LoadState {...result} />
      {result.data?.length === 0 && <EmptyState emoji="⭐" title="Never missed a class!" />}
      <ul className="card-list">
        {result.data?.map((a) => (
          <li key={a.id}>
            <MakeupCard absence={a} onChanged={result.reload} />
          </li>
        ))}
      </ul>
    </section>
  )
}
