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

export const parseTemplate = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch('/ai-api/docx/parse-template', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Failed to parse template from AI backend');
  }
  
  return await response.json();
};

export const generateTemplate = async (templateFile, formDataStr, title) => {
  const formData = new FormData();
  formData.append('file', templateFile);
  formData.append('form_data', formDataStr);
  if (title) formData.append('title', title);

  const response = await fetch('/ai-api/docx/generate-template', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Failed to generate template from AI backend');
  }
  
  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') || '';
  let filename = `${title || '생성본'}.docx`;
  
  const match = disposition.match(/filename\*=UTF-8''(.+)|filename="?([^;\\"]+)"?/);
  if (match) {
    filename = decodeURIComponent(match[1] || match[2]);
  }
  
  return { blob, filename };
};

