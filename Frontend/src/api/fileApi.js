import api from './axios';

export const uploadFile = (formData) =>
  api.post('/files/upload', formData, { headers: { 'Content-Type': undefined } });

export const getAllFiles = (params) => api.get('/files', { params });

export const getMyFiles = (params) => api.get('/files/my', { params });

export const getDepartmentFiles = (params) => {
  const queryParams = typeof params === 'string' ? { keyword: params } : params;
  return api.get('/files/department', { params: queryParams });
};

export const deleteFile = (fileId) => api.delete(`/files/${fileId}`);

export const getTrashFiles = (params) => api.get('/files/trash', { params });

export const permanentDeleteFile = (fileId) => api.delete(`/files/${fileId}/permanent`);

export const restoreFile = (fileId) => api.put(`/files/${fileId}/restore`);

export const toggleFavoriteFile = (fileId) => api.post(`/files/${fileId}/favorite`);

export const getFavoriteFiles = (params) => api.get('/files/favorites', { params });

export const downloadFile = (fileId) => 
  api.get(`/files/download/${fileId}`, { responseType: 'blob' });

export const getFilePreview = (fileId) =>
  api.get(`/files/preview/${fileId}`, { responseType: 'blob' });

export const renameFile = (fileId, data) => api.put(`/files/${fileId}`, data);

export const shareFile = (fileId, targetScopeId) => api.put(`/files/${fileId}`, { targetScopeId });
