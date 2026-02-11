import React from 'react'
import { Link } from 'react-router-dom'

/**
 * @param {object} props
 * @param {string} props.message - Primary message
 * @param {string} [props.actionLabel] - Button text
 * @param {string} [props.actionTo] - Link destination
 */
export default function EmptyState({ message, actionLabel, actionTo }) {
  return (
    <div className="empty-state animate-fade-in">
      <p>{message}</p>
      {actionLabel && actionTo && (
        <p>
          <Link to={actionTo} className="btn btn-primary btn-sm">
            {actionLabel}
          </Link>
        </p>
      )}
    </div>
  )
}
