import api from './axios';

export const getPendingUsers = () => api.get('/admin/users/pending');
export const approveUser = (userId, roleLevel) =>
  api.patch(`/admin/users/${userId}/approve`, { roleLevel });
