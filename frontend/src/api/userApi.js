import api from './axios';

export const getMyInfo = () => api.get('/users/me');
