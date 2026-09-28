import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { unwrap } from '../lib/useLoad.js'
import { parseCsv } from '../lib/csv.js'
import { currentMonthISO, formatMoney, parseAmount, parseDate, todayISO } from '../lib/format.js'
import { normalize } from '../lib/groups.js'
import { loadErrorMessage, saveErrorMessage } from '../lib/errors.js'

// Bulk import of groups and students from CSV files, for loading the
// paper sheets once. Flow: pick a file → check every row → preview →
// import only the rows without problems.

const EXAMPLES = {
  groups: `name,level,schedule,price,notes
Kids A1,Beginners,Tue 17:00 60 / Thu 17:00 60,25000,
Adults Advanced,,Wed 19:00 90,30000,Book: Headway 4`,
  students: `name,group,phone,parent_name,parent_phone,start_date,notes
Sofía Pérez,Kids A1,,Laura Pérez,11 5555-1234,01/03/2026,
Martín Gómez,Adults Advanced,11 4444-9876,,,15/03/2026,Pays by transfer`,
}

// First three letters of the day, in English or Spanish (no accents).
const DAYS = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 7, lun: 1, mar: 2, mie: 3, jue: 4, vie: 5, sab: 6, dom: 7 }

// "Tue 17:00 60 / Thu 17:00" → [{ weekday: 2, start_time: '17:00', duration_min: 60 }, …]
// The length in minutes is optional (60 if missing). Throws if unreadable.
function parseSchedule(text) {
  return text
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = normalize(part).match(/^([a-z]+)\s+(\d{1,2})[:.](\d{2})(?:\s+(\d+))?/)
      const weekday = match && DAYS[match[1].slice(0, 3)]
      if (!weekday || Number(match[2]) > 23 || Number(match[3]) > 59) {
        throw new Error(`can't read the class time "${part}" (write it like "Tue 17:00 60")`)
      }
      return {
        weekday,
        start_time: `${match[2].padStart(2, '0')}:${match[3]}`,
        duration_min: match[4] ? Number(match[4]) : 60,
      }
    })
}

// Each checked row: { line, title, detail, problem, skip, data }
async function checkGroups(rows) {
  const existing = await unwrap(supabase.from('groups').select('name'))
  const seen = new Set(existing.map((g) => normalize(g.name)))

  return rows.map((row, i) => {
    const item = { line: i + 2, title: row.name || '(no name)' } // +2: header is line 1
    try {
      if (!row.name) throw new Error('the name is empty')
      const slots = parseSchedule(row.schedule || '')
      const price = row.price ? parseAmount(row.price) : null
      if (row.price && price === null) throw new Error(`can't read the price "${row.price}"`)
      if (seen.has(normalize(row.name))) item.skip = 'already exists'
      seen.add(normalize(row.name))
      item.detail = [row.schedule, price !== null && formatMoney(price)].filter(Boolean).join(' · ')
      item.data = { name: row.name, level: row.level || null, notes: row.notes || null, slots, price }
    } catch (err) {
      item.problem = err.message
    }
    return item
  })
}

async function checkStudents(rows) {
  const [groups, existing] = await Promise.all([
    unwrap(supabase.from('groups').select('id, name')),
    unwrap(supabase.from('students').select('name')),
  ])
  const groupIds = new Map(groups.map((g) => [normalize(g.name), g.id]))
  const seen = new Set(existing.map((s) => normalize(s.name)))

  return rows.map((row, i) => {
    const item = { line: i + 2, title: row.name || '(no name)' }
    try {
      if (!row.name) throw new Error('the name is empty')
      const groupId = row.group ? groupIds.get(normalize(row.group)) : null
      if (row.group && !groupId) throw new Error(`there's no group called "${row.group}" (import groups first)`)
      const startDate = row.start_date ? parseDate(row.start_date) : todayISO()
      if (!startDate) throw new Error(`can't read the date "${row.start_date}" (write it like 01/03/2026)`)
      if (seen.has(normalize(row.name))) item.skip = 'already exists'
      seen.add(normalize(row.name))
      item.detail = row.group || 'No group'
      item.data = {
        groupId,
        student: {
          name: row.name,
          phone: row.phone || null,
          guardian_name: row.parent_name || row.guardian_name || null,
          guardian_phone: row.parent_phone || row.guardian_phone || null,
          notes: row.notes || null,
          start_date: startDate,
        },
      }
    } catch (err) {
      item.problem = err.message
    }
    return item
  })
}

async function importGroup({ name, level, notes, slots, price }) {
  const group = await unwrap(supabase.from('groups').insert({ name, level, notes }).select().single())
  if (slots.length > 0) {
    await unwrap(supabase.from('group_slots').insert(slots.map((s) => ({ ...s, group_id: group.id }))))
  }
  if (price !== null) {
    await unwrap(supabase.from('group_prices').insert({ group_id: group.id, amount: price, effective_month: currentMonthISO() }))
  }
}

