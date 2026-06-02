import api from './axios';

export const getScopes = () => api.get('/scopes');
export const getSignupScopesTree = () => api.get('/auth/scopes/tree');
export const createScope = (data) => api.post('/scopes', data);
export const getScopeMembers = (scopeId) => api.get(`/scopes/${scopeId}/members`);
