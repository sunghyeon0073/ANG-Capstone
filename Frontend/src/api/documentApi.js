import api from './axios';

export const uploadDocument = (formData) =>
  api.post('/documents', formData, { headers: { 'Content-Type': undefined } });

export const getMyDocuments = () => api.get('/documents/my');

export const getDepartmentDocuments = (params) => {
  const queryParams = typeof params === 'string' ? { keyword: params } : params;
  return api.get('/documents/department', { params: queryParams });
};

export const getDocument = (docId) => api.get(`/documents/${docId}`);

export const deleteDocument = (docId) => api.delete(`/documents/${docId}`);

export const downloadDocumentFile = (fileId) => 
  api.get(`/files/download/${fileId}`, { responseType: 'blob' });
