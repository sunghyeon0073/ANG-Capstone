import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const [employeeId, setEmployeeId] = useState('')
  const [password, setPassword] = useState('')
  const navigate = useNavigate()

  const handleLogin = (e) => {
    e.preventDefault()
    console.log('로그인:', { employeeId, password })
    if (employeeId && password) {
      const userData = {
        employeeId,
        name: '이상영',
        department: '한사운영팀',
        position: '주임',
        email: `${employeeId}@ang.lab`
      }
      localStorage.setItem('user', JSON.stringify(userData))
      navigate('/dashboard')
    }
  }

  const handleSignUpClick = () => {
    navigate('/signup')
  }

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h1>로그인</h1>
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="employeeId">사번</label>
            <input
              type="text"
              id="employeeId"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              placeholder="사번을 입력하세요"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">비밀번호</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호를 입력하세요"
              required
            />
          </div>

          <button type="submit" className="btn btn-primary">
            로그인
          </button>
        </form>

        <div className="auth-footer">
          <p>아직 회원이 아니신가요?</p>
          <button className="btn btn-secondary" onClick={handleSignUpClick}>
            회원가입
          </button>
        </div>
      </div>
    </div>
  )
}
