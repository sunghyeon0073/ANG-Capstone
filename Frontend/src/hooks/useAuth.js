import { useState, useEffect } from 'react'
import { session } from '../utils/storageUtils'

/**
 * 현재 로그인 사용자를 반환한다.
 * sessionStorage 변경(다른 탭 로그아웃 등) 시 자동으로 갱신된다.
 */
export function useAuth() {
  const [user, setUser] = useState(() => session.getUser())

  useEffect(() => {
    const sync = () => setUser(session.getUser())
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])

  return user
}
