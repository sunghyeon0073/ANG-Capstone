import { useState } from 'react'
import { FiHome, FiFileText, FiCheckCircle, FiCalendar, FiFolder, FiMapPin, FiMail, FiMessageCircle, FiUsers, FiBell, FiShield } from 'react-icons/fi'

export default function TopNavBar({ user, onLogout, currentPage, onPageChange }) {
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [notificationCount] = useState(0)

  const menuItems = [
    { id: 'home', label: '홈', icon: FiHome },
    { id: 'document', label: '문서작성', icon: FiFileText },
    { id: 'esignature', label: '전자결재', icon: FiCheckCircle },
    { id: 'calendar', label: '캘린더', icon: FiCalendar },
    { id: 'file', label: '파일함', icon: FiFolder },
    { id: 'board', label: '게시판', icon: FiFileText },
    { id: 'mail', label: '메일', icon: FiMail },
    { id: 'chat', label: '채팅', icon: FiMessageCircle },
    { id: 'organization', label: '조직도', icon: FiUsers }
  ]

  // 관리자 권한(Level 50 이상)이 있는 경우 관리자 탭 추가
  if (user?.roleLevel >= 50) {
    menuItems.push({ id: 'admin', label: '관리자 페이지', icon: FiShield });
  }

  const getInitials = (name) => {
    return name
      ?.split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase() || 'U'
  }

  const handleMyPageClick = () => {
    onPageChange('mypage')
    setShowProfileMenu(false)
  }

  const handleLogoutClick = () => {
    onLogout()
    setShowProfileMenu(false)
  }

  const getMainCategory = (page) => {
    const category = page.split('-')[0]
    return category === 'organization' ? 'org' : category
  }

  const currentMainCategory = getMainCategory(currentPage)

  return (
    <div className="topnavbar">
      <div className="topnavbar-left">
        <div className="topnavbar-logo">ANG</div>
      </div>

      <div className="topnavbar-center">
        <nav className="topnavbar-menu">
          {menuItems.map(item => {
            const IconComponent = item.icon
            const itemCategory = item.id === 'organization' ? 'org' : item.id
            return (
              <button
                key={item.id}
                onClick={() => onPageChange(item.id)}
                className={`topnavbar-menu-item ${currentMainCategory === itemCategory ? 'active' : ''}`}
              >
                <IconComponent className="topnavbar-icon" />
                <span className="topnavbar-label">{item.label}</span>
              </button>
            )
          })}
        </nav>
      </div>

      <div className="topnavbar-right">
        <div className="topnavbar-search">
          <input type="text" placeholder="검색" />
        </div>

        <button className="topnavbar-notification">
          <FiBell className="notification-icon" />
          <span>알림</span>
          {notificationCount > 0 && (
            <span className="notification-badge">{notificationCount}</span>
          )}
        </button>

        <div className="topnavbar-profile-container">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="topnavbar-profile-button"
          >
            <div className="profile-avatar">
              {getInitials(user?.name)}
            </div>
            <span className="topnavbar-username">{user?.name}</span>
          </button>

          {showProfileMenu && (
            <div className="profile-dropdown">
              <div className="profile-header">
                <div className="profile-large-avatar">
                  {getInitials(user?.name)}
                </div>
                <div className="profile-info">
                  <div className="profile-name">{user?.name}</div>
                  <div className="profile-role">
                    {user?.department} • {user?.position}
                  </div>
                  <div className="profile-email">{user?.email}</div>
                </div>
              </div>

              <div className="profile-menu">
                <button
                  className="profile-menu-item"
                  onClick={handleMyPageClick}
                >
                  <span>마이페이지</span>
                </button>
                <button
                  className="profile-menu-item logout"
                  onClick={handleLogoutClick}
                >
                  <span>로그아웃</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
