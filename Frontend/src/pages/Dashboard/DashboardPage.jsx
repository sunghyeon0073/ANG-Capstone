import { useNavigate } from 'react-router-dom'
import useAppStore from '../../store'

export default function DashboardPage() {
  const user = useAppStore(s => s.user)
  const clearUser = useAppStore(s => s.clearUser)
  const navigate = useNavigate()

  const handleLogout = () => {
    clearUser()
    navigate('/')
  }

  return (
    <div style={{ padding: 40 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 900 }}>ANG 대시보드</h1>
        <button onClick={handleLogout}
          style={{ padding: '8px 20px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
          로그아웃
        </button>
      </div>
      {user && (
        <div style={{ background: '#f0f9ff', border: '1.5px solid #bae6fd', borderRadius: 12, padding: 24 }}>
          <p style={{ fontSize: 18, fontWeight: 700 }}>안녕하세요, {user.name}님!</p>
          <p style={{ color: '#666', marginTop: 4 }}>이메일: {user.email}</p>
          <p style={{ color: '#666' }}>역할: {user.role}</p>
        </div>
      )}
    </div>
  )
}
