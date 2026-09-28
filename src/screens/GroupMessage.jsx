import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { unwrap, useLoad } from '../lib/useLoad.js'
import { currentEnrollments } from '../lib/groups.js'
import { mainContact } from '../lib/students.js'
import { whatsappLink } from '../lib/phone.js'
import { useToast } from '../components/Toast.jsx'
import LoadState from '../components/LoadState.jsx'
import BackButton from '../components/BackButton.jsx'

async function loadGroup(id) {
  const group = await unwrap(
    supabase.from('groups').select('id, name, enrollments(end_date, students(id, name, active, student_contacts(*)))').eq('id', id).single(),
  )
  const students = currentEnrollments(group.enrollments)
    .map((e) => e.students)
    .filter((s) => s.active)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  return { group, students }
}

// Draft kept on this phone, per group, so leaving the screen (e.g. to send
// in WhatsApp and come back) doesn't lose the text.
const draftKey = (groupId) => `group-message-${groupId}`
function readDraft(groupId) {
  try {
    return localStorage.getItem(draftKey(groupId)) || ''
  } catch {
    return ''
  }
}
function saveDraft(groupId, text) {
  try {
    localStorage.setItem(draftKey(groupId), text)
  } catch {
    // private mode etc.: the draft just isn't kept
  }
}

// WhatsApp doesn't let a web app send one message to many people at once,
// so she writes it once and taps Send for each family: WhatsApp opens
// with the text already typed, she taps send there, and comes back.
export default function GroupMessage() {
  const { id } = useParams()
  const showToast = useToast()
  const result = useLoad(() => loadGroup(id), [id])
  const [text, setText] = useState(() => readDraft(id))
  const [sent, setSent] = useState(new Set()) // student ids tapped this visit

  function changeText(value) {
    setText(value)
    saveDraft(id, value)
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      showToast('Message copied. Paste it in a WhatsApp group.')
    } catch {
      showToast("Couldn't copy. Select the text and copy it by hand.")
    }
  }

  return (
    <main className="screen">
      <BackButton fallback={`/groups/${id}`} />
      <LoadState {...result} />
      {result.data && (
        <>
          <h1>Message {result.data.group.name}</h1>
          <label>
            Your message
            <textarea rows={5} value={text} onChange={(e) => changeText(e.target.value)} placeholder="e.g. Hi! There's no class this Thursday because of the holiday." />
          </label>
          <button className="btn-secondary" onClick={copy} disabled={!text.trim()}>Copy message</button>

          <section className="section">
            <h2>Send to each family</h2>
            <p className="muted">
              Tap Send: WhatsApp opens with your message ready. Send it there, then come back for the next one.
            </p>
            {result.data.students.length === 0 && <p className="empty">No students in this group.</p>}
            <ul className="card-list">
              {result.data.students.map((s) => {
                const contact = mainContact(s)
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
          </section>
        </>
      )}
    </main>
  )
}
