import React, { useState, useEffect } from 'react'
import { useLang } from '../i18n'

/**
 * @param {object} props
 * @param {string} props.targetDate - ISO date string for countdown target
 * @param {function} [props.onExpired] - Called when countdown reaches zero
 */
export default function Countdown({ targetDate, onExpired }) {
  const { t } = useLang()
  const [remaining, setRemaining] = useState(calcRemaining(targetDate))

  useEffect(() => {
    const timer = setInterval(() => {
      const r = calcRemaining(targetDate)
      setRemaining(r)
      if (r.total <= 0) {
        clearInterval(timer)
        if (onExpired) onExpired()
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [targetDate, onExpired])

  if (remaining.total <= 0) {
    return <span className="countdown" aria-label={t('countdown.expired')}>{t('countdown.expired')}</span>
  }

  return (
    <span className="countdown" aria-label={'Time remaining: ' + formatRemaining(remaining)}>
      {remaining.days > 0 && (
        <span className="countdown-unit">
          <span className="countdown-value">{remaining.days}</span>
          <span className="countdown-label">d</span>
        </span>
      )}
      <span className="countdown-unit">
        <span className="countdown-value">{pad(remaining.hours)}</span>
        <span className="countdown-label">h</span>
      </span>
      <span className="countdown-unit">
        <span className="countdown-value">{pad(remaining.minutes)}</span>
        <span className="countdown-label">m</span>
      </span>
      <span className="countdown-unit">
        <span className="countdown-value">{pad(remaining.seconds)}</span>
        <span className="countdown-label">s</span>
      </span>
    </span>
  )
}

function calcRemaining(target) {
  const total = Math.max(0, new Date(target).getTime() - Date.now())
  return {
    total,
    days: Math.floor(total / 86400000),
    hours: Math.floor((total % 86400000) / 3600000),
    minutes: Math.floor((total % 3600000) / 60000),
    seconds: Math.floor((total % 60000) / 1000)
  }
}

function pad(n) { return String(n).padStart(2, '0') }

function formatRemaining(r) {
  return (r.days > 0 ? r.days + ' days ' : '') + pad(r.hours) + ':' + pad(r.minutes) + ':' + pad(r.seconds)
}
