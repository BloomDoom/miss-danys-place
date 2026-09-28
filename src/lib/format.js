// Dates, months, times and money, formatted the Argentine way.
//
// Dates are passed around as ISO strings ("2026-09-28") because that's
// what Postgres uses. They're only turned into "28/09/2026" for display.
// Months are the 1st of the month: "2026-09-01" = September 2026.

const TIME_ZONE = 'America/Argentina/Buenos_Aires'

// Today's date in Argentina, as "2026-09-28".
// ("en-CA" happens to format dates as YYYY-MM-DD.)
export function todayISO() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(new Date())
}

export function currentMonthISO() {
  return todayISO().slice(0, 8) + '01'
}

// "2026-09-28" → "28/09/2026"
export function formatDate(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// "28/09/2026" (or 28-9-2026) → "2026-09-28". Returns null if invalid.
export function parseDate(text) {
  const match = text.trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  if (!match) return null
  const [, d, m, y] = match.map(Number)
  const date = new Date(y, m - 1, d)
  if (date.getMonth() !== m - 1 || date.getDate() !== d) return null // e.g. 31/02
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

// "2026-09-01" → "September 2026"
export function formatMonth(iso) {
  const [y, m] = iso.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

// addMonths("2026-11-01", 2) → "2027-01-01"
export function addMonths(monthIso, n) {
  const [y, m] = monthIso.split('-').map(Number)
  const date = new Date(y, m - 1 + n, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
}

// 25000 → "$ 25.000"
const money = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})
export function formatMoney(amount) {
  return money.format(amount)
}

// "$ 25.000" or "25000" → 25000. Returns null if there's no number.
export function parseAmount(text) {
  const withoutCents = String(text).trim().replace(/,\d{1,2}$/, '')
  const digits = withoutCents.replace(/\D/g, '')
  return digits ? Number(digits) : null
}

// Weekday numbers follow the database: 1 = Monday ... 7 = Sunday.
export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export function weekdayName(n) {
  return WEEKDAYS[n - 1]
}

// Postgres returns times as "18:00:00"; show "18:00".
export function formatTime(time) {
  return time.slice(0, 5)
}

// 60 → "60 min"
export function formatDuration(minutes) {
  return `${minutes} min`
}
