import { createBrowserRouter } from 'react-router-dom'
import Login from '../components/auth/Login'
import SignUp from '../components/auth/SignUp'
import Dashboard from '../components/common/Dashboard'

const router = createBrowserRouter([
  {
    path: '/',
    element: <Login />
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
    element: <Dashboard />
  }
])

export default router