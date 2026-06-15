import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { session } from '../../utils/storageUtils'
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead } from '../../api/notificationApi'
import TopNavBar from './TopNavBar'
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

// 각 카테고리의 기본 진입 서브페이지
const DEFAULT_SUB_PAGES = {
  home: 'home-dashboard',
  esignature: 'esignature-waiting',
  file: 'file-my',
  board: 'board',
  mail: 'mail-compose',
  org: 'org-all',
  admin: 'admin-approval',
}

// main-content--fill이 필요한 카테고리 (자체 높이 채움 레이아웃)
const FILL_CATEGORIES = new Set(['esignature', 'board', 'mail'])

const getMainCategory = (page) => {
  const category = page.split('-')[0]
  return category === 'organization' ? 'org' : category
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [currentPage, setCurrentPage] = useState('home-dashboard')
  const [contactRequest, setContactRequest] = useState(null)
  const [isChatWindowOpen, setIsChatWindowOpen] = useState(false)
  const [chatContactRequest, setChatContactRequest] = useState(null)
  const [chatUnreadCount, setChatUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState([])

  useEffect(() => {
    getNotifications(0, 30)
      .then(res => setNotifications(res.data?.data?.content || []))
      .catch(() => {})
  }, [])

  const handleNewNotification = useCallback((notification) => {
    setNotifications(prev => [notification, ...prev])
  }, [])

  const handleMarkRead = useCallback(async (id) => {
    await markNotificationAsRead(id).catch(() => {})
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  const handleMarkAllRead = useCallback(async () => {
    await markAllNotificationsAsRead().catch(() => {})
    setNotifications([])
  }, [])

  useEffect(() => {
    const user = session.getUser()
    const token = session.getToken()
    if (!user || !token) {
      session.clear()
      navigate('/login', { replace: true })
      return
    }
    setUser(user)
  }, [navigate])

  const handleLogout = () => {
    session.clear()
    alert('로그아웃되었습니다.')
    navigate('/login', { replace: true })
  }

  const handlePageChange = (pageId) => {
    const topNavMenuIds = ['home', 'document', 'esignature', 'calendar', 'file', 'board', 'mail', 'chat', 'organization', 'admin']

    if (topNavMenuIds.includes(pageId)) {
      const incomingCategory = pageId === 'organization' ? 'org' : pageId
      const currentCategory = getMainCategory(currentPage)
      if (incomingCategory !== currentCategory) {
        setCurrentPage(DEFAULT_SUB_PAGES[incomingCategory] || pageId)
      }
    } else {
      setCurrentPage(pageId)
    }
  }

  const handleNotificationNavigate = (type) => {
    const pageMap = { BOARD: 'board', MAIL: 'mail-inbox', APPROVAL: 'esignature-waiting' }
    handlePageChange(pageMap[type] || 'home-dashboard')
  }

  const openMailCompose = (contact) => {
    setContactRequest({ channel: 'mail', contact, requestId: Date.now() })
    setCurrentPage('mail-compose')
  }

  const openPrivateChat = (contact) => {
    setChatContactRequest({ contact, requestId: Date.now() })
    setIsChatWindowOpen(true)
  }

  const renderPage = () => {
    const mainCategory = getMainCategory(currentPage)
    const Component = PAGE_COMPONENTS[mainCategory]

    if (!Component) return <Home user={user} />

    return (
      <Component
        key={mainCategory}
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

  if (!user) return null

  const mainCategory = getMainCategory(currentPage)

  return (
    <div className="dashboard">
      <TopNavBar
        user={user}
        onLogout={handleLogout}
        currentPage={currentPage}
        onPageChange={handlePageChange}
        onOpenChatWindow={() => setIsChatWindowOpen(true)}
        isChatWindowOpen={isChatWindowOpen}
        chatUnreadCount={chatUnreadCount}
        notifications={notifications}
        onMarkRead={handleMarkRead}
        onMarkAllRead={handleMarkAllRead}
        onNotificationNavigate={handleNotificationNavigate}
      />
      <div className="dashboard-content full-width">
        <div className={`main-content${FILL_CATEGORIES.has(mainCategory) ? ' main-content--fill' : ''}`}>
          {renderPage()}
        </div>
      </div>
      <Chat
        user={user}
        windowMode
        isWindowOpen={isChatWindowOpen}
        contactRequest={chatContactRequest}
        onContactRequestHandled={() => setChatContactRequest(null)}
        onOpenChatWindow={() => setIsChatWindowOpen(true)}
        onCloseChatWindow={() => setIsChatWindowOpen(false)}
        onUnreadCountChange={setChatUnreadCount}
        onNotification={handleNewNotification}
      />
      {mainCategory !== 'esignature' && (
        <FloatingMascot
          mode={mainCategory === 'document' ? 'ai' : 'default'}
          onSubPageChange={handlePageChange}
        />
      )}
    </div>
  )
}