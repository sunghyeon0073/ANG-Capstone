import api from './axios';

export const getMemos = () => api.get('/memos');
export const createMemo = (data) => api.post('/memos', data);
export const updateMemo = (id, data) => api.put(`/memos/${id}`, data);
export const deleteMemo = (id) => api.delete(`/memos/${id}`);
