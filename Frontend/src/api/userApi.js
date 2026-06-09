import api from './axios';

export const getAllUsers = () => api.get('/users');

export const getMyInfo = () => api.get('/users/me');

export const searchUsers = (q = '') => api.get('/users/search', { params: { q } });

export const updateUser = (userId, payload) => api.patch(`/users/${userId}`, payload);
