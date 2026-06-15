import '../../style/mypage.css'
import { useEffect, useMemo, useState } from 'react'
import { getScopes } from '../../api/scopeApi'
import { getUserProfileImage, updateUser, uploadUserProfileImage } from '../../api/userApi'

const normalizeScopeType = (scope) => scope?.scopeType ?? scope?.type ?? ''

const getAvatarFallback = (name) => {
  if (!name) return 'U'
  return name.trim().slice(0, 1).toUpperCase()
}

const buildDisplayScope = (user, scopes) => {
  const scopeMap = new Map(
    scopes.map((scope) => [String(scope.scopeCode ?? scope.code ?? scope.id), scope])
  )

  const memberships = Array.isArray(user?.departments) ? user.departments : []
  const resolvedMemberships = memberships
    .map((membership) => {
      const scopeKey = String(membership?.scopeCode ?? '')
      const scope = scopeMap.get(scopeKey)

      if (!membership) {
        return null
      }

      return {
        ...membership,
        scopeType: normalizeScopeType(scope),
        parentId: scope?.parentId ?? null,
        scopeName: membership?.scopeName || scope?.name || membership?.name || '',
      }
    })
    .filter(Boolean)

  const school = resolvedMemberships.find((membership) => membership.scopeType === 'COMPANY')
    || resolvedMemberships.find((membership) => membership.parentId == null)
    || resolvedMemberships[0]

  const department = resolvedMemberships.find((membership) => membership.scopeType === 'DEPARTMENT')
    || resolvedMemberships.find((membership) => membership.scopeType === 'TEAM')
    || resolvedMemberships[1]

  return {
    school: school?.scopeName || user?.dept || '-',
    department: department?.scopeName || user?.dept || '-',
  }
}

