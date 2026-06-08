import { FiHome, FiBell, FiCheckSquare, FiCalendar, FiFileText, FiFolder, FiShare2, FiTrash2, FiInbox, FiSend, FiMessageSquare, FiList, FiUsers, FiEdit3, FiStar, FiShield, FiImage } from 'react-icons/fi'

const iconMap = {
  'home-dashboard': FiHome,
  'esignature-waiting': FiCheckSquare,
  'esignature-completed': FiCheckSquare,
  'esignature-rejected': FiCheckSquare,
  'esignature-my': FiCheckSquare,
  'file-home': FiHome,
  'file-my': FiFolder,
  'file-shared': FiShare2,
  'file-template': FiFileText,
  'file-important': FiStar,
  'file-trash': FiTrash2,
  'board-notice': FiBell,
  'board-general': FiEdit3,
  'mail-compose': FiMessageSquare,
  'mail-inbox': FiInbox,
  'mail-sent': FiSend,
  'mail-drafts': FiFolder,
  'mail-important': FiStar,
  'mail-trash': FiTrash2,
  'org-all': FiList,
  'org-dept': FiList,
  'org-admin': FiShield
}

export const SIDEBAR_MENUS = {
  home: [
    { id: 'home-dashboard', label: '대시보드' }
  ],
  esignature: [
    { id: 'esignature-waiting', label: '결재대기' },
    { id: 'esignature-completed', label: '완료' },
    { id: 'esignature-rejected', label: '반려' },
    { id: 'esignature-my', label: '내가 요청' }
  ],
  file: [
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
    { id: 'mail-compose', label: '메일작성' },
    { id: 'mail-inbox', label: '받은메일' },
    { id: 'mail-sent', label: '보낸메일' },
    { id: 'mail-important', label: '중요' },
    { id: 'mail-drafts', label: '임시보관함' },
    { id: 'mail-trash', label: '휴지통' }
  ],
  org: [
    { id: 'org-all', label: '전체조직' },
    { id: 'org-dept', label: '부서별' }
  ],
  admin: [
    { id: 'admin-approval', label: '가입 승인 관리' },
    { id: 'admin-users', label: '직원 정보 관리' },
    { id: 'admin-org', label: '조직 구조 관리' }
  ]
}

const iconMapExtended = {
  ...iconMap,
  'admin-approval': FiShield,
  'admin-users': FiUsers,
  'admin-org': FiFileText
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
          const IconComponent = iconMapExtended[item.id]
          return (
            <button
              key={item.id}
              className={`sidebar-menu-item ${currentPage === item.id ? 'active' : ''}`}
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
