// The text fields of a student, shared by the quick-add and edit screens.
// `values` is { name, phone, guardian_name, guardian_phone, notes, start_date }.

export const EMPTY_STUDENT = { name: '', phone: '', guardian_name: '', guardian_phone: '', notes: '' }

// Empty text becomes null in the database instead of "".
export function cleanStudent(values) {
  const clean = {}
  for (const [key, value] of Object.entries(values)) {
    clean[key] = typeof value === 'string' ? value.trim() || null : value
  }
  return clean
}

export default function StudentFields({ values, onChange, nameRef }) {
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
      <label>
        Phone / WhatsApp <span className="optional">(optional)</span>
        <input {...field('phone')} type="tel" placeholder="e.g. 11 5555-1234" />
      </label>
      <label>
        Parent’s name <span className="optional">(for kids)</span>
        <input {...field('guardian_name')} autoCapitalize="words" />
      </label>
      <label>
        Parent’s phone <span className="optional">(for kids)</span>
        <input {...field('guardian_phone')} type="tel" />
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
}
