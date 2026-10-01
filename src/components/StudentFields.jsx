import { EMPTY_CONTACT } from '../lib/students.js'

// The fields of a student, shared by the quick-add and edit screens.
//   values   = { name, birth_date, phone, school, school_year, school_year_type, start_date, notes }
//   contacts = [{ name, phone }, ...]  (parents etc.; the student's own phone is values.phone)
// Order: name, birth date, the student's phone, school, school year,
// start date, notes, and the contacts at the very bottom.

export const EMPTY_STUDENT = {
  name: '', sex: '', birth_date: '', phone: '', school: '', school_year: '', school_year_type: 'grade', notes: '',
}

// Ready for the database: empty text becomes null, the school year a
// number (and without a number, no grade/year either).
export function cleanStudent(values) {
  const clean = {}
  for (const [key, value] of Object.entries(values)) {
    clean[key] = typeof value === 'string' ? value.trim() || null : value
  }
  clean.school_year = clean.school_year ? Number(clean.school_year) : null
  if (!clean.school_year) clean.school_year_type = null
  return clean
}

const SCHOOL_YEARS = [1, 2, 3, 4, 5, 6, 7]

export default function StudentFields({ values, onChange, contacts, onContactsChange, nameRef }) {
  const field = (key) => ({
    value: values[key] ?? '',
    onChange: (e) => onChange({ ...values, [key]: e.target.value }),
  })

  return (
    <>
      <label>
        Name
        <input {...field('name')} ref={nameRef} autoCapitalize="words" required />
      </label>
      {/* Two big buttons instead of a dropdown: one tap. Tapping the chosen one again clears it. */}
      <fieldset>
        <legend>
          Girl or boy <span className="optional">(pink or blue name)</span>
        </legend>
        <div className="btn-row sex-picker">
          {[['f', 'Girl'], ['m', 'Boy']].map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={values.sex === key ? `btn-primary picked-${key}` : 'btn-secondary'}
              aria-pressed={values.sex === key}
              onClick={() => onChange({ ...values, sex: values.sex === key ? '' : key })}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>
      <label>
        Birth date <span className="optional">(for birthdays and exams)</span>
        <input {...field('birth_date')} type="date" />
      </label>
      <label>
        Student’s phone <span className="optional">(if they have one)</span>
        <input {...field('phone')} type="tel" placeholder="e.g. 11 5555-1234" />
      </label>
      <label>
        School <span className="optional">(optional)</span>
        <input {...field('school')} autoCapitalize="words" />
      </label>
      <fieldset>
        <legend>
          School year <span className="optional">(optional)</span>
        </legend>
        <div className="slot-fields two-equal">
          <label>
            Number
            <select {...field('school_year')}>
              <option value="">–</option>
              {SCHOOL_YEARS.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
          <label>
            Grade or year
            <select {...field('school_year_type')}>
              <option value="grade">Grade</option>
              <option value="year">Year</option>
            </select>
          </label>
        </div>
      </fieldset>
      <label>
        Started on
        <input {...field('start_date')} type="date" required />
      </label>
      <label>
        Notes <span className="optional">(optional)</span>
        <textarea {...field('notes')} rows={2} />
      </label>
      <ContactsEditor contacts={contacts} onChange={onContactsChange} />
    </>
  )
}

function ContactsEditor({ contacts, onChange }) {
  const set = (i, key, value) => onChange(contacts.map((c, j) => (j === i ? { ...c, [key]: value } : c)))

  return (
    <fieldset className="contacts-editor">
      <legend>
        Contacts <span className="optional">(parents, family…)</span>
      </legend>
      {contacts.map((c, i) => (
        <div key={i} className="slot-box">
          <label>
            {contacts.length > 1 ? `Contact ${i + 1}: name` : 'Contact name'}
            <input
              value={c.name}
              onChange={(e) => set(i, 'name', e.target.value)}
              placeholder={i === 0 ? 'e.g. Laura (mum)' : 'e.g. Carlos (dad)'}
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
