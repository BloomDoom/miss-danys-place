import { Link } from 'react-router-dom'
import { useLoad } from '../lib/useLoad.js'
import { formatDate } from '../lib/format.js'
import { countByType, giveReward, loadRewardTypes, loadStudentRewards, removeReward } from '../lib/rewards.js'
import { saveErrorMessage } from '../lib/errors.js'
import { useToast } from './Toast.jsx'
import LoadState from './LoadState.jsx'

async function load(studentId) {
  const [types, rewards] = await Promise.all([loadRewardTypes(), loadStudentRewards(studentId)])
  return { types, rewards }
}

// On the student screen: how many of each sticker, a button to give one
// more, and the recent history.
export default function StudentRewards({ student }) {
  const showToast = useToast()
  const result = useLoad(() => load(student.id), [student.id])
  const firstName = student.name.split(' ')[0]

  async function give(type) {
    try {
      const reward = await giveReward(student.id, type.id)
      result.reload()
      showToast(`${type.emoji} ${type.name} for ${firstName}`, async () => {
        await removeReward(reward.id)
        result.reload()
      })
    } catch (err) {
      showToast(saveErrorMessage(err))
    }
  }

  async function remove(reward) {
    if (!window.confirm(`Remove ${reward.reward_types.emoji} ${reward.reward_types.name} from ${formatDate(reward.given_on)}?`)) return
    try {
      await removeReward(reward.id)
      result.reload()
    } catch (err) {
      showToast(saveErrorMessage(err))
    }
  }

  const types = result.data?.types ?? []
  const rewards = result.data?.rewards ?? []
  const counts = countByType(rewards)
  // Active types, plus turned-off ones the student already has.
  const shown = types.filter((t) => t.active || counts[t.id])

  return (
    <section className="section">
      <h2>Rewards</h2>
      <LoadState {...result} />
      {result.data && types.length === 0 && (
        <p className="empty">
          No reward types yet. Create them in <Link to="/settings">Settings</Link>.
        </p>
      )}
      {shown.length > 0 && (
        <ul className="row-list">
          {shown.map((type) => (
            <li key={type.id}>
              <span className="reward-type-name">
                <span className="reward-emoji" aria-hidden="true">{type.emoji}</span> {type.name}
                <strong className="reward-count"> × {counts[type.id] || 0}</strong>
              </span>
              {type.active && (
                <button className="btn-secondary btn-give" onClick={() => give(type)} aria-label={`Give ${type.name}`}>
                  + Give
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {rewards.length > 0 && (
        <details>
          <summary>History ({rewards.length})</summary>
          <ul className="payment-lines">
            {rewards.slice(0, 30).map((r) => (
              <li key={r.id}>
                <span>
                  {r.reward_types.emoji} {r.reward_types.name} · {formatDate(r.given_on)}
                </span>
                <button className="btn-text" onClick={() => remove(r)}>Remove</button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
