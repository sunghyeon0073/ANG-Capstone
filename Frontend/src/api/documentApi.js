import api from './axios';

export const uploadDocument = (formData) =>
  api.post('/documents', formData, { headers: { 'Content-Type': 'multipart/form-data' } });

export const getMyDocuments = () => api.get('/documents/my');

export const getDepartmentDocuments = (keyword) =>
  api.get('/documents/department', { params: keyword ? { keyword } : {} });

export const getDocument = (docId) => api.get(`/documents/${docId}`);

export const deleteDocument = (docId) => api.delete(`/documents/${docId}`);
