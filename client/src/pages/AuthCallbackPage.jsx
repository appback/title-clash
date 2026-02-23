import React, { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { setAuth } from '../api'
import Loading from '../components/Loading'

export default function AuthCallbackPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const hubToken = searchParams.get('token')
    if (!hubToken) {
      navigate('/login', { replace: true })
      return
    }

    fetch('/api/v1/auth/hub-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: hubToken })
    })
      .then(r => r.json())
      .then(data => {
        if (data.token && data.user) {
          setAuth(data.token, data.user)
        }
        navigate('/', { replace: true })
      })
      .catch(() => {
        navigate('/login', { replace: true })
      })
  }, [searchParams, navigate])

  return (
    <div className="container">
      <Loading message="Signing you in..." />
    </div>
  )
}
