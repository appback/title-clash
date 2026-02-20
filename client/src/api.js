import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json'
  }
})

// Admin API helper - auto-attaches token from localStorage
export const adminApi = {
  _headers() {
    const token = localStorage.getItem('admin_token')
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

// Public API helper - for non-authenticated requests
export const publicApi = {
  get(url, params) {
    return api.get(url, { params })
  },
  post(url, data) {
    return api.post(url, data)
  }
}

export default api
