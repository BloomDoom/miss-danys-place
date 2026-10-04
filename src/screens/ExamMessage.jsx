import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { unwrap, useLoad } from '../lib/useLoad.js'
import { formatDay, formatTime } from '../lib/format.js'
import { examStudents } from '../lib/exams.js'
import LoadState from '../components/LoadState.jsx'
import BackButton from '../components/BackButton.jsx'
import BroadcastMessage from '../components/BroadcastMessage.jsx'

function loadExam(id) {
  return unwrap(
    supabase
      .from('exams')
      .select('*, trinity_exams(id, deleted_at, students(id, name, phone, student_contacts(*)))')
      .eq('id', id)
      .single(),
  )
}

// A message to the families of everyone sitting an exam.
export default function ExamMessage() {
  const { id } = useParams()
  const result = useLoad(() => loadExam(id), [id])
  const exam = result.data

  return (
    <main className="screen">
      <BackButton fallback={`/exams/${id}`} />
      <LoadState {...result} />
      {exam && (
        <>
          <h1>Message {exam.level} parents</h1>
          <BroadcastMessage
            listName={`Trinity ${exam.level}`}
            draftKey={`exam-message-${id}`}
            listKey={`broadcast-list-exam-${id}`}
            students={examStudents(exam).map((t) => t.students)}
            defaultText={`Hi! Reminder: the Trinity ${exam.level} exam is on ${formatDay(exam.exam_date)}${
              exam.exam_time ? ` at ${formatTime(exam.exam_time)}` : ''
            }.`}
          />
        </>
      )}
    </main>
  )
}
