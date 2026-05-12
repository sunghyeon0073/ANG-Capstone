import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import TopNavBar from './TopNavBar'
import Sidebar from './Sidebar'
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
import Memo from './pages/Memo'

const sidebarMenus = {
  home: [
    { id: 'home', label: '대시보드' },
    { id: 'home-memo', label: '메모' }
  ],
  document: [
    { id: 'document-AI', label: 'AI문서작성' },
    { id: 'document', label: '문서작성' },
    { id: 'document-preview', label: '문서 미리보기' }
  ],
  esignature: [
    { id: 'esignature', label: '결재대기' },
    { id: 'esignature-completed', label: '완료' },
    { id: 'esignature-rejected', label: '반려' },
    { id: 'esignature-my', label: '내가 요청' }
  ],
  calendar: [
    { id: 'calendar', label: '내 캘린더' }
  ],
  file: [
    { id: 'file', label: '내 파일' },
    { id: 'file-shared', label: '공유파일' },
    { id: 'file-trash', label: '휴지통' }
  ],
  board: [
    { id: 'board-notice', label: '공지사항' },
    { id: 'board-free', label: '자유게시판' }
  ],
  mail: [
    { id: 'mail', label: '받은메일' },
    { id: 'mail-sent', label: '보낸메일' },
    { id: 'mail-important', label: '중요' },
    { id: 'mail-trash', label: '휴지통' }
  ],
  chat: [
    { id: 'chat-personal', label: '개인채팅' },
    { id: 'chat-groups', label: '그룹채팅' }
  ],
  organization: [
    { id: 'organization', label: '전체조직' },
    { id: 'organization-dept', label: '부서별' }
  ]
}

const getFirstSubPage = (page) => {
  const items = sidebarMenus[page] || sidebarMenus.home
  return items[0]?.id || page
}

export default function Dashboard() {
  const [currentPage, setCurrentPage] = useState('home')
  const [selectedSubPage, setSelectedSubPage] = useState(getFirstSubPage('home'))
  const [user, setUser] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    const storedUser = localStorage.getItem('user')
    if (storedUser) {
      setUser(JSON.parse(storedUser))
    } else {
      navigate('/')
    }
  }, [navigate])

  const handlePageChange = (page) => {
    setCurrentPage(page)
    setSelectedSubPage(getFirstSubPage(page))
  }

  const handleLogout = () => {
    localStorage.removeItem('user')
    navigate('/')
  }

  const renderPage = () => {
    if (currentPage === 'home' && selectedSubPage === 'home-memo') {
      return <Memo />
    }

    switch (currentPage) {
      case 'home':
        return <Home />
      case 'document':
        return <DocumentWriter />
      case 'esignature':
        return <ESignature selectedSubPage={selectedSubPage} />
      case 'calendar':
        return <Calendar />
      case 'file':
        return <FileStorage />
      case 'board':
        return <Board />
      case 'mail':
        return <Mail />
      case 'chat':
        return <Chat />
      case 'organization':
        return <Organization />
      case 'mypage':
        return <MyPage user={user} />
      default:
        return <Home />
    }
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
      <div className="dashboard-content">
        <Sidebar
          currentPage={currentPage}
          selectedSubPage={selectedSubPage}
          onSubPageChange={setSelectedSubPage}
        />
        <div className="main-content">
          {renderPage()}
        </div>
      </div>
    </div>
  )
}
