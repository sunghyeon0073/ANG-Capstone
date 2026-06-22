import api from './axios';

export const uploadDocument = (formData) =>
  api.post('/documents', formData, { headers: { 'Content-Type': undefined } });

export const getAllDocuments = (params) => api.get('/documents', { params });

export const getMyDocuments = (params) => api.get('/documents/my', { params });

export const getDepartmentDocuments = (params) => {
  const queryParams = typeof params === 'string' ? { keyword: params } : params;
  return api.get('/documents/department', { params: queryParams });
};

export const getDocument = (docId) => api.get(`/documents/${docId}`);

export const updateDocument = (docId, payload) => api.put(`/documents/${docId}`, payload);

export const deleteDocument = (docId) => api.delete(`/documents/${docId}`);

export const getTrashDocuments = (params) => api.get('/documents/trash', { params });

export const permanentDeleteDocument = (docId) => api.delete(`/documents/${docId}/permanent`);

export const restoreDocument = (docId) => api.put(`/documents/${docId}/restore`);

export const toggleFavorite = (docId) => api.post(`/documents/${docId}/favorite`);

export const getFavoriteDocuments = (params) => api.get('/documents/favorites', { params });

export const getDocumentOriginalContent = (docId) => api.get(`/documents/${docId}/original-content`);

