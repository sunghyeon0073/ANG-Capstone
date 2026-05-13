import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../api/authApi';

export default function Login() {
  const [employeeId, setEmployeeId] = useState('')
  const [password, setPassword] = useState('')
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    try {
      // 더미 로그인: 사번 '1' 비밀번호 '1'이면 백엔드 호출 없이 로컬 저장 및 이동
      if (employeeId === '1' && password === '1') {
        const dummyUser = { id: 1, empNo: '1', name: '더미 사용자' }
        const dummyToken = 'dummy-token'
        localStorage.setItem('user', JSON.stringify(dummyUser))
        localStorage.setItem('token', dummyToken)
        navigate('/dashboard')
        return
      }

      const response = await login({ empNo: employeeId, password })
      const { data } = response.data
      localStorage.setItem('user', JSON.stringify(data.user))
      localStorage.setItem('token', data.accessToken)
      navigate('/dashboard')
    } catch (error) {
      const message = error.response?.data?.message || '로그인에 실패했습니다.'
      alert(message)
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