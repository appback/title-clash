import React from 'react'

export default function GameProgress({ current, total, label }) {
  const pct = total > 0 ? (current / total * 100) : 0

  return (
    <div className="game-progress">
      <div className="game-progress-bar">
        <div
          className="game-progress-fill"
          style={{ width: pct + '%' }}
        />
      </div>
      <span className="game-progress-text">
        {label || `${current} / ${total}`}
      </span>
    </div>
  )
}
