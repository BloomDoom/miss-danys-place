// Backup: every table exported to its own CSV file.
import { supabase } from './supabase.js'
import { unwrap } from './useLoad.js'
import { todayISO } from './format.js'

const TABLES = ['groups', 'group_slots', 'group_prices', 'students', 'enrollments', 'sessions', 'absences', 'charges', 'payments', 'settings']

// Supabase returns at most 1000 rows per request, so read in pages.
async function fetchAll(table) {
  const rows = []
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const page = await unwrap(supabase.from(table).select('*').order('id').range(from, from + pageSize - 1))
    rows.push(...page)
    if (page.length < pageSize) return rows
  }
}

// Semicolons, because Excel in Spanish expects them. The invisible
// "\uFEFF" at the start tells Excel the file is UTF-8, so accents (José)
// show correctly.
const EXCEL_UTF8_MARK = '\uFEFF'

function toCsv(rows) {
  if (rows.length === 0) return EXCEL_UTF8_MARK
  const columns = Object.keys(rows[0])
  const cell = (value) => {
    if (value === null || value === undefined) return ''
    const text = Array.isArray(value) ? value.join(',') : String(value)
    return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  const lines = [columns.join(';'), ...rows.map((row) => columns.map((c) => cell(row[c])).join(';'))]
  return EXCEL_UTF8_MARK + lines.join('\r\n')
}

// Returns an array of File objects: ms-danys-2026-09-28-students.csv, ...
export async function buildBackupFiles() {
  const date = todayISO()
  const files = []
  for (const table of TABLES) {
    const csv = toCsv(await fetchAll(table))
    files.push(new File([csv], `ms-danys-${date}-${table}.csv`, { type: 'text/csv' }))
  }
  return files
}

// On the iPhone this opens the Share sheet (Save to Files, Mail,
// WhatsApp…). On a computer it downloads the files instead.
export async function saveFiles(files) {
  if (navigator.canShare?.({ files })) {
    await navigator.share({ files, title: "Ms Dany's Place backup" })
    return
  }
  for (const file of files) {
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 10000) // give the download time to start
  }
}
