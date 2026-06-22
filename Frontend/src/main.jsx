import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// 리팩토링: React Query 도입
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// localStorage에 남은 이전 인증 데이터 제거 (sessionStorage 전환 이후 호환성)
;['token', 'refreshToken', 'user'].forEach(k => localStorage.removeItem(k))
import './index.css'
import App from './App.jsx'

// React Query 클라이언트 생성
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
