import api from './axios';

export const getPendingUsers = () => api.get('/admin/users/pending');

export const approveUser = (userId, roleLevel, position) =>
  api.patch(`/admin/users/${userId}/approve`, { roleLevel, position });

export const rejectUser = (userId, reason) =>
  api.patch(`/admin/users/${userId}/reject`, { reason });

export const getAllUsers = () => api.get('/admin/users');

export const deleteUser = (userId) => api.delete(`/admin/users/${userId}`);

export const addMemberToScope = (scopeId, userId, position) => 
  api.post(`/scopes/${scopeId}/members`, null, {
    params: { userId, position: position || '사원' },
  });

export const removeMemberFromScope = (scopeId, userId) =>
  api.delete(`/scopes/${scopeId}/members/${userId}`);

export const updateMemberPosition = (scopeId, userId, position) =>
  api.patch(`/scopes/${scopeId}/members/${userId}/position`, { position });

export const updateUserRole = (userId, roleLevel) =>
  api.patch(`/admin/users/${userId}/role`, { roleLevel });
