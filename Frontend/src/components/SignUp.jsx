import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signUp } from '../api/authApi'

export default function SignUp() {
  const [formData, setFormData] = useState({
    name: '',
    employeeId: '',
    birthDate: '',
    departmentCode: '',
    email: '',
    password: '',
    passwordConfirm: ''
  })
  const navigate = useNavigate()

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSignUp = async (e) => {
    e.preventDefault()
    if (formData.password !== formData.passwordConfirm) {
      alert('비밀번호가 일치하지 않습니다.')
      return
    }
    try {
      await signUp({
        name: formData.name,
        empNo: formData.employeeId,
        birthdate: formData.birthDate,
        scopeCode: formData.departmentCode,
        email: formData.email,
        password: formData.password,
        passwordConfirm: formData.passwordConfirm
      })
      alert('회원가입이 완료되었습니다. 관리자 승인 후 로그인이 가능합니다.')
      navigate('/login')
    } catch (error) {
      const message = error.response?.data?.message || '회원가입에 실패했습니다.'
      alert(message)
    }
  }

  const handleLoginClick = () => {
    navigate('/login')
  }

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h1>회원가입</h1>
        <form onSubmit={handleSignUp}>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="name">이름</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="이름"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="employeeId">사번</label>
              <input
                type="text"
                id="employeeId"
                name="employeeId"
                value={formData.employeeId}
                onChange={handleChange}
                placeholder="사번"
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="birthDate">생년월일</label>
              <input
                type="date"
                id="birthDate"
                name="birthDate"
                value={formData.birthDate}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="departmentCode">부서코드</label>
              <input
                type="text"
                id="departmentCode"
                name="departmentCode"
                value={formData.departmentCode}
                onChange={handleChange}
                placeholder="부서코드"
                required
              />
            </div>
          </div>

          <div className="form-row full-width">
            <div className="form-group">
              <label htmlFor="email">이메일</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="이메일"
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="password">비밀번호</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="비밀번호"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="passwordConfirm">비밀번호 확인</label>
              <input
                type="password"
                id="passwordConfirm"
                name="passwordConfirm"
                value={formData.passwordConfirm}
                onChange={handleChange}
                placeholder="비밀번호 확인"
                required
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary">
            회원가입
          </button>
        </form>

        <div className="auth-footer">
          <p>이미 회원이신가요?</p>
          <button className="btn btn-secondary" onClick={handleLoginClick}>
            로그인
          </button>
        </div>
      </div>
    </div>
  )
}

