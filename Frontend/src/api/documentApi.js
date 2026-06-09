import api from './axios';

export const uploadDocument = (formData) =>
  api.post('/documents', formData, { headers: { 'Content-Type': undefined } });

export const getMyDocuments = () => api.get('/documents/my');

export const getDepartmentDocuments = (params) => {
  const queryParams = typeof params === 'string' ? { keyword: params } : params;
  return api.get('/documents/department', { params: queryParams });
};

export const getDocument = (docId) => api.get(`/documents/${docId}`);

export const updateDocument = (docId, payload) => api.put(`/documents/${docId}`, payload);

export const deleteDocument = (docId) => api.delete(`/documents/${docId}`);

export const getTrashDocuments = () => api.get('/documents/trash');

export const permanentDeleteDocument = (docId) => api.delete(`/documents/${docId}/permanent`);

export const restoreDocument = (docId) => api.put(`/documents/${docId}/restore`);

export const downloadDocumentFile = (fileId) => 
  api.get(`/files/download/${fileId}`, { responseType: 'blob' });
