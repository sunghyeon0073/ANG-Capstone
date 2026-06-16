import api from './axios'

export const getNotifications = (page = 0, size = 20) =>
  api.get('/notifications', { params: { page, size } })

export const markNotificationAsRead = (id) =>
  api.post(`/notifications/${id}/read`)

export const markAllNotificationsAsRead = () =>
  api.post('/notifications/read-all')
