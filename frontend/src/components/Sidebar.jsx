import { FiHome, FiBell, FiCheckSquare, FiCalendar, FiFileText, FiFolder, FiShare2, FiTrash2, FiInbox, FiSend, FiMessageSquare, FiList, FiUsers } from 'react-icons/fi'

export default function Sidebar({ currentPage, selectedSubPage, onSubPageChange }) {
  const getSidebarItems = () => {
    const iconMap = {
      'home': FiHome,
      'home-memo': FiFileText,
      'document-AI': FiFileText,
      'document': FiFileText,
      'document-preview': FiFileText,
      'esignature': FiCheckSquare,
      'esignature-completed': FiCheckSquare,
      'esignature-rejected': FiCheckSquare,
      'esignature-my': FiCheckSquare,
      'calendar': FiCalendar,
      'file': FiFolder,
      'file-shared': FiShare2,
      'file-trash': FiTrash2,
      'board-notice': FiBell,
      'board-free': FiList,
      'mail': FiInbox,
      'mail-sent': FiSend,
      'mail-important': FiInbox,
      'mail-trash': FiTrash2,
      'chat-personal': FiMessageSquare,
      'chat-groups': FiUsers,
      'organization': FiList,
      'organization-dept': FiList
    }

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

    return {
      items: sidebarMenus[currentPage] || sidebarMenus.home,
      iconMap
    }
  }

  const { items, iconMap } = getSidebarItems()

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>메뉴</h2>
      </div>
      <nav className="sidebar-menu">
        {items.map(item => {
          const IconComponent = iconMap[item.id]
          const isActive = selectedSubPage === item.id
          return (
            <button
              key={item.id}
              className={`sidebar-menu-item ${isActive ? 'active' : ''}`}
              onClick={() => onSubPageChange(item.id)}
            >
              {IconComponent && <IconComponent className="sidebar-icon" />}
              <span className="sidebar-label">{item.label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
