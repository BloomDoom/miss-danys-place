import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { unwrap, useLoad } from '../lib/useLoad.js'
import { formatDate, todayISO } from '../lib/format.js'
import { currentEnrollments } from '../lib/groups.js'
import { callLink, whatsappLink } from '../lib/phone.js'
import { saveErrorMessage } from '../lib/errors.js'
import { useToast } from '../components/Toast.jsx'
import LoadState from '../components/LoadState.jsx'
import StudentFields, { cleanStudent } from '../components/StudentFields.jsx'

async function loadStudent(id) {
  const [student, groups] = await Promise.all([
    unwrap(supabase.from('students').select('*, enrollments(id, group_id, end_date, groups(id, name))').eq('id', id).single()),
    unwrap(supabase.from('groups').select('id, name').eq('active', true).order('name')),
  ])
  return { student, groups }
}

export default function StudentDetail() {
  const { id } = useParams()
  const result = useLoad(() => loadStudent(id), [id])
  const [editing, setEditing] = useState(false)

  return (
    <main className="screen">
      <Link to="/students" className="back-link">‹ Students</Link>
      <LoadState {...result} />
      {result.data &&
        (editing ? (
          <EditStudent
            {...result.data}
            onDone={() => {
              setEditing(false)
              result.reload()
            }}
          />
        ) : (
          <ViewStudent student={result.data.student} onEdit={() => setEditing(true)} reload={result.reload} />
        ))}
    </main>
  )
}

function ViewStudent({ student, onEdit, reload }) {
  const showToast = useToast()
  const [error, setError] = useState('')
  const groups = currentEnrollments(student.enrollments).map((e) => e.groups)

  async function setActive(active) {
    setError('')
    try {
      await unwrap(supabase.from('students').update({ active }).eq('id', student.id))
      reload()
      return true
    } catch (err) {
      setError(saveErrorMessage(err))
      return false
    }
  }

  async function toggleActive() {
    const active = !student.active
    if (await setActive(active)) {
      showToast(active ? `${student.name} is active again` : `${student.name} deactivated`, () => setActive(!active))
    }
  }

  return (
    <>
      <h1>
        {student.name}
        {!student.active && <span className="badge">Inactive</span>}
      </h1>

      <p>
        {groups.length === 0
          ? 'Not in a group'
          : groups.map((g, i) => (
              <span key={g.id}>
                {i > 0 && ', '}
                <Link to={`/groups/${g.id}`}>{g.name}</Link>
              </span>
            ))}
      </p>

      {student.phone && <Contact label="Phone" phone={student.phone} />}
      {(student.guardian_name || student.guardian_phone) && (
        <Contact label={`Parent${student.guardian_name ? ': ' + student.guardian_name : ''}`} phone={student.guardian_phone} />
      )}

      {student.notes && (
        <section className="section">
          <h2>Notes</h2>
          <p className="notes">{student.notes}</p>
        </section>
      )}
      <p className="muted">Started on {formatDate(student.start_date)}</p>

      <section className="section stack">
        <button className="btn-secondary" onClick={onEdit}>Edit details</button>
        <button className="btn-secondary" onClick={toggleActive}>
          {student.active ? 'Deactivate student' : 'Make student active again'}
        </button>
        {student.active && <p className="muted">Deactivate students who stop coming. Their history is kept.</p>}
        {error && <p className="error" role="alert">{error}</p>}
      </section>
    </>
  )
}

// A phone number with big Call and WhatsApp buttons.
function Contact({ label, phone }) {
  const whatsapp = phone && whatsappLink(phone)
  return (
    <section className="contact">
      <p>
        <strong>{label}</strong>
        {phone && <span className="muted"> · {phone}</span>}
      </p>
      {phone && (
        <div className="btn-row">
          <a className="btn-secondary" href={callLink(phone)}>Call</a>
          {whatsapp && <a className="btn-secondary" href={whatsapp} target="_blank" rel="noreferrer">WhatsApp</a>}
        </div>
      )}
    </section>
  )
}

function EditStudent({ student, groups, onDone }) {
  const [values, setValues] = useState({
    name: student.name,
    phone: student.phone,
    guardian_name: student.guardian_name,
    guardian_phone: student.guardian_phone,
    notes: student.notes,
    start_date: student.start_date,
  })
  const current = currentEnrollments(student.enrollments)
  const [groupIds, setGroupIds] = useState(current.map((e) => e.group_id))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const toggleGroup = (id) =>
    setGroupIds(groupIds.includes(id) ? groupIds.filter((g) => g !== id) : [...groupIds, id])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await unwrap(supabase.from('students').update(cleanStudent(values)).eq('id', student.id))

      // Groups she unticked: end the enrollment today (keeps the history).
      const removed = current.filter((e) => !groupIds.includes(e.group_id)).map((e) => e.id)
      if (removed.length > 0) {
        await unwrap(supabase.from('enrollments').update({ end_date: todayISO() }).in('id', removed))
      }
      // Groups she ticked: start a new enrollment today.
      const added = groupIds.filter((id) => !current.some((e) => e.group_id === id))
      if (added.length > 0) {
        await unwrap(
          supabase.from('enrollments').insert(added.map((group_id) => ({ student_id: student.id, group_id, start_date: todayISO() }))),
        )
      }
      onDone()
    } catch (err) {
      setError(saveErrorMessage(err))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>Edit {student.name}</h1>
      <StudentFields values={values} onChange={setValues} />

      <fieldset>
        <legend>Groups</legend>
        {groups.map((g) => (
          <label key={g.id} className="checkbox-row">
            <input type="checkbox" checked={groupIds.includes(g.id)} onChange={() => toggleGroup(g.id)} />
            {g.name}
          </label>
        ))}
      </fieldset>

      {error && <p className="error" role="alert">{error}</p>}
      <div className="btn-row">
        <button type="button" className="btn-secondary" onClick={onDone}>Cancel</button>
        <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      </div>
    </form>
  )
}
