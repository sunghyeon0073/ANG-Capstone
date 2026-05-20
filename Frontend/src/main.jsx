import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './style/common-layout.css'
import './style/nav-and-modal.css'
import './style/sidebar.css'
import './style/floating-mascot.css'
import './style/home.css'
import './style/board.css'
import './style/organization.css'
import './style/calendar.css'
import './style/document-writer.css'
import './style/file-storage.css'
import './style/memo.css'
import './style/esignature.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
