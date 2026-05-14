import api from './axios';

export const getFiles = (ownerType, ownerId) =>
  api.get('/files', { params: { ownerType, ownerId } });

export const downloadFile = (fileId) =>
  api.get(`/files/download/${fileId}`, { responseType: 'blob' });
