import React from 'react'
import { Link } from 'react-router-dom'

/**
 * @param {object} props
 * @param {{ label: string, to?: string }[]} props.items
 *   Last item has no `to` (current page).
 */
export default function Breadcrumb({ items }) {
  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      {items.map((item, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="breadcrumb-separator" aria-hidden="true">/</span>}
          {item.to ? (
            <Link to={item.to}>{item.label}</Link>
          ) : (
            <span className="breadcrumb-current" aria-current="page">{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  )
}
