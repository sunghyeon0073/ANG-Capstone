import api from './axios'

export const getSchedules = (params) => api.get('/schedules', { params })

export const createSchedule = (payload) => api.post('/schedules', payload)

export const updateSchedule = (scheduleId, payload) => api.put(`/schedules/${scheduleId}`, payload)

export const deleteSchedule = (scheduleId) => api.delete(`/schedules/${scheduleId}`)
