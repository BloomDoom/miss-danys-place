import { EMPTY_CONTACT } from '../lib/students.js'

// The fields of a student, shared by the quick-add and edit screens.
//   values   = { name, birth_date, school, start_date, notes }
//   contacts = [{ name, phone }, ...]  (at least one with a phone)
// compact = quick-add: the less-used fields go under "More details".

export const EMPTY_STUDENT = { name: '', birth_date: '', school: '', notes: '' }

// Empty text becomes null in the database instead of "".
export function cleanStudent(values) {
  const clean = {}
  for (const [key, value] of Object.entries(values)) {
    clean[key] = typeof value === 'string' ? value.trim() || null : value
  }
  return clean
}

export default function StudentFields({ values, onChange, contacts, onContactsChange, nameRef, compact }) {
  const field = (key) => ({
    value: values[key] ?? '',
    onChange: (e) => onChange({ ...values, [key]: e.target.value }),
  })

  const moreFields = (
    <>
      <label>
        School <span className="optional">(optional)</span>
        <input {...field('school')} autoCapitalize="words" />
      </label>
      <label>
        Started on
        <input {...field('start_date')} type="date" required />
      </label>
      <label>
        Notes <span className="optional">(optional)</span>
        <textarea {...field('notes')} rows={2} />
      </label>
    </>
  )

  return (
    <>
      <label>
        Name
        <input {...field('name')} ref={nameRef} autoCapitalize="words" required />
      </label>
      <label>
        Birth date <span className="optional">(for birthdays and exams)</span>
        <input {...field('birth_date')} type="date" />
      </label>
      <ContactsEditor contacts={contacts} onChange={onContactsChange} />
      {compact ? (
        <details className="more-details">
          <summary>More details (school, notes…)</summary>
          {moreFields}
        </details>
      ) : (
        moreFields
      )}
    </>
  )
}

function ContactsEditor({ contacts, onChange }) {
  const set = (i, key, value) => onChange(contacts.map((c, j) => (j === i ? { ...c, [key]: value } : c)))

  return (
    <fieldset className="contacts-editor">
      <legend>
        Contacts <span className="optional">(at least one phone)</span>
      </legend>
      {contacts.map((c, i) => (
        <div key={i} className="slot-box">
          <label>
            {contacts.length > 1 ? `Contact ${i + 1}: name` : 'Contact name'}
            <input
              value={c.name}
              onChange={(e) => set(i, 'name', e.target.value)}
              placeholder={i === 0 ? 'e.g. Laura (mum), or the student' : 'e.g. Carlos (dad)'}
              autoCapitalize="words"
            />
          </label>
          <label>
            Phone / WhatsApp
            <input type="tel" value={c.phone} onChange={(e) => set(i, 'phone', e.target.value)} placeholder="e.g. 11 5555-1234" />
          </label>
          {contacts.length > 1 && (
            <button type="button" className="btn-text" onClick={() => onChange(contacts.filter((_, j) => j !== i))}>
              Remove this contact
            </button>
          )}
        </div>
      ))}
      <button type="button" className="btn-secondary" onClick={() => onChange([...contacts, EMPTY_CONTACT])}>
        + Add another contact
      </button>
    </fieldset>
  )
}
