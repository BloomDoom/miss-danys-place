import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { unwrap, useLoad } from '../lib/useLoad.js'
import { loadRewardTypes } from '../lib/rewards.js'
import { saveErrorMessage } from '../lib/errors.js'
import { useToast } from './Toast.jsx'
import LoadState from './LoadState.jsx'

// Quick picks so she doesn't have to hunt in the emoji keyboard.
const EMOJI_CHOICES = ['⭐', '🏆', '📚', '🎨', '💬', '👏', '🌟', '🎯', '🧠', '❤️']

// Settings → Reward types: create them, and turn them off (not deleted,
// because students already have rewards of that type).
export default function RewardTypes() {
  const showToast = useToast()
  const result = useLoad(loadRewardTypes, [])
  const [emoji, setEmoji] = useState('⭐')
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  async function add(e) {
    e.preventDefault()
    setError('')
    if (!emoji.trim() || !name.trim()) return setError('Choose an emoji and write a name.')
    try {
      await unwrap(supabase.from('reward_types').insert({ emoji: emoji.trim(), name: name.trim() }))
      showToast(`${emoji} ${name.trim()} created`)
      setName('')
      result.reload()
    } catch (err) {
      setError(saveErrorMessage(err))
    }
  }

  async function setActive(type, active) {
    try {
      await unwrap(supabase.from('reward_types').update({ active }).eq('id', type.id))
      showToast(active ? `${type.emoji} ${type.name} is back` : `${type.emoji} ${type.name} turned off`)
      result.reload()
    } catch (err) {
      showToast(saveErrorMessage(err))
    }
  }

  return (
    <section className="section">
      <h2>Reward types</h2>
      <p className="muted">Stickers you give to students, for example ⭐ Great effort or 📚 Homework hero.</p>
      <LoadState {...result} />
      {result.data && (
        <ul className="row-list">
          {result.data.map((type) => (
            <li key={type.id} className={type.active ? '' : 'dimmed'}>
              <span className="reward-type-name">
                <span className="reward-emoji" aria-hidden="true">{type.emoji}</span> {type.name}
              </span>
              <button className="btn-text" onClick={() => setActive(type, !type.active)}>
                {type.active ? 'Turn off' : 'Turn on'}
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={add} className="slot-box">
        <p className="pay-question">New reward type</p>
        <div className="emoji-choices" role="group" aria-label="Emoji">
          {EMOJI_CHOICES.map((e) => (
            <button
              key={e}
              type="button"
              className={`emoji-choice ${emoji === e ? 'selected' : ''}`}
              onClick={() => setEmoji(e)}
              aria-pressed={emoji === e}
            >
              {e}
            </button>
          ))}
        </div>
        <label>
          Or type any emoji
          <input value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={8} />
        </label>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Great effort" />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn-primary">Create reward type</button>
      </form>
    </section>
  )
}
