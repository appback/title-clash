import React, { useEffect, useRef } from 'react'

/**
 * @param {object} props
 * @param {boolean} props.open - Whether modal is visible
 * @param {function} props.onClose - Called when modal should close
 * @param {string} props.title - Modal header title
 * @param {React.ReactNode} props.children - Modal body content
 * @param {React.ReactNode} [props.footer] - Modal footer content
 */
export default function Modal({ open, onClose, title, children, footer }) {
  const modalRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} ref={modalRef}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">&times;</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </>
  )
}
