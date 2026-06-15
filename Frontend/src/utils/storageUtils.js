const KEYS = { TOKEN: 'token', REFRESH: 'refreshToken', USER: 'user' }

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

  clear: () => {
    sessionStorage.removeItem(KEYS.TOKEN)
    sessionStorage.removeItem(KEYS.REFRESH)
    sessionStorage.removeItem(KEYS.USER)
  },

  hasAuth: () =>
    Boolean(sessionStorage.getItem(KEYS.TOKEN) && sessionStorage.getItem(KEYS.USER)),
}