export default function MyPage({ user, onUserUpdate }) {
  const [scopes, setScopes] = useState([])
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    profileImageUrl: '',
  })
  const [profileImageFile, setProfileImageFile] = useState(null)
  const [profileImagePreviewUrl, setProfileImagePreviewUrl] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const fetchScopes = async () => {
      try {
        const res = await getScopes()
        const data = res.data?.data || []
        setScopes(Array.isArray(data) ? data : [])
      } catch (error) {
        console.error('마이페이지 스코프 로드 실패', error)
        setScopes([])
      }
    }

    fetchScopes()
  }, [])

  useEffect(() => {
    if (!user) return

    setFormData({
      name: user.name || '',
      email: user.email || '',
      profileImageUrl: user.profileImageUrl || '',
    })
    setProfileImageFile(null)
  }, [user])

  useEffect(() => {
    if (!user?.id || !user.profileImageUrl || profileImageFile) return undefined

    let objectUrl = ''
    let cancelled = false

    getUserProfileImage(user.id)
      .then((response) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(response.data)
        setProfileImagePreviewUrl(objectUrl)
      })
      .catch((error) => {
        console.error('프로필 이미지 조회 실패', error)
        setProfileImagePreviewUrl('')
      })

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [profileImageFile, user?.id, user?.profileImageUrl])

  const displayScope = useMemo(() => buildDisplayScope(user, scopes), [user, scopes])

  const handleImageChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      alert('JPG 또는 PNG 이미지만 등록할 수 있습니다.')
      return
    }

    setProfileImageFile(file)
    setProfileImagePreviewUrl((previousUrl) => {
      if (previousUrl?.startsWith('blob:')) URL.revokeObjectURL(previousUrl)
      return URL.createObjectURL(file)
    })
  }

  const handleSaveProfile = async (event) => {
    event.preventDefault()

    if (!user?.id) {
      alert('사용자 정보를 찾을 수 없습니다.')
      return
    }

    setIsSaving(true)
    setErrorMessage('')

    try {
      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim(),
      }

      const profileResponse = await updateUser(user.id, payload)
      let updatedUser = profileResponse.data?.data || profileResponse.data

      if (profileImageFile) {
        const imageResponse = await uploadUserProfileImage(user.id, profileImageFile)
        updatedUser = imageResponse.data?.data || imageResponse.data
        setProfileImageFile(null)
      }

      if (onUserUpdate) {
        onUserUpdate(updatedUser)
      }

      sessionStorage.setItem('user', JSON.stringify(updatedUser))
      alert('마이페이지 정보가 저장되었습니다.')
    } catch (error) {
      const message = error.response?.data?.message || '프로필 저장에 실패했습니다.'
      setErrorMessage(message)
      alert(message)
    } finally {
      setIsSaving(false)
    }
  }

  const avatarContent = profileImagePreviewUrl
    ? <img src={profileImagePreviewUrl} alt="프로필 미리보기" className="mypage-avatar-image" />
    : <span>{getAvatarFallback(formData.name)}</span>

  return (
    <div className="page-content mypage-page">
      <div className="mypage-hero">
        <div>
          <p className="mypage-kicker">Profile</p>
          <h1>마이페이지</h1>
          <p className="mypage-description">기본 정보와 프로필 사진을 관리할 수 있습니다.</p>
        </div>
      </div>

      <div className="mypage-container">
        <form className="mypage-section mypage-profile-section" onSubmit={handleSaveProfile}>
          <div className="mypage-section-header">
            <h2>기본 정보</h2>
            <button type="submit" className="btn btn-primary" disabled={isSaving}>
              {isSaving ? '저장 중...' : '저장'}
            </button>
          </div>

          <div className="mypage-profile-top">
            <div className="mypage-avatar-card">
              <div className="mypage-avatar">
                {avatarContent}
              </div>
              <label className="mypage-upload-button">
                사진 등록
                <input type="file" accept="image/*" onChange={handleImageChange} />
              </label>
              <button
                type="button"
                className="mypage-text-button"
                disabled={!profileImageFile}
                onClick={() => {
                  setProfileImageFile(null)
                  setProfileImagePreviewUrl('')
                }}
              >
                선택 취소
              </button>
            </div>

            <div className="mypage-info-grid">
              <div className="info-group editable">
                <label htmlFor="name">이름</label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="이름을 입력하세요"
                />
              </div>

              <div className="info-group readonly">
                <label htmlFor="empNo">사번</label>
                <input id="empNo" type="text" value={user?.empNo || ''} readOnly />
              </div>

              <div className="info-group readonly">
                <label htmlFor="school">학교</label>
                <input id="school" type="text" value={displayScope.school} readOnly />
              </div>

              <div className="info-group readonly">
                <label htmlFor="department">부서</label>
                <input id="department" type="text" value={displayScope.department} readOnly />
              </div>

              <div className="info-group readonly">
                <label htmlFor="position">직급</label>
                <input id="position" type="text" value={user?.position || ''} readOnly />
              </div>

              <div className="info-group editable">
                <label htmlFor="email">이메일</label>
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="이메일을 입력하세요"
                />
              </div>

              <div className="info-group readonly full-width-field">
                <label htmlFor="birthdate">생년월일</label>
                <input id="birthdate" type="text" value={user?.birthdate || ''} readOnly />
              </div>
            </div>
          </div>

          {errorMessage && <p className="mypage-error">{errorMessage}</p>}
        </form>

        <div className="mypage-section">
          <div className="mypage-section-header">
            <h2>비밀번호 변경</h2>
          </div>
          <div className="info-group">
            <label>현재 비밀번호</label>
            <input type="password" placeholder="현재 비밀번호를 입력하세요" />
          </div>
          <div className="info-group">
            <label>새 비밀번호</label>
            <input type="password" placeholder="새 비밀번호를 입력하세요" />
          </div>
          <div className="info-group">
            <label>비밀번호 확인</label>
            <input type="password" placeholder="비밀번호를 다시 입력하세요" />
          </div>
          <button className="btn btn-primary">비밀번호 변경</button>
        </div>
      </div>
    </div>
  )
}
