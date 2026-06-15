import axios from 'axios'
import { session } from '../utils/storageUtils'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 120000,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = session.getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type']
  } else {
    config.headers['Content-Type'] = 'application/json'
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      const refreshToken = session.getRefreshToken()

      if (refreshToken) {
        try {
          const baseURL = api.defaults.baseURL || '/api'
          const { data } = await axios.post(`${baseURL}/auth/refresh`, { refreshToken })
          const { accessToken, refreshToken: newRefreshToken } = data.data

          session.setTokens(accessToken, newRefreshToken)
          originalRequest.headers.Authorization = `Bearer ${accessToken}`
          return api(originalRequest)
        } catch (refreshError) {
          session.clear()
          window.location.href = '/login'
          return Promise.reject(refreshError)
        }
      } else {
        session.clear()
        window.location.href = '/login'
      }
    }

    return Promise.reject(error)
  }
)

export default api
