import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLoad } from '../lib/useLoad.js'
import { giveReward, loadRewardTypes, removeReward } from '../lib/rewards.js'
import { saveErrorMessage } from '../lib/errors.js'
import { useToast } from './Toast.jsx'

// On the class screen, folded away until she opens it: pick a sticker,
// then tap each student who earned it. Each tap gives one (with Undo).
export default function GiveRewards({ students }) {
  const showToast = useToast()
  const result = useLoad(loadRewardTypes, [])
  const types = result.data?.filter((t) => t.active) ?? []
  const [typeId, setTypeId] = useState(null)
  const [given, setGiven] = useState({}) // 'studentId_typeId' → how many given on this visit
  const type = types.find((t) => t.id === typeId) || types[0]

  const add = (key, n) => setGiven((g) => ({ ...g, [key]: (g[key] || 0) + n }))

  async function give(student) {
    try {
      const reward = await giveReward(student.id, type.id)
      add(`${student.id}_${type.id}`, 1)
      showToast(`${type.emoji} ${type.name} for ${student.name.split(' ')[0]}`, async () => {
        await removeReward(reward.id)
        add(`${student.id}_${type.id}`, -1)
      })
    } catch (err) {
      showToast(saveErrorMessage(err))
    }
  }

  if (students.length === 0) return null

  return (
    <details className="section give-rewards">
      <summary>Give rewards</summary>
      {result.data && types.length === 0 && (
        <p className="empty">
          No reward types yet. Create them in <Link to="/settings">Settings</Link>.
        </p>
      )}
      {type && (
        <>
          <div className="emoji-choices" role="group" aria-label="Which reward">
            {types.map((t) => (
              <button
                key={t.id}
                className={`reward-chip ${t.id === type.id ? 'selected' : ''}`}
                onClick={() => setTypeId(t.id)}
                aria-pressed={t.id === type.id}
              >
                {t.emoji} {t.name}
              </button>
            ))}
          </div>
          <p className="muted">Tap each student who earned {type.emoji} {type.name}:</p>
          <ul className="roster">
            {students.map((s) => {
              const count = given[`${s.id}_${type.id}`] || 0
              return (
                <li key={s.id}>
                  <button className="roster-row" onClick={() => give(s)}>
                    <span className="roster-name">{s.name}</span>
                    <span className="reward-count">{count > 0 ? `${type.emoji} +${count}` : `+ ${type.emoji}`}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </details>
  )
}
