import api from './axios';

export const login = (loginData) => {
  return api.post('/auth/login', loginData);
};

export const signUp = (userData) => {
  return api.post('/auth/register', userData);
};
