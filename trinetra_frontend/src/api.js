import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

const mlApi = axios.create({
  baseURL: 'http://127.0.0.1:8001',
  timeout: 120000,   // 2 minutes — Gemini AI calls can take 30-60s
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Silent auth-check endpoints — never redirect on 401 for these
const SILENT_ENDPOINTS = ['/auth/me/', '/auth/login/', '/auth/register/', '/auth/google/']

// Auto-refresh token on 401 (but not for auth-check / login endpoints)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    const url = original?.url || ''

    // Don't try to refresh/redirect for silent endpoints — let caller handle 401
    const isSilent = SILENT_ENDPOINTS.some((ep) => url.includes(ep))
    if (isSilent) return Promise.reject(error)

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      const refresh = localStorage.getItem('refresh_token')
      if (refresh) {
        try {
          const { data } = await axios.post('/api/auth/token/refresh/', { refresh })
          localStorage.setItem('access_token', data.access)
          original.headers.Authorization = `Bearer ${data.access}`
          return api(original)
        } catch {
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          window.location.href = '/login'
        }
      } else {
        // No refresh token at all — go to login
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export { api, mlApi }
export default api

