import api from './axios';

export const getAllUsers = () => api.get('/users');

export const getMyInfo = () => api.get('/users/me');

export const searchUsers = (q = '') => api.get('/users/search', { params: { q } });

export const updateUser = (userId, payload) => api.patch(`/users/${userId}`, payload);

export const uploadUserProfileImage = (userId, file) => {
  const formData = new FormData();
  formData.append('file', file);

  return api.post(`/users/${userId}/profile-image`, formData, {
    headers: { 'Content-Type': undefined },
  });
};

export const getUserProfileImage = (userId) => api.get(`/users/${userId}/profile-image`, {
  responseType: 'blob',
});
