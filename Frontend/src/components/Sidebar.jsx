import { FiHome, FiBell, FiCheckSquare, FiCalendar, FiFileText, FiFolder, FiShare2, FiTrash2, FiInbox, FiSend, FiMessageSquare, FiList, FiUsers, FiEdit3, FiStar } from 'react-icons/fi'

const iconMap = {
  'home-dashboard': FiHome,
  'home-memo': FiFileText,
  'document-AI': FiFileText,
  'document-general': FiFileText,
  'document-preview': FiFileText,
  'esignature-waiting': FiCheckSquare,
  'esignature-completed': FiCheckSquare,
  'esignature-rejected': FiCheckSquare,
  'esignature-my': FiCheckSquare,
  'calendar-my': FiCalendar,
  'file-home': FiHome,
  'file-my': FiFolder,
  'file-shared': FiShare2,
  'file-template': FiFileText,
  'file-important': FiStar,
  'file-trash': FiTrash2,
  'board-notice': FiBell,
  'board-general': FiEdit3,
  'mail-inbox': FiInbox,
  'mail-sent': FiSend,
  'mail-important': FiStar,
  'mail-trash': FiTrash2,
  'chat-personal': FiMessageSquare,
  'chat-groups': FiUsers,
  'org-all': FiList,
  'org-dept': FiList
}

export const SIDEBAR_MENUS = {
  home: [
    { id: 'home-dashboard', label: '대시보드' },
    { id: 'home-memo', label: '메모' }
  ],
  document: [
    { id: 'document-AI', label: 'AI문서작성' },
    { id: 'document-general', label: '문서작성' },
    { id: 'document-preview', label: '문서 미리보기' }
  ],
  esignature: [
    { id: 'esignature-waiting', label: '결재대기' },
    { id: 'esignature-completed', label: '완료' },
    { id: 'esignature-rejected', label: '반려' },
    { id: 'esignature-my', label: '내가 요청' }
  ],
  file: [
    { id: 'file-home', label: '홈' },
    { id: 'file-my', label: '내 파일' },
    { id: 'file-shared', label: '공유파일' },
    { id: 'file-template', label: '빈 양식' },
    { id: 'file-important', label: '중요 문서함' },
    { id: 'file-trash', label: '휴지통' }
  ],
  board: [
    { id: 'board-notice', label: '공지사항' },
    { id: 'board-general', label: '자유게시판' }
  ],
  mail: [
    { id: 'mail-inbox', label: '받은메일' },
    { id: 'mail-sent', label: '보낸메일' },
    { id: 'mail-important', label: '중요' },
    { id: 'mail-trash', label: '휴지통' }
  ],
  chat: [
    { id: 'chat-personal', label: '개인채팅' },
    { id: 'chat-groups', label: '그룹채팅' }
  ],
  org: [
    { id: 'org-all', label: '전체조직' },
    { id: 'org-dept', label: '부서별' }
  ]
}

const getMainCategory = (page) => {
  const category = page.split('-')[0]
  return category === 'organization' ? 'org' : category
}

export default function Sidebar({ currentPage, onPageChange }) {
  const mainCategory = getMainCategory(currentPage)
  const items = SIDEBAR_MENUS[mainCategory] || SIDEBAR_MENUS.home

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>메뉴</h2>
      </div>
      <nav className="sidebar-menu">
        {items.map(item => {
          const IconComponent = iconMap[item.id]
          return (
            <button
              key={item.id}
              // 현재 선택된 메뉴와 ID가 일치하면 'active' 클래스 부여 (활성화 상태 UI 표시)
              className={`sidebar-menu-item ${currentPage === item.id ? 'active' : ''}`}
              // 상위 컴포넌트로 정확한 하위 메뉴 ID 전달하여 화면 전환
              onClick={() => onPageChange(item.id)}
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