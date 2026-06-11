import { createBrowserRouter, Navigate } from 'react-router-dom'
import Login from '../components/auth/Login'
import SignUp from '../components/auth/SignUp'
import Dashboard from '../components/common/Dashboard'

const hasAuthSession = () => Boolean(sessionStorage.getItem('token') && sessionStorage.getItem('user'))

// 미인증 사용자만 접근 가능 — 이미 로그인 시 대시보드로 즉시 redirect
function GuestRoute({ children }) {
  return hasAuthSession() ? <Navigate to="/dashboard" replace /> : children
}

// 인증된 사용자만 접근 가능
function ProtectedRoute({ children }) {
  return hasAuthSession() ? children : <Navigate to="/login" replace />
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to={hasAuthSession() ? '/dashboard' : '/login'} replace />
  },
  {
    path: '/login',
    element: <GuestRoute><Login /></GuestRoute>
  },
  {
    path: '/signup',
    element: <GuestRoute><SignUp /></GuestRoute>
  },
  {
    path: '/dashboard',
    element: (
      <ProtectedRoute>
        <Dashboard />
      </ProtectedRoute>
    )
  }
])

export default router
