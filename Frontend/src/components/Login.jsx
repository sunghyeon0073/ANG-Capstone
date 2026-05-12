import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../api/authApi';

export default function Login() {
  const [employeeId, setEmployeeId] = useState('')
  const [password, setPassword] = useState('')
  const navigate = useNavigate()

// 1. 함수 앞에 async를 붙여줍니다.
  const handleLogin = async (e) => {
    e.preventDefault()
    
    try {
      // 2. 백엔드에 로그인 요청 (사번과 비밀번호 전송)
      // authApi.js에서 만든 login 함수를 호출합니다.
      const response = await login({ 
        employeeId: employeeId, 
        password: password 
      });

      // 3. 성공 시: 서버가 보내준 유저 정보를 저장
      // 보통 서버에서 { user: {...}, token: "..." } 이런 식으로 보냅니다.
      if (response.data) {
        console.log('로그인 성공:', response.data);
        
        // 서버에서 준 데이터 구조에 맞춰서 저장하세요.
        localStorage.setItem('user', JSON.stringify(response.data.user));
        localStorage.setItem('token', response.data.token); // 토큰도 있다면 저장
        
        alert(`${response.data.user.name}님 환영합니다!`);
        navigate('/dashboard');
      }
    } catch (error) {
      // 4. 실패 시: 에러 처리
      console.error('로그인 에러:', error);
      const message = error.response?.data?.message || '로그인에 실패했습니다.';
      alert(message);
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