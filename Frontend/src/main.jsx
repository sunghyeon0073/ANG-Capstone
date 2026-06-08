import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
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
