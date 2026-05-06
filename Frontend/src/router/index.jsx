import { createBrowserRouter, Navigate } from 'react-router-dom'
import LoginPage from '../pages/Login/LoginPage'
import DashboardPage from '../pages/Dashboard/DashboardPage'
import NotFound from '../pages/NotFound/NotFound'
import TestPage from '../pages/Test/TestPage'
import useAppStore from '../store'

function PrivateRoute({ children }) {
  const user = useAppStore(s => s.user)
  return user ? children : <Navigate to="/" replace />
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <LoginPage />,
  },
  {
    path: '/dashboard',
    element: <PrivateRoute><DashboardPage /></PrivateRoute>,
  },
  {
    path: '/test',
    element: <TestPage />,
  },
  {
    path: '*',
    element: <NotFound />,
  },
])

export default router