async function importStudent({ student, groupId }) {
  const saved = await unwrap(supabase.from('students').insert(student).select().single())
  if (groupId) {
    await unwrap(supabase.from('enrollments').insert({ student_id: saved.id, group_id: groupId, start_date: student.start_date }))
  }
}

export default function Import() {
  const [kind, setKind] = useState('groups') // or 'students'
  const [items, setItems] = useState(null)
  const [progress, setProgress] = useState(null) // { done, total }
  const [finished, setFinished] = useState(null) // number imported
  const [error, setError] = useState('')

  const ready = items?.filter((it) => !it.problem && !it.skip) ?? []
  const problems = items?.filter((it) => it.problem) ?? []
  const skipped = items?.filter((it) => it.skip) ?? []

  function choose(newKind) {
    setKind(newKind)
    setItems(null)
    setFinished(null)
    setError('')
  }

  async function handleFile(e) {
    const file = e.target.files[0]
    e.target.value = '' // lets you pick the same file again after fixing it
    if (!file) return
    setError('')
    setFinished(null)
    try {
      const rows = parseCsv(await file.text())
      if (rows.length === 0) return setError('That file has no rows. Check it has a header row and data.')
      setItems(kind === 'groups' ? await checkGroups(rows) : await checkStudents(rows))
    } catch (err) {
      setError(loadErrorMessage(err))
    }
  }

  async function runImport() {
    setError('')
    setProgress({ done: 0, total: ready.length })
    let done = 0
    try {
      // One at a time, so if the internet drops we know exactly what got in.
      for (const item of ready) {
        await (kind === 'groups' ? importGroup(item.data) : importStudent(item.data))
        done++
        setProgress({ done, total: ready.length })
      }
      setFinished(done)
      setItems(null)
    } catch (err) {
      setError(`${saveErrorMessage(err)} ${done} of ${ready.length} were imported. Pick the file again to add the rest; the ones already imported will be skipped.`)
      setItems(null)
    }
    setProgress(null)
  }

  return (
    <main className="screen">
      <Link to="/settings" className="back-link">‹ Settings</Link>
      <h1>Import from a spreadsheet</h1>
      <p>
        Save the sheet as a CSV file (Google Sheets: File → Download → CSV. Excel: Save As → CSV).
        Import groups first, then students.
      </p>

      <div className="btn-row">
        <button className={kind === 'groups' ? 'btn-primary' : 'btn-secondary'} onClick={() => choose('groups')}>Groups</button>
        <button className={kind === 'students' ? 'btn-primary' : 'btn-secondary'} onClick={() => choose('students')}>Students</button>
      </div>

      <section className="section">
        <h2>The file should look like this</h2>
        <pre className="example">{EXAMPLES[kind]}</pre>
        {kind === 'groups' ? (
          <p className="muted">Schedule: day, time and minutes, several separated by “/”. The price starts this month.</p>
        ) : (
          <p className="muted">Group must match a group’s name. Dates as DD/MM/YYYY. Empty columns are fine.</p>
        )}
        <label className="btn-secondary file-button">
          Choose CSV file
          <input type="file" accept=".csv,text/csv" onChange={handleFile} />
        </label>
      </section>

      {error && <p className="error" role="alert">{error}</p>}
      {finished !== null && (
        <p className="success" role="status">
          Done! Imported {finished} {kind}. <Link to={`/${kind}`}>See them</Link>
        </p>
      )}

      {items && (
        <section className="section">
          <h2>Check before importing</h2>
          <p>
            <strong>{ready.length} ready</strong>
            {problems.length > 0 && <> · <span className="error">{problems.length} with problems</span></>}
            {skipped.length > 0 && <> · {skipped.length} already exist (skipped)</>}
          </p>
          <ul className="row-list import-list">
            {[...problems, ...ready, ...skipped].map((it) => (
              <li key={it.line} className={it.problem ? 'has-problem' : ''}>
                <span>
                  <strong>{it.problem ? '✗' : it.skip ? '–' : '✓'} {it.title}</strong>
                  <br />
                  <span className="muted">
                    Line {it.line}: {it.problem || it.skip || it.detail}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          {problems.length > 0 && <p className="muted">Rows with problems won’t be imported. Fix them in the file and pick it again.</p>}
          {ready.length > 0 && (
            <button className="btn-primary" onClick={runImport} disabled={progress !== null}>
              {progress ? `Importing ${progress.done} of ${progress.total}…` : `Import ${ready.length} ${kind}`}
            </button>
          )}
        </section>
      )}
    </main>
  )
}
