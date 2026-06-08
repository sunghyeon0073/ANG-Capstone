import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signUp } from '../../api/authApi'
import { getSignupScopesTree } from '../../api/scopeApi'

const normalizeScopeType = (scope) => scope?.scopeType ?? scope?.type ?? ''
const scopeTypeOrder = { COMPANY: 0, DEPARTMENT: 1, TEAM: 2 }

const sortScopes = (left, right) => {
  const typeDiff = (scopeTypeOrder[normalizeScopeType(left)] ?? 99) - (scopeTypeOrder[normalizeScopeType(right)] ?? 99)

  if (typeDiff !== 0) return typeDiff

  return (left.name || '').localeCompare(right.name || '', 'ko')
}

const formatScopeLabel = (scope) => {
  const scopeType = normalizeScopeType(scope)

  if (scopeType === 'TEAM') return `${scope.name} (팀)`
  if (scopeType === 'DEPARTMENT') return `${scope.name} (부서)`

  return scope.name
}

const flattenScopes = (scopes) => scopes.flatMap((scope) => [scope, ...flattenScopes(scope.children || [])])

export default function SignUp() {
  const [formData, setFormData] = useState({
    name: '',
    employeeId: '',
    birthDate: '',
    email: '',
    password: '',
    passwordConfirm: ''
  })
  const [scopeTrees, setScopeTrees] = useState([])
  const [selectedCompanyId, setSelectedCompanyId] = useState('')
  const [selectedScopeId, setSelectedScopeId] = useState('')
  const [scopeLoading, setScopeLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const fetchScopes = async () => {
      try {
        const res = await getSignupScopesTree()
        setScopeTrees(Array.isArray(res.data?.data) ? res.data.data : [])
      } catch (error) {
        console.error('조직 목록 로드 실패', error)
        setScopeTrees([])
      } finally {
        setScopeLoading(false)
      }
    }

    fetchScopes()
  }, [])

  const companies = useMemo(() => {
    return scopeTrees
      .filter((scope) => normalizeScopeType(scope) === 'COMPANY')
      .sort(sortScopes)
  }, [scopeTrees])

  const selectedCompany = useMemo(
    () => companies.find((company) => String(company.id) === selectedCompanyId) || null,
    [companies, selectedCompanyId]
  )

  const availableScopes = useMemo(() => {
    if (!selectedCompany) return []

    return flattenScopes(selectedCompany.children || [])
      .filter((scope) => normalizeScopeType(scope) !== 'COMPANY')
      .sort(sortScopes)
  }, [selectedCompany])

  const selectedScope = useMemo(
    () => availableScopes.find((scope) => String(scope.id) === selectedScopeId) || null,
    [availableScopes, selectedScopeId]
  )

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
    
    if (!selectedCompanyId) {
      alert('학교를 선택해주세요.')
      return
    }

    if (!selectedScope) {
      alert('부서를 선택해주세요.')
      return
    }

    try {
      await signUp({
        name: formData.name,
        empNo: formData.employeeId,
        birthdate: formData.birthDate,
        scopeId: Number(selectedScope.id),
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
    <div
      className="auth-container"
      style={{
        minHeight: '100vh',
        overflowY: 'auto',
        alignItems: 'flex-start',
        padding: '24px 20px',
      }}
    >
      <div
        className="auth-box"
        style={{
          width: 'min(760px, 100%)',
          maxWidth: '760px',
          boxSizing: 'border-box',
          margin: '0 auto',
        }}
      >
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
            <div className="form-group" style={{ flex: 1 }}>
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

            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="email">이메일</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="이메일"
                required
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="departmentSelect">학교</label>
              <select
                id="departmentSelect"
                value={selectedCompanyId}
                onChange={(e) => {
                  setSelectedCompanyId(e.target.value)
                  setSelectedScopeId('')
                }}
                required
                disabled={scopeLoading}
              >
                <option value="">학교를 선택하세요</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="teamSelect">부서</label>
              <select
                id="teamSelect"
                value={selectedScopeId}
                onChange={(e) => setSelectedScopeId(e.target.value)}
                required
                disabled={!selectedCompanyId || scopeLoading}
              >
                <option value="">{selectedCompanyId ? '부서를 선택하세요' : '학교를 먼저 선택하세요'}</option>
                {availableScopes.map((scope) => (
                  <option key={scope.id} value={scope.id}>
                    {formatScopeLabel(scope)}
                  </option>
                ))}
              </select>
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
