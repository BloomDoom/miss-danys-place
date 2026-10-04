import { useState } from 'react'
import { mainContact } from '../lib/students.js'
import { internationalNumber, whatsappLink } from '../lib/phone.js'
import { buildVcard } from '../lib/vcard.js'
import { saveFiles } from '../lib/backup.js'
import { useToast } from './Toast.jsx'

// Small things remembered on this phone (drafts, "list already made").
function readLocal(key, fallback) {
  try {
    return localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}
function saveLocal(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // private mode etc.: it just isn't remembered
  }
}

// Sending to a whole class (or everyone sitting an exam) uses a WhatsApp
// BROADCAST LIST: one send reaches every family privately. (A web app
// can't send to many people by itself; only WhatsApp's paid business
// service can.)
// She makes the list once in WhatsApp; after that, each message is:
// write it here → "Copy & open WhatsApp" → pick the list → send.
//   listName   = what the broadcast list is called ("Kids A1")
//   draftKey, listKey = what this phone remembers the draft and "list made" under
//   students   = loaded with phone and student_contacts(*)
export default function BroadcastMessage({ listName, draftKey, listKey, students, defaultText = '' }) {
  const showToast = useToast()
  const [text, setText] = useState(() => readLocal(draftKey, defaultText))
  const [listMade, setListMade] = useState(() => readLocal(listKey, '') === 'yes')
  const [sent, setSent] = useState(new Set()) // student ids sent one by one on this visit

  function changeText(value) {
    setText(value)
    saveLocal(draftKey, value)
  }

  function markListMade(made) {
    setListMade(made)
    saveLocal(listKey, made ? 'yes' : '')
  }

  // Runs when she taps "Copy & open WhatsApp". The link itself opens
  // WhatsApp with the text ready to send to any chat or list; the copy is
  // there in case she opens the list by hand and needs to paste.
  function copyForWhatsApp() {
    navigator.clipboard?.writeText(text.trim()).catch(() => {})
  }

  // One main contact per family, with the full international number.
  const families = students
    .map((s) => ({ student: s, contact: mainContact(s) }))
    .map((f) => ({ ...f, number: f.contact && internationalNumber(f.contact.phone) }))

  async function saveContacts() {
    const entries = families
      .filter((f) => f.number)
      .map(({ student, contact, number }) => ({
        // "Laura (mum) · Sofía · Kids A1", or "Martín Gómez · Adults" for an adult's own phone
        name: contact.name === student.name
          ? `${student.name} · ${listName}`
          : `${contact.name} · ${student.name.split(' ')[0]} · ${listName}`,
        phone: number,
      }))
    try {
      await saveFiles([new File([buildVcard(entries)], `${listName}.vcf`, { type: 'text/vcard' })])
    } catch (err) {
      if (err.name !== 'AbortError') showToast("The contacts couldn't be saved. Try again.")
    }
  }

  const missing = families.filter((f) => !f.number)

  return (
    <>
      <label>
        Your message
        <textarea
          rows={5}
          value={text}
          onChange={(e) => changeText(e.target.value)}
          placeholder="e.g. Hi! There's no class this Thursday because of the holiday."
        />
      </label>

      {text.trim() ? (
        <a
          className="btn-primary"
          href={`https://wa.me/?text=${encodeURIComponent(text.trim())}`}
          target="_blank"
          rel="noreferrer"
          onClick={copyForWhatsApp}
        >
          Copy &amp; open WhatsApp
        </a>
      ) : (
        <button className="btn-primary" disabled>Copy &amp; open WhatsApp</button>
      )}
      <p className="muted">
        In WhatsApp, choose the <strong>“{listName}”</strong> broadcast list and send: every family gets it at once.
        If the list isn’t offered, open it yourself and paste the message.
      </p>

      <details className="section setup-box" open={!listMade}>
        <summary>{listMade ? 'Broadcast list: how to set it up again' : 'First time: set up the broadcast list'}</summary>
        <ol className="setup-steps">
          <li>
            If some families aren’t in your iPhone contacts yet, save them:
            <button className="btn-secondary" onClick={saveContacts}>Save {families.filter((f) => f.number).length} contacts to iPhone</button>
            <span className="muted">Then choose “Add All Contacts”. Skip families you already have, so they aren’t added twice.</span>
          </li>
          <li>
            In WhatsApp, open <strong>Broadcast Lists → New List</strong>, pick the families of {listName} and create it.
            Name it <strong>{listName}</strong>.
          </li>
          <li>
            Families only receive broadcast messages if they have <strong>your number saved</strong> in their phone.
          </li>
        </ol>
        {missing.length > 0 && (
          <p className="error">
            No phone saved for: {missing.map((f) => f.student.name).join(', ')}.
          </p>
        )}
        {listMade ? (
          <button className="btn-text" onClick={() => markListMade(false)}>Show these steps open next time</button>
        ) : (
          <button className="btn-primary" onClick={() => markListMade(true)}>Done, I made the list</button>
        )}
      </details>

      <details className="section">
        <summary>Or send to each family one by one</summary>
        <ul className="card-list">
          {families.map(({ student: s, contact }) => {
            const link = contact && text.trim() && whatsappLink(contact.phone, text.trim())
            const done = sent.has(s.id)
            return (
              <li key={s.id} className={`card send-row ${done ? 'sent' : ''}`}>
                <span className="charge-name">
                  <span className="card-title">{s.name}</span>
                  <span className="muted">{contact ? `${contact.name} · ${contact.phone}` : 'No phone saved'}</span>
                </span>
                {contact &&
                  (link ? (
                    <a
                      className={done ? 'btn-secondary' : 'btn-primary'}
                      href={link}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => setSent(new Set(sent).add(s.id))}
                    >
                      {done ? 'Sent ✓' : 'Send'}
                    </a>
                  ) : (
                    <button className="btn-primary" disabled>Send</button>
                  ))}
              </li>
            )
          })}
        </ul>
      </details>
    </>
  )
}
