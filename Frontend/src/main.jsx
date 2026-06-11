import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// localStorage에 남은 이전 인증 데이터 제거 (sessionStorage 전환 이후 호환성)
;['token', 'refreshToken', 'user'].forEach(k => localStorage.removeItem(k))
import './index.css'
import './style/mail.css'
import './style/file-storage.css'
import './style/esignature.css'
import './style/calendar.css'
import './style/document.css'
import './style/auth.css'
import './style/mascot.css'
import './style/home.css'
import './style/board.css'
import './style/organization.css'
import './style/AIprompt.css'
import './style/navigation.css'
import './style/mypage.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
