import api from './axios'
import { unwrap } from '../utils/responseUtils'

export const previewAiSchedule = async prompt => {
  const response = await api.post('/ai-assistant/schedule', { prompt, confirm: false })
  return unwrap(response)
}

export const confirmAiSchedule = async prompt => {
  const response = await api.post('/ai-assistant/schedule', { prompt, confirm: true })
  return unwrap(response)
}

export const getAiSchedules = async () => {
  const response = await api.get('/ai-assistant/schedules')
  return unwrap(response)
}

export const cancelAiSchedule = async id => {
  const response = await api.post(`/ai-assistant/schedules/${id}/cancel`)
  return unwrap(response)
}

export const askAiAssistant = async (prompt, confirm = false) => {
  const response = await api.post('/ai-assistant/ask', { prompt, confirm })
  return unwrap(response)
}

export const reserveScheduledSend = async (data) => {
  const response = await api.post('/ai-assistant/reserve', data)
  return unwrap(response)
}

export const updateAiSchedule = async (id, data) => {
  const response = await api.put(`/ai-assistant/schedules/${id}`, data)
  return unwrap(response)
}
