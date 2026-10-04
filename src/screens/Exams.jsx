import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { unwrap, useLoad } from '../lib/useLoad.js'
import { formatDay, formatTime, todayISO } from '../lib/format.js'
import { RESULTS, examStudents, examYear, sortExams } from '../lib/exams.js'
import { useToast } from '../components/Toast.jsx'
import LoadState from '../components/LoadState.jsx'
import EmptyState from '../components/EmptyState.jsx'
import ExamForm from '../components/ExamForm.jsx'

async function loadExams() {
  const [exams, unlinked] = await Promise.all([
    unwrap(supabase.from('exams').select('*, trinity_exams(id, result, deleted_at, students(id, name))').is('deleted_at', null)),
    // Entries saved before exams had their own date and level.
    unwrap(supabase.from('trinity_exams').select('*, students(id, name)').is('exam_id', null).is('deleted_at', null)),
  ])
  return { exams, unlinked }
}

export default function Exams() {
  // The year lives in the URL (/exams?year=2025) so coming back from an
  // exam returns to the same year.
  const [params, setParams] = useSearchParams()
  const thisYear = Number(todayISO().slice(0, 4))
  const year = Number(params.get('year')) || thisYear
  const goTo = (y) => setParams(y === thisYear ? {} : { year: String(y) }, { replace: true })

  const navigate = useNavigate()
  const showToast = useToast()
  const result = useLoad(loadExams, [])
  const [adding, setAdding] = useState(false)

  const exams = sortExams(result.data?.exams.filter((e) => examYear(e) === year) ?? [])
  const unlinked = (result.data?.unlinked.filter((t) => examYear(t) === year) ?? []).sort((a, b) =>
    a.students.name.localeCompare(b.students.name, 'es'),
  )
  // Everyone sits in the same week, so a new exam starts on the date
  // already used this year (the most common one).
  const usualDate = mostCommon(exams.map((e) => e.exam_date))

  async function create(fields) {
    const exam = await unwrap(supabase.from('exams').insert(fields).select().single())
    showToast('Exam created. Now add the students.')
    navigate(`/exams/${exam.id}`)
  }

  return (
    <main className="screen">
      <header className="day-nav">
        <button className="btn-icon" onClick={() => goTo(year - 1)} aria-label="Previous year">‹</button>
        <div>
          <h1>Trinity exams</h1>
          <p className="muted">{year}</p>
        </div>
        <button className="btn-icon" onClick={() => goTo(year + 1)} aria-label="Next year" disabled={year > thisYear}>›</button>
      </header>
      <LoadState {...result} />

      {result.data && (
        <>
          {adding ? (
            <ExamForm initial={{ exam_date: usualDate }} submitLabel="Create exam" onSave={create} onCancel={() => setAdding(false)} />
          ) : (
            <button className="btn-primary" onClick={() => setAdding(true)}>+ New exam</button>
          )}

          {exams.length === 0 && unlinked.length === 0 && !adding && (
            <EmptyState emoji="📚" title={`No exams in ${year} yet`}>
              Tap “New exam”, choose the exam, date and time, then add all its students at once.
            </EmptyState>
          )}

          <ul className="card-list">
            {exams.map((exam) => {
              const count = examStudents(exam).length
              return (
                <li key={exam.id}>
                  <Link to={`/exams/${exam.id}`} className="card">
                    <span className="card-title">{exam.level} ›</span>
                    <span>
                      {formatDay(exam.exam_date)}
                      {exam.exam_time && ` · ${formatTime(exam.exam_time)}`}
                    </span>
                    <span className="muted">{count === 0 ? 'No students yet' : count === 1 ? '1 student' : `${count} students`}</span>
                  </Link>
                </li>
              )
            })}
          </ul>

          {unlinked.length > 0 && (
            <section className="section">
              <h2>Not in an exam yet</h2>
              <p className="muted">Saved before exams had a level and date. Tap one to give it a result or remove it.</p>
              <ul className="card-list">
                {unlinked.map((t) => (
                  <li key={t.id}>
                    <Link to={`/exams/entry/${t.id}`} className="card">
                      <span className="card-title">{t.students.name} ›</span>
                      <span className="muted">
                        {t.level || 'No level'}
                        {' · '}
                        {t.result ? <strong className={`result-${t.result}`}>{RESULTS[t.result]}</strong> : 'Result: –'}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </main>
  )
}

function mostCommon(values) {
  const counts = {}
  for (const v of values) counts[v] = (counts[v] || 0) + 1
  return Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || ''
}
