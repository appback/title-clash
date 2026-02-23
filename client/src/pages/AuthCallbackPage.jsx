import React, { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Loading from '../components/Loading'

export default function AuthCallbackPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) {
      navigate('/login', { replace: true })
      return
    }

    localStorage.setItem('admin_token', token)

    // Fetch user info from Hub
    fetch('https://appback.app/api/v1/auth/me', {
      headers: { Authorization: 'Bearer ' + token }
    })
      .then(r => r.json())
      .then(data => {
        if (data.user) {
          localStorage.setItem('tc_user', JSON.stringify(data.user))
        }
        window.dispatchEvent(new Event('admin-auth-change'))
        navigate('/', { replace: true })
      })
      .catch(() => {
        window.dispatchEvent(new Event('admin-auth-change'))
        navigate('/', { replace: true })
      })
  }, [searchParams, navigate])

  return (
    <div className="container">
      <Loading message="Signing you in..." />
    </div>
  )
}
