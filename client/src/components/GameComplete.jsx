import React from 'react'
import { Link } from 'react-router-dom'

export default function GameComplete({ title, description, primaryAction, secondaryAction }) {
  return (
    <div className="game-complete animate-fade-in">
      <div className="game-complete-card">
        <h2>{title}</h2>
        {description && <p>{description}</p>}
        <div className="game-complete-actions">
          {primaryAction && (
            <Link to={primaryAction.to} className="btn btn-primary btn-lg">
              {primaryAction.label}
            </Link>
          )}
          {secondaryAction && (
            <Link to={secondaryAction.to} className="btn btn-secondary">
              {secondaryAction.label}
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
