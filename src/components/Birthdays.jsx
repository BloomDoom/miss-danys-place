import { Link } from 'react-router-dom'
import { formatDay } from '../lib/format.js'
import { fillMessage, mainContact } from '../lib/students.js'
import { whatsappLink } from '../lib/phone.js'

// Birthdays on the Today screen: today's with a "Send birthday message"
// button, and the rest of the week as a short list.
// `birthdays` = birthdaysBetween(...) for the day shown + the next 6 days.
export default function Birthdays({ birthdays, date, message }) {
  const today = birthdays.filter((b) => b.date === date)
  const soon = birthdays.filter((b) => b.date !== date)
  if (birthdays.length === 0) return null

  return (
    <section className="birthdays">
      {today.map(({ student, turning }) => {
        const contact = mainContact(student)
        const link = contact && whatsappLink(contact.phone, fillMessage(message, student))
        return (
          <div key={student.id} className="card birthday-card">
            <span className="card-title">
              🎂 <Link to={`/students/${student.id}`}>{student.name}</Link>’s birthday
            </span>
            <span>Turns {turning} today</span>
            {link ? (
              <a className="btn-primary" href={link} target="_blank" rel="noreferrer">
                Send birthday message
              </a>
            ) : (
              <span className="muted">No phone saved, so no message can be sent.</span>
            )}
          </div>
        )
      })}

      {soon.length > 0 && (
        <p className="muted birthdays-soon">
          <strong>Birthdays this week:</strong>{' '}
          {soon.map((b) => `${b.student.name} (${formatDay(b.date)}, turns ${b.turning})`).join(' · ')}
        </p>
      )}
    </section>
  )
}
