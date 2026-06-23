import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { session } from '../../utils/storageUtils'
import { showAlert } from '../../utils/alertUtils'
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
  mail: 'mail-inbox',
  org: 'org-all',
  admin: 'admin-approval',
}

const TOP_NAV_MENU_IDS = ['home', 'document', 'esignature', 'calendar', 'file', 'board', 'mail', 'chat', 'organization', 'admin']
const DASHBOARD_PAGE_QUERY_KEY = 'page'

// main-content--fill이 필요한 카테고리 (자체 높이 채움 레이아웃)
const FILL_CATEGORIES = new Set(['esignature', 'board', 'mail'])

const getMainCategory = (page) => {
  const category = page.split('-')[0]
  return category === 'organization' ? 'org' : category
}

const normalizeDashboardPage = (page) => {
  if (!page) return null

  if (TOP_NAV_MENU_IDS.includes(page)) {
    const category = page === 'organization' ? 'org' : page
    return DEFAULT_SUB_PAGES[category] || page
  }

  const category = getMainCategory(page)
  return PAGE_COMPONENTS[category] ? page : null
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const pageParam = searchParams.get(DASHBOARD_PAGE_QUERY_KEY)
  const queryClient = useQueryClient()
  const [user] = useState(() => session.getUser())
  const [currentPage, setCurrentPage] = useState(
    () => normalizeDashboardPage(pageParam)
      || normalizeDashboardPage(session.getDashboardPage())
      || 'home-dashboard'
  )
  const [contactRequest, setContactRequest] = useState(null)
  const [isChatWindowOpen, setIsChatWindowOpen] = useState(
    () => session.isChatWindowOpen()
  )
  const [chatContactRequest, setChatContactRequest] = useState(null)
  const [chatUnreadCount, setChatUnreadCount] = useState(0)

  // 알림 목록 조회 (React Query)
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await getNotifications(0, 30)
      return res.data?.data?.content || []
    },
    enabled: !!session.getToken(),
    refetchInterval: 60000, // 1분마다 자동 갱신
  })

  // 알림 읽음 처리 (Mutation)
  const markReadMutation = useMutation({
    mutationFn: (id) => markNotificationAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    }
  })

  const markAllReadMutation = useMutation({
    mutationFn: () => markAllNotificationsAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    }
  })

  const handleNewNotification = useCallback((notification) => {
    // 새 알림 수신 시 캐시 데이터 업데이트
    queryClient.setQueryData(['notifications'], (old = []) => [notification, ...old])
  }, [queryClient])

  const handleMarkRead = useCallback((id) => {
    markReadMutation.mutate(id)
  }, [markReadMutation])

  const handleMarkAllRead = useCallback(() => {
    markAllReadMutation.mutate()
  }, [markAllReadMutation])

  useEffect(() => {
    const token = session.getToken()
    if (!user || !token) {
      session.clear()
      navigate('/login', { replace: true })
    }
  }, [navigate, user])

  useEffect(() => {
    session.setDashboardPage(currentPage)
  }, [currentPage])

  useEffect(() => {
    const pageFromUrl = normalizeDashboardPage(pageParam)

    if (pageFromUrl) {
      if (pageFromUrl !== currentPage) setCurrentPage(pageFromUrl)
      return
    }

    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.set(DASHBOARD_PAGE_QUERY_KEY, currentPage)
      return next
    }, { replace: true })
  }, [currentPage, pageParam, setSearchParams])

  useEffect(() => {
    session.setChatWindowOpen(isChatWindowOpen)
  }, [isChatWindowOpen])

  const handleLogout = () => {
    session.clear()
    showAlert('로그아웃되었습니다.', 'success')
    navigate('/login', { replace: true })
  }

  const moveDashboardPage = useCallback((pageId, options = {}) => {
    const nextPage = normalizeDashboardPage(pageId)
    if (!nextPage) return

    if (nextPage !== currentPage) setCurrentPage(nextPage)
    if (pageParam === nextPage) return

    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.set(DASHBOARD_PAGE_QUERY_KEY, nextPage)
      return next
    }, { replace: Boolean(options.replace) })
  }, [currentPage, pageParam, setSearchParams])

  const handlePageChange = (pageId) => {
    if (TOP_NAV_MENU_IDS.includes(pageId)) {
      const incomingCategory = pageId === 'organization' ? 'org' : pageId
      const currentCategory = getMainCategory(currentPage)
      if (incomingCategory !== currentCategory) {
        moveDashboardPage(DEFAULT_SUB_PAGES[incomingCategory] || pageId)
      }
    } else {
      moveDashboardPage(pageId)
    }
  }

  const handleNotificationNavigate = (type) => {
    const pageMap = { BOARD: 'board', MAIL: 'mail-inbox', APPROVAL: 'esignature-waiting' }
    handlePageChange(pageMap[type] || 'home-dashboard')
  }

  const openMailCompose = (contact) => {
    setContactRequest({ channel: 'mail', contact, requestId: Date.now() })
    moveDashboardPage('mail-compose')
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
      <FloatingMascot
        mode={mainCategory === 'document' ? 'ai' : 'default'}
        onSubPageChange={handlePageChange}
      />
    </div>
  )
}
