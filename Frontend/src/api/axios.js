import axios from 'axios';

const api = axios.create({
  baseURL: 'http://http://15.168.156.224/:9090', // 백엔드 서버 주소
  timeout: 5000, // 5초 이상 응답 없으면 에러
  headers: {
    'Content-Type': 'application/json',
  }
});

export default api;