import { create } from 'zustand'

const useAppStore = create((set) => ({
  user: JSON.parse(localStorage.getItem('ang_user') || 'null'),
  setUser: (user) => {
    localStorage.setItem('ang_user', JSON.stringify(user))
    set({ user })
  },
  clearUser: () => {
    localStorage.removeItem('ang_user')
    set({ user: null })
  },
}))

export default useAppStore