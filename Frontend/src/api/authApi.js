import api from './axios'; // 이미 만드신 axios.js 파일

// 로그인 요청
export const login = (loginData) => {
  return api.post('/api/auth/login', loginData); 
};

// 회원가입 요청
export const signUp = (userData) => {
  return api.post('/api/auth/register', userData);
};