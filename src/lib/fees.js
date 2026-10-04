// The school's monthly fee: one price for everyone, a lower one for
// siblings, minus each student's beca %. The database does the real
// charging (fees_due in supabase/06-fees.sql); this mirrors it to show
// "what they pay" on a student.
import { supabase } from './supabase.js'
import { unwrap } from './useLoad.js'
import { currentMonthISO } from './format.js'
import { normalize } from './groups.js'

export const CHARGE_KINDS = { fee: 'Monthly fee', materials: 'Materials' }

export function loadFeePrices() {
  return unwrap(supabase.from('fee_prices').select('*').order('effective_month'))
}

// The fee row that applies to a month: the latest one starting on or
// before it (or the first one, for months before the fee started).
export function feeForMonth(prices, month = currentMonthISO()) {
  const started = prices.filter((p) => p.effective_month <= month)
  return started[started.length - 1] || prices[0] || null
}

// { base, sibling, beca, amount } for a student. `hasSibling` = a brother
// or sister also comes.
export function studentFee(fee, beca, hasSibling) {
  const base = hasSibling ? fee.sibling : fee.regular
  return { base, sibling: hasSibling, beca, amount: Math.round((base * (100 - beca)) / 100) }
}

// True when two names share a surname: any word after the first name
// ("Sofía García López" and "Tomás López" do). Used to suggest siblings.
export function shareSurname(a, b) {
  const surnames = (name) => normalize(name).split(/\s+/).slice(1).filter((w) => w.length > 2)
  const theirs = surnames(b)
  return surnames(a).some((w) => theirs.includes(w))
}
