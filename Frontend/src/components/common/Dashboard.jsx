import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import TopNavBar from './TopNavBar'
import Sidebar, { SIDEBAR_MENUS } from './Sidebar'
import Home from '../pages/Home'
import DocumentWriter from '../pages/DocumentWriter'
import ESignature from '../pages/ESignature'
import Calendar from '../pages/Calendar'
import FileStorage from '../pages/FileStorage'
import Board from '../pages/Board'
import Mail from '../pages/Mail'
import Chat from '../pages/Chat'
import Organization from '../pages/Organization'
import MyPage from '../pages/MyPage'
import Admin from '../pages/Admin'
import FloatingMascot from './FloatingMascot'

const PAGE_COMPONENTS = {
  home: Home,
  document: DocumentWriter,
  esignature: ESignature,
  calendar: Calendar,
  file: FileStorage,
  board: Board,
  mail: Mail,
  chat: Chat,
  org: Organization,
  organization: Organization,
  mypage: MyPage,
  admin: Admin
}

const getMainCategory = (page) => {
  const category = page.split('-')[0]
  return category === 'organization' ? 'org' : category
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [user] = useState(() => {
    const savedUser = localStorage.getItem('user')
    if (!savedUser) return null

    try {
      return JSON.parse(savedUser)
    } catch {
      return null
    }
  })
  const [currentPage, setCurrentPage] = useState('home-dashboard')
  const [contactRequest, setContactRequest] = useState(null)
  const [isChatWindowOpen, setIsChatWindowOpen] = useState(false)
  const [chatContactRequest, setChatContactRequest] = useState(null)

  useEffect(() => {
    if (!user) {
      navigate('/login')
    }
  }, [navigate, user])

  const handleLogout = () => {
    localStorage.removeItem('user')
    localStorage.removeItem('token')
    alert('로그아웃되었습니다.')
    navigate('/login')
  }

  const handlePageChange = (pageId) => {
    const topNavMenuIds = ['home', 'document', 'esignature', 'calendar', 'file', 'board', 'mail', 'chat', 'organization', 'admin']

    if (topNavMenuIds.includes(pageId)) {
      const incomingCategory = pageId === 'organization' ? 'org' : pageId
      const currentCategory = getMainCategory(currentPage)

      if (incomingCategory !== currentCategory) {
        if (incomingCategory === 'admin') {
          setCurrentPage('admin-approval')
        } else {
          setCurrentPage(SIDEBAR_MENUS[incomingCategory]?.[0]?.id || pageId)
        }
      }
    } else {
      setCurrentPage(pageId)
    }
  }

  const openMailCompose = (contact) => {
    setContactRequest({
      channel: 'mail',
      contact,
      requestId: Date.now(),
    })
    setCurrentPage('mail-compose')
  }

  const openPrivateChat = (contact) => {
    setChatContactRequest({
      contact,
      requestId: Date.now(),
    })
    setIsChatWindowOpen(true)
  }

  const renderPage = () => {
    const mainCategory = getMainCategory(currentPage)
    const Component = PAGE_COMPONENTS[mainCategory]
    const componentKey = mainCategory

    if (!Component) return <Home user={user} />

    return (
      <Component
        key={componentKey}
        user={user}
        currentSubPage={currentPage}
        me={user}
        contactRequest={contactRequest}
        onContactRequestHandled={() => setContactRequest(null)}
        onSendMail={openMailCompose}
        onStartChat={openPrivateChat}
        onSubPageChange={handlePageChange}
      />
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="dashboard">
      <TopNavBar
        user={user}
        onLogout={handleLogout}
        currentPage={currentPage}
        onPageChange={handlePageChange}
        onOpenChatWindow={() => setIsChatWindowOpen(true)}
        isChatWindowOpen={isChatWindowOpen}
      />
      <div className={`dashboard-content ${(currentPage === 'mypage' || currentPage === 'calendar' || getMainCategory(currentPage) === 'document' || getMainCategory(currentPage) === 'esignature') ? 'full-width' : ''}`}>
        {currentPage !== 'mypage' && currentPage !== 'calendar' && getMainCategory(currentPage) !== 'document' && getMainCategory(currentPage) !== 'esignature' && (
          <Sidebar
            currentPage={currentPage}
            onPageChange={handlePageChange}
          />
        )}
        <div className={`main-content${getMainCategory(currentPage) === 'esignature' ? ' main-content--fill' : ''}`}>
          {renderPage()}
        </div>
      </div>
      {isChatWindowOpen && (
        <Chat
          user={user}
          windowMode
          contactRequest={chatContactRequest}
          onContactRequestHandled={() => setChatContactRequest(null)}
          onCloseChatWindow={() => setIsChatWindowOpen(false)}
        />
      )}
      {getMainCategory(currentPage) !== 'esignature' && (
        <FloatingMascot mode={getMainCategory(currentPage) === 'document' ? 'ai' : 'default'} onSubPageChange={handlePageChange} />
      )}
    </div>
  )
}
