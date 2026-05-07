import { useState } from 'react'
import Login from './components/Login'
import SignUp from './components/SignUp'
import Dashboard from './components/Dashboard'

function App() {
  const [isLogin, setIsLogin] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState(null)

  const handleLoginSuccess = (userData) => {
    setUser(userData)
    setIsAuthenticated(true)
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    setUser(null)
    setIsLogin(true)
  }

  if (isAuthenticated) {
    return <Dashboard user={user} onLogout={handleLogout} />
  }

  return (
    <div className="app">
      <div className="logo">
        <h1>ANG</h1>
        <h2>AI Network Group</h2>
      </div>
      {isLogin ? (
        <Login onSignUpClick={() => setIsLogin(false)} onLoginSuccess={handleLoginSuccess} />
      ) : (
        <SignUp onLoginClick={() => setIsLogin(true)} />
      )}
    </div>
  )
}

export default App