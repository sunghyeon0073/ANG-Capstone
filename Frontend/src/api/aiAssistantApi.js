import api from './axios'

const unwrap = response => response.data?.data ?? response.data

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
