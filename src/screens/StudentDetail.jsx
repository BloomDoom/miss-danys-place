import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { unwrap, useLoad } from '../lib/useLoad.js'
import { formatDate, todayISO } from '../lib/format.js'
import { currentEnrollments } from '../lib/groups.js'
import { callLink, whatsappLink } from '../lib/phone.js'
import { EMPTY_CONTACT, ageOn, hasPhone, saveContacts, sortedContacts } from '../lib/students.js'
import { saveErrorMessage } from '../lib/errors.js'
import { useToast } from '../components/Toast.jsx'
import LoadState from '../components/LoadState.jsx'
import StudentFields, { cleanStudent } from '../components/StudentFields.jsx'
import StudentPayments from '../components/StudentPayments.jsx'
import StudentAbsences from '../components/StudentAbsences.jsx'
import BackButton from '../components/BackButton.jsx'

async function loadStudent(id) {
  const [student, groups] = await Promise.all([
    unwrap(
      supabase.from('students').select('*, student_contacts(*), enrollments(id, group_id, end_date, groups(id, name))').eq('id', id).single(),
    ),
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
      <BackButton fallback="/students" />
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
          <>
            <ViewStudent student={result.data.student} onEdit={() => setEditing(true)} reload={result.reload} />
            <StudentPayments studentId={result.data.student.id} />
            <StudentAbsences studentId={result.data.student.id} />
          </>
        ))}
    </main>
  )
}

function ViewStudent({ student, onEdit, reload }) {
  const showToast = useToast()
  const [error, setError] = useState('')
  const groups = currentEnrollments(student.enrollments).map((e) => e.groups)
  const contacts = sortedContacts(student)
  const age = ageOn(student.birth_date)

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

      <p className="group-links">
        {groups.length === 0
          ? 'Not in a group'
          : groups.map((g, i) => (
              <span key={g.id}>
                {i > 0 && ', '}
                <Link to={`/groups/${g.id}`}>{g.name}</Link>
              </span>
            ))}
      </p>

      {(age !== null || student.school) && (
        <p>
          {age !== null && `${age} years old (born ${formatDate(student.birth_date)})`}
          {age !== null && student.school && ' · '}
          {student.school}
        </p>
      )}

      {contacts.length === 0 ? (
        <p className="empty">No contacts yet. Tap “Edit details” to add a phone number.</p>
      ) : (
        contacts.map((c) => <Contact key={c.id} label={c.name} phone={c.phone} />)
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
    birth_date: student.birth_date,
    school: student.school,
    notes: student.notes,
    start_date: student.start_date,
  })
  const oldContacts = sortedContacts(student)
  const [contacts, setContacts] = useState(
    oldContacts.length > 0 ? oldContacts.map((c) => ({ name: c.name, phone: c.phone || '' })) : [EMPTY_CONTACT],
  )
  const current = currentEnrollments(student.enrollments)
  const [groupIds, setGroupIds] = useState(current.map((e) => e.group_id))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const toggleGroup = (id) =>
    setGroupIds(groupIds.includes(id) ? groupIds.filter((g) => g !== id) : [...groupIds, id])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!hasPhone(contacts)) return setError('Add at least one contact with a phone number.')
    setBusy(true)
    try {
      const clean = cleanStudent(values)
      await unwrap(supabase.from('students').update(clean).eq('id', student.id))
      await saveContacts(student.id, clean.name, contacts, oldContacts.map((c) => c.id))

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
      <StudentFields values={values} onChange={setValues} contacts={contacts} onContactsChange={setContacts} />

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
