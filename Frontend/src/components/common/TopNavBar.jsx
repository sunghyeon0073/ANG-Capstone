import '../../style/navigation.css'
import { useEffect, useRef, useState } from 'react'
import { FiFileText, FiCheckCircle, FiCalendar, FiFolder, FiMail, FiMessageCircle, FiUsers, FiBell, FiShield, FiX, FiCheck } from 'react-icons/fi'
import { getUserProfileImage } from '../../api/userApi'
import { session } from '../../utils/storageUtils'

const TYPE_LABEL = { BOARD: '게시판', MAIL: '메일', APPROVAL: '전자결재', CHAT: '채팅', AI: 'AI 예약' }
const TYPE_COLOR = { BOARD: '#3b82f6', MAIL: '#10b981', APPROVAL: '#f59e0b', CHAT: '#8b5cf6', AI: '#ec4899' }

function formatRelativeTime(dateStr) {
  if (!dateStr) return ''
  const normalized = dateStr.includes('Z') || dateStr.includes('+') ? dateStr : dateStr + 'Z'
  const diff = Date.now() - new Date(normalized).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return '방금 전'
  if (m < 60) return `${m}분 전`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}시간 전`
  return `${Math.floor(h / 24)}일 전`
}

export default function TopNavBar({
  user,
  onLogout,
  currentPage,
  onPageChange,
  onOpenChatWindow,
  isChatWindowOpen,
  chatUnreadCount = 0,
  notifications = [],
  onMarkRead,
  onMarkAllRead,
  onNotificationNavigate,
}) {
  const [profileImageSrc, setProfileImageSrc] = useState('')
  const [showProfileMenu, setShowProfileMenu] = useState(
    () => session.isProfileMenuOpen()
  )
  const [showNotifications, setShowNotifications] = useState(
    () => session.isNotificationPanelOpen()
  )
  const notificationPanelRef = useRef(null)
  const notificationBtnRef = useRef(null)

  useEffect(() => {
    if (!user?.id || !user.profileImageUrl) {
      return undefined
    }

    let objectUrl = ''
    let cancelled = false

    getUserProfileImage(user.id)
      .then((response) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(response.data)
        setProfileImageSrc(objectUrl)
      })
      .catch(() => setProfileImageSrc(''))

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [user?.id, user?.profileImageUrl])

  useEffect(() => {
    if (!showNotifications) return
    const handleClick = (e) => {
      if (
        notificationPanelRef.current && !notificationPanelRef.current.contains(e.target) &&
        notificationBtnRef.current && !notificationBtnRef.current.contains(e.target)
      ) {
        setShowNotifications(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showNotifications])

  useEffect(() => {
    session.setNotificationPanelOpen(showNotifications)
  }, [showNotifications])

  useEffect(() => {
    session.setProfileMenuOpen(showProfileMenu)
  }, [showProfileMenu])

  const menuItems = [
    { id: 'document', label: '문서작성', icon: FiFileText },
    { id: 'esignature', label: '전자결재', icon: FiCheckCircle },
    { id: 'calendar', label: '캘린더', icon: FiCalendar },
    { id: 'file', label: '파일함', icon: FiFolder },
    { id: 'board', label: '게시판', icon: FiFileText },
    { id: 'mail', label: '메일', icon: FiMail },
    { id: 'organization', label: '조직도', icon: FiUsers }
  ]

  if (user?.roleLevel >= 50) {
    menuItems.push({ id: 'admin', label: '관리자 페이지', icon: FiShield })
  }

  const getInitials = (name) =>
    name?.split(' ').map((w) => w[0]).join('').toUpperCase() || 'U'

  const renderAvatar = (className) => {
    if (profileImageSrc) {
      return <img src={profileImageSrc} alt={`${user?.name || '사용자'} 프로필`} className={`${className} profile-image`} />
    }
    return <div className={className}>{getInitials(user?.name)}</div>
  }

  const handleMyPageClick = () => { onPageChange('mypage'); setShowProfileMenu(false) }
  const handleLogoutClick = () => { onLogout(); setShowProfileMenu(false) }

  const getMainCategory = (page) => {
    const category = page.split('-')[0]
    return category === 'organization' ? 'org' : category
  }
  const currentMainCategory = getMainCategory(currentPage)

  const unreadCount = notifications.length
  const hasUnread = unreadCount > 0

  const handleNotificationClick = async (n) => {
    await onMarkRead?.(n.id)
    onNotificationNavigate?.(n.type)
    setShowNotifications(false)
  }

  return (
    <div className="topnavbar">
      <div className="topnavbar-left">
        <button className="topnavbar-logo" onClick={() => onPageChange('home-dashboard')}>ANG</button>
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
        <button
          type="button"
          className={`topnavbar-chat-button ${(currentMainCategory === 'chat' || isChatWindowOpen) ? 'active' : ''}`}
          onClick={onOpenChatWindow}
        >
          <FiMessageCircle className="notification-icon" />
          <span>채팅</span>
          {chatUnreadCount > 0 && (
            <span className="chat-unread-badge">
              {chatUnreadCount > 99 ? '99+' : chatUnreadCount}
            </span>
          )}
        </button>

        <div className="topnavbar-notification-container">
          <button
            ref={notificationBtnRef}
            className={`topnavbar-notification ${showNotifications ? 'active' : ''}`}
            onClick={() => setShowNotifications(prev => !prev)}
            type="button"
          >
            <FiBell className="notification-icon" />
            <span>알림</span>
            {hasUnread && (
              <span className="notification-badge">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="notification-panel" ref={notificationPanelRef}>
              <div className="notification-panel-header">
                <span className="notification-panel-title">알림</span>
                {hasUnread && (
                  <button
                    className="notification-mark-all"
                    type="button"
                    onClick={() => { onMarkAllRead?.(); }}
                  >
                    <FiCheck size={13} /> 모두 읽음
                  </button>
                )}
              </div>

              <div className="notification-panel-body">
                {notifications.length === 0 ? (
                  <div className="notification-empty">
                    <FiBell size={28} />
                    <p>새로운 알림이 없습니다.</p>
                  </div>
                ) : (
                  notifications.map(n => (
                    <div
                      key={n.id}
                      className="notification-item"
                      onClick={() => handleNotificationClick(n)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => e.key === 'Enter' && handleNotificationClick(n)}
                    >
                      <span
                        className="notification-item-dot"
                        style={{ background: TYPE_COLOR[n.type] || '#6b7280' }}
                      />
                      <div className="notification-item-body">
                        <div className="notification-item-header">
                          <span className="notification-item-type" style={{ color: TYPE_COLOR[n.type] || '#6b7280' }}>
                            {TYPE_LABEL[n.type] || n.type}
                          </span>
                          <span className="notification-item-time">{formatRelativeTime(n.createdAt)}</span>
                        </div>
                        <p className="notification-item-title">{n.title}</p>
                        {n.body && <p className="notification-item-desc">{n.body}</p>}
                      </div>
                      <button
                        className="notification-item-dismiss"
                        type="button"
                        onClick={e => { e.stopPropagation(); onMarkRead?.(n.id) }}
                        title="읽음 처리"
                      >
                        <FiX size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="topnavbar-profile-container">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="topnavbar-profile-button"
          >
            {renderAvatar('profile-avatar')}
            <span className="topnavbar-username">{user?.name}</span>
          </button>

          {showProfileMenu && (
            <div className="profile-dropdown">
              <div className="profile-header">
                {renderAvatar('profile-large-avatar')}
                <div className="profile-info">
                  <div className="profile-name">{user?.name}</div>
                  <div className="profile-role">
                    {user?.department || user?.dept || '소속 정보 없음'} · {user?.position}
                  </div>
                  <div className="profile-email">{user?.email}</div>
                </div>
              </div>

              <div className="profile-menu">
                <button className="profile-menu-item" onClick={handleMyPageClick}>
                  <span>마이페이지</span>
                </button>
                <button className="profile-menu-item logout" onClick={handleLogoutClick}>
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
