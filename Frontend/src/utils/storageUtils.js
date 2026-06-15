const KEYS = {
  TOKEN: 'token',
  REFRESH: 'refreshToken',
  USER: 'user',
  DASHBOARD_PAGE: 'dashboardPage',
  CHAT_WINDOW_OPEN: 'chatWindowOpen',
  CHAT_OPEN_ROOM_IDS: 'chatOpenRoomIds',
  NOTIFICATION_PANEL_OPEN: 'notificationPanelOpen',
  PROFILE_MENU_OPEN: 'profileMenuOpen',
}

export const session = {
  getToken:        () => sessionStorage.getItem(KEYS.TOKEN),
  getRefreshToken: () => sessionStorage.getItem(KEYS.REFRESH),

  getUser: () => {
    try { return JSON.parse(sessionStorage.getItem(KEYS.USER) || 'null') }
    catch { return null }
  },

  getUserEmpNo: () => session.getUser()?.empNo ?? null,

  setTokens: (accessToken, refreshToken) => {
    sessionStorage.setItem(KEYS.TOKEN, accessToken)
    if (refreshToken) sessionStorage.setItem(KEYS.REFRESH, refreshToken)
  },

  setUser: (user) => sessionStorage.setItem(KEYS.USER, JSON.stringify(user)),

  getDashboardPage: () => sessionStorage.getItem(KEYS.DASHBOARD_PAGE),
  setDashboardPage: (page) => sessionStorage.setItem(KEYS.DASHBOARD_PAGE, page),
  isChatWindowOpen: () => sessionStorage.getItem(KEYS.CHAT_WINDOW_OPEN) === 'true',
  setChatWindowOpen: (isOpen) => {
    sessionStorage.setItem(KEYS.CHAT_WINDOW_OPEN, String(Boolean(isOpen)))
  },
  getChatOpenRoomIds: () => {
    try {
      const roomIds = JSON.parse(sessionStorage.getItem(KEYS.CHAT_OPEN_ROOM_IDS) || '[]')
      return Array.isArray(roomIds)
        ? roomIds.map(Number).filter(Number.isFinite)
        : []
    } catch {
      return []
    }
  },
  setChatOpenRoomIds: (roomIds) => {
    sessionStorage.setItem(KEYS.CHAT_OPEN_ROOM_IDS, JSON.stringify(roomIds))
  },
  isNotificationPanelOpen: () =>
    sessionStorage.getItem(KEYS.NOTIFICATION_PANEL_OPEN) === 'true',
  setNotificationPanelOpen: (isOpen) => {
    sessionStorage.setItem(KEYS.NOTIFICATION_PANEL_OPEN, String(Boolean(isOpen)))
  },
  isProfileMenuOpen: () =>
    sessionStorage.getItem(KEYS.PROFILE_MENU_OPEN) === 'true',
  setProfileMenuOpen: (isOpen) => {
    sessionStorage.setItem(KEYS.PROFILE_MENU_OPEN, String(Boolean(isOpen)))
  },

  clear: () => {
    sessionStorage.removeItem(KEYS.TOKEN)
    sessionStorage.removeItem(KEYS.REFRESH)
    sessionStorage.removeItem(KEYS.USER)
    sessionStorage.removeItem(KEYS.DASHBOARD_PAGE)
    sessionStorage.removeItem(KEYS.CHAT_WINDOW_OPEN)
    sessionStorage.removeItem(KEYS.CHAT_OPEN_ROOM_IDS)
    sessionStorage.removeItem(KEYS.NOTIFICATION_PANEL_OPEN)
    sessionStorage.removeItem(KEYS.PROFILE_MENU_OPEN)
  },

  hasAuth: () =>
    Boolean(sessionStorage.getItem(KEYS.TOKEN) && sessionStorage.getItem(KEYS.USER)),
}
