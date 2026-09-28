// Payment helpers: statuses, balances and loading the settings.
import { supabase } from './supabase.js'
import { unwrap } from './useLoad.js'
import { todayISO } from './format.js'

export const METHODS = {
  cash: 'Cash',
  transfer: 'Transfer',
  mercado_pago: 'Mercado Pago',
}

export const STATUS_LABELS = {
  overdue: 'Overdue',
  unpaid: 'Unpaid',
  partial: 'Partial',
  paid: 'Paid',
}

// Order on the Payments screen: what needs attention first.
const STATUS_ORDER = ['overdue', 'unpaid', 'partial', 'paid']

export function loadSettings() {
  return unwrap(supabase.from('settings').select('*').eq('id', 1).single())
}

// Creates this month's charges if they don't exist yet (see 02-payments.sql).
export function ensureCharges(month) {
  return unwrap(supabase.rpc('ensure_charges', { p_month: month }))
}

// Payments that weren't removed.
export function activePayments(charge) {
  return (charge.payments || []).filter((p) => !p.deleted_at)
}

// Adds paid, balance and status to a charge. `charge.payments` must be loaded.
//   paid    = total paid so far
//   balance = what's still owed
//   status  = 'paid' | 'partial' | 'unpaid' | 'overdue'
// Overdue = not fully paid and today is after the due day of that month.
export function withStatus(charge, dueDay) {
  const paid = activePayments(charge).reduce((sum, p) => sum + p.amount, 0)
  const balance = Math.max(charge.amount - paid, 0)
  const dueDate = charge.month.slice(0, 8) + String(dueDay).padStart(2, '0')

  let status = 'paid'
  if (balance > 0) {
    if (todayISO() > dueDate) status = 'overdue'
    else status = paid > 0 ? 'partial' : 'unpaid'
  }
  return { ...charge, paid, balance, status }
}

export function sortByStatus(charges) {
  return [...charges].sort(
    (a, b) =>
      STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) ||
      a.students.name.localeCompare(b.students.name, 'es'),
  )
}
