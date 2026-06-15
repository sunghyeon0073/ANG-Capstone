import { createBrowserRouter, Navigate } from 'react-router-dom'
import Login from '../components/auth/Login'
import SignUp from '../components/auth/SignUp'
import Dashboard from '../components/common/Dashboard'
import { session } from '../utils/storageUtils'

function GuestRoute({ children }) {
  return session.hasAuth() ? <Navigate to="/dashboard" replace /> : children
}

function ProtectedRoute({ children }) {
  return session.hasAuth() ? children : <Navigate to="/login" replace />
}

const router = createBrowserRouter([
  { path: '/', element: <Navigate to={session.hasAuth() ? '/dashboard' : '/login'} replace /> },
  { path: '/login',     element: <GuestRoute><Login /></GuestRoute> },
  { path: '/signup',    element: <GuestRoute><SignUp /></GuestRoute> },
  { path: '/dashboard', element: <ProtectedRoute><Dashboard /></ProtectedRoute> },
])

export default router
