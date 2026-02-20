import React from 'react'

/**
 * @param {object} props
 * @param {string} [props.message] - Text below spinner. Default: "Loading..."
 * @param {boolean} [props.large] - Use large spinner. Default: false
 */
export default function Loading({ message = 'Loading...', large = false }) {
  return (
    <div className="loading-center" role="status" aria-label={message}>
      <div className={'spinner' + (large ? ' spinner-lg' : '')} />
      <span>{message}</span>
    </div>
  )
}
