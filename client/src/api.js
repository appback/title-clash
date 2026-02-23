import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' }
})

export const authApi = {
  _headers() {
    const token = localStorage.getItem('tc_token')
    return token ? { Authorization: 'Bearer ' + token } : {}
  },
  get(url, params) {
    return api.get(url, { headers: this._headers(), params })
  },
  post(url, data) {
    return api.post(url, data, { headers: this._headers() })
  },
  put(url, data) {
    return api.put(url, data, { headers: this._headers() })
  },
  patch(url, data) {
    return api.patch(url, data, { headers: this._headers() })
  },
  delete(url) {
    return api.delete(url, { headers: this._headers() })
  }
}

export const publicApi = {
  get(url, params) {
    return api.get(url, { params })
  },
  post(url, data) {
    return api.post(url, data)
  }
}

export function getUser() {
  const raw = localStorage.getItem('tc_user')
  return raw ? JSON.parse(raw) : null
}

export function getToken() {
  return localStorage.getItem('tc_token')
}

export function setAuth(token, user) {
  localStorage.setItem('tc_token', token)
  localStorage.setItem('tc_user', JSON.stringify(user))
  window.dispatchEvent(new Event('tc-auth-change'))
}

export function clearAuth() {
  localStorage.removeItem('tc_token')
  localStorage.removeItem('tc_user')
  window.dispatchEvent(new Event('tc-auth-change'))
}

export default api
