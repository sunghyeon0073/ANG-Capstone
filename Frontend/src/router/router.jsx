import { createBrowserRouter, Navigate } from 'react-router-dom'
import Login from '../components/auth/Login'
import SignUp from '../components/auth/SignUp'
import Dashboard from '../components/common/Dashboard'

const hasAuthSession = () => Boolean(localStorage.getItem('token') && localStorage.getItem('user'))

function ProtectedRoute({ children }) {
  return hasAuthSession() ? children : <Navigate to="/login" replace />
}

const router = createBrowserRouter([
  {
    path: '/',
    element: hasAuthSession() ? <Navigate to="/dashboard" replace /> : <Login />
  },
  {
    path: '/login',
    element: <Login />
  },
  {
    path: '/signup',
    element: <SignUp />
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
