// Rewards (stickers / badges). She creates reward types in Settings
// (⭐ Great effort, 📚 Homework hero…) and gives them to students.
// Giving one adds a row to `rewards`; Undo marks it deleted.
import { supabase } from './supabase.js'
import { unwrap } from './useLoad.js'
import { todayISO } from './format.js'

export function loadRewardTypes() {
  return unwrap(supabase.from('reward_types').select('*').order('created_at'))
}

// Returns the new reward row (keep its id for Undo).
export function giveReward(studentId, rewardTypeId) {
  return unwrap(
    supabase.from('rewards').insert({ student_id: studentId, reward_type_id: rewardTypeId, given_on: todayISO() }).select().single(),
  )
}

export function removeReward(rewardId) {
  return unwrap(supabase.from('rewards').update({ deleted_at: new Date().toISOString() }).eq('id', rewardId))
}

// A student's rewards (not removed), newest first, with their type.
export async function loadStudentRewards(studentId) {
  const rows = await unwrap(
    supabase.from('rewards').select('*, reward_types(id, emoji, name)').eq('student_id', studentId).is('deleted_at', null),
  )
  return rows.sort((a, b) => b.given_on.localeCompare(a.given_on) || b.id - a.id)
}

// { rewardTypeId: count }
export function countByType(rewards) {
  const counts = {}
  for (const r of rewards) counts[r.reward_type_id] = (counts[r.reward_type_id] || 0) + 1
  return counts
}
