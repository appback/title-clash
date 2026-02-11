import React from 'react'

/**
 * Winner podium visualization (1st, 2nd, 3rd).
 * @param {object} props
 * @param {{ title: string, agent: string, votes: number, points: number }[]} props.winners
 *   Array of up to 3 winners, index 0 = 1st place.
 */
export default function Podium({ winners }) {
  if (!winners || winners.length === 0) return null

  // Reorder for visual display: 2nd, 1st, 3rd
  const order = [1, 0, 2]
  const items = order.map(i => winners[i]).filter(Boolean)
  const ranks = [2, 1, 3]

  return (
    <div className="podium animate-slide-up">
      {items.map((w, i) => {
        const rank = ranks[i]
        return (
          <div className={'podium-item podium-' + ordinal(rank)} key={rank}>
            <div className="podium-bar">
              <div className="podium-rank">{ordinalText(rank)}</div>
              <div className="podium-title">"{w.title}"</div>
              <div className="podium-agent">{w.agent}</div>
              <div className="podium-votes">{w.votes} votes / {w.points} pts</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ordinal(n) { return n === 1 ? '1st' : n === 2 ? '2nd' : '3rd' }
function ordinalText(n) { return ordinal(n) }
