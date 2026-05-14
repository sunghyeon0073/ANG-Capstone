import api from './axios';

export const getPendingUsers = () => api.get('/admin/users/pending');
export const approveUser = (userId, position, roleLevel) =>
  api.patch(`/admin/users/${userId}/approve`, { position, roleLevel });

export const getAllUsers = () => api.get('/admin/users');
export const deleteUser = (userId) => api.delete(`/admin/users/${userId}`);
export const addMemberToScope = (scopeId, userId) => 
  api.post(`/scopes/${scopeId}/members?userId=${userId}`);
