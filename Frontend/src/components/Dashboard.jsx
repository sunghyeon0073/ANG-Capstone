import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import TopNavBar from './TopNavBar'
import Sidebar, { SIDEBAR_MENUS } from './Sidebar'
import Home from './pages/Home'
import DocumentWriter from './pages/DocumentWriter'
import ESignature from './pages/ESignature'
import Calendar from './pages/Calendar'
import FileStorage from './pages/FileStorage'
import Board from './pages/Board'
import Mail from './pages/Mail'
import Chat from './pages/Chat'
import Organization from './pages/Organization'
import MyPage from './pages/MyPage'
import Admin from './pages/Admin'
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
  const [user, setUser] = useState(null)
  const [currentPage, setCurrentPage] = useState('home-dashboard')

  useEffect(() => {
    const savedUser = localStorage.getItem('user')
    if (!savedUser) {
      navigate('/login')
      return
    }
    setUser(JSON.parse(savedUser))
  }, [navigate])

  const handleLogout = () => {
    localStorage.removeItem('user')
    localStorage.removeItem('token')
    navigate('/login')
  }

  const handlePageChange = (pageId) => {
    const topNavMenuIds = ['home', 'document', 'esignature', 'calendar', 'file', 'board', 'mail', 'chat', 'organization', 'admin']

    if (topNavMenuIds.includes(pageId)) {
      const incomingCategory = pageId === 'organization' ? 'org' : pageId
      const currentCategory = getMainCategory(currentPage)

      if (incomingCategory !== currentCategory) {
        // 관리자 탭 클릭 시 기본 서브페이지로 'admin-approval' 설정
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

  const renderPage = () => {
    const mainCategory = getMainCategory(currentPage)
    const Component = PAGE_COMPONENTS[mainCategory]

    if (!Component) return <Home user={user} />

    return <Component
      user={user}
      currentSubPage={currentPage}
      me={user} // Admin 컴포넌트 등에서 사용할 내 정보
    />
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
      />
      <div className={`dashboard-content ${(currentPage === 'mypage' || currentPage === 'calendar' || getMainCategory(currentPage) === 'document') ? 'full-width' : ''}`}>
        {currentPage !== 'mypage' && currentPage !== 'calendar' && getMainCategory(currentPage) !== 'document' && (
          <Sidebar
            currentPage={currentPage}
            onPageChange={handlePageChange}
          />
        )}
        <div className="main-content">
          {renderPage()}
        </div>
      </div>
      <FloatingMascot mode={getMainCategory(currentPage) === 'document' ? 'ai' : 'default'} />
    </div>
  )
}
