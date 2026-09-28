import { useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { unwrap, useLoad } from '../lib/useLoad.js'
import { todayISO } from '../lib/format.js'
import { EMPTY_CONTACT, hasPhone, saveContacts } from '../lib/students.js'
import { saveErrorMessage } from '../lib/errors.js'
import LoadState from '../components/LoadState.jsx'
import StudentFields, { EMPTY_STUDENT, cleanStudent } from '../components/StudentFields.jsx'

function loadGroups() {
  return unwrap(supabase.from('groups').select('id, name').eq('active', true).order('name'))
}

// Quick-add: after saving, the form clears but stays open (keeping the
// group and start date), so you can type a whole class in a row.
// Only the essentials are visible; the rest is under "More details".
export default function StudentNew() {
  const [params] = useSearchParams()
  const result = useLoad(loadGroups, [])
  const [values, setValues] = useState({ ...EMPTY_STUDENT, start_date: todayISO() })
  const [contacts, setContacts] = useState([EMPTY_CONTACT])
  const [groupId, setGroupId] = useState(params.get('group') || '')
  const [added, setAdded] = useState([]) // students saved on this visit
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const nameRef = useRef(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!hasPhone(contacts)) return setError('Add at least one contact with a phone number.')
    setBusy(true)
    try {
      const student = await unwrap(supabase.from('students').insert(cleanStudent(values)).select().single())
      await saveContacts(student.id, student.name, contacts)
      if (groupId) {
        await unwrap(
          supabase.from('enrollments').insert({ student_id: student.id, group_id: Number(groupId), start_date: values.start_date }),
        )
      }
      setAdded([student, ...added])
      setValues({ ...EMPTY_STUDENT, start_date: values.start_date })
      setContacts([EMPTY_CONTACT])
      nameRef.current?.focus()
      window.scrollTo(0, 0)
    } catch (err) {
      setError(saveErrorMessage(err))
    }
    setBusy(false)
  }

  return (
    <main className="screen">
      <Link to="/students" className="back-link">‹ Students</Link>
      <h1>Add students</h1>
      <LoadState {...result} />

      {added.length > 0 && (
        <p className="success" role="status">
          ✓ {added[0].name} added{added.length > 1 && ` (${added.length} so far)`}. Type the next one.
        </p>
      )}

      {result.data && (
        <form onSubmit={handleSubmit}>
          <label>
            Group
            <select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              <option value="">No group</option>
              {result.data.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </label>
          <StudentFields
            values={values}
            onChange={setValues}
            contacts={contacts}
            onContactsChange={setContacts}
            nameRef={nameRef}
            compact
          />
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save and add another'}
          </button>
        </form>
      )}

      {added.length > 0 && (
        <section className="section">
          <h2>Added just now ({added.length})</h2>
          <ul className="row-list">
            {added.map((s) => (
              <li key={s.id}>
                <Link to={`/students/${s.id}`} className="row-link">✓ {s.name}</Link>
              </li>
            ))}
          </ul>
          <Link to="/students" className="btn-secondary">Done</Link>
        </section>
      )}
    </main>
  )
}
