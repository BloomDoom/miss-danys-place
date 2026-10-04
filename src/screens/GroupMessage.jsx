import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { unwrap, useLoad } from '../lib/useLoad.js'
import { currentEnrollments } from '../lib/groups.js'
import LoadState from '../components/LoadState.jsx'
import BackButton from '../components/BackButton.jsx'
import BroadcastMessage from '../components/BroadcastMessage.jsx'

async function loadGroup(id) {
  const group = await unwrap(
    supabase.from('groups').select('id, name, enrollments(end_date, students(id, name, phone, active, student_contacts(*)))').eq('id', id).single(),
  )
  const students = currentEnrollments(group.enrollments)
    .map((e) => e.students)
    .filter((s) => s.active)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  return { group, students }
}

// A message to every family in a group.
export default function GroupMessage() {
  const { id } = useParams()
  const result = useLoad(() => loadGroup(id), [id])

  return (
    <main className="screen">
      <BackButton fallback={`/groups/${id}`} />
      <LoadState {...result} />
      {result.data && (
        <>
          <h1>Message {result.data.group.name}</h1>
          <BroadcastMessage
            listName={result.data.group.name}
            draftKey={`group-message-${id}`}
            listKey={`broadcast-list-${id}`}
            students={result.data.students}
          />
        </>
      )}
    </main>
  )
}
