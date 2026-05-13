export default function MyPage({ user }) {
  return (
    <div className="page-content">
      <h1>마이페이지</h1>

      <div className="mypage-container">
        <div className="mypage-section">
          <h2>기본 정보</h2>
          <div className="info-group">
            <label>이름</label>
            <input type="text" value={user?.name || ''} disabled />
          </div>
          <div className="info-group">
            <label>사번</label>
            <input type="text" value={user?.empNo || ''} disabled />
          </div>
          <div className="info-group">
            <label>부서</label>
            <input type="text" value={user?.department || ''} disabled />
          </div>
          <div className="info-group">
            <label>직급</label>
            <input type="text" value={user?.position || ''} disabled />
          </div>
          <div className="info-group">
            <label>이메일</label>
            <input type="email" value={user?.email || ''} disabled />
          </div>
        </div>

        <div className="mypage-section">
          <h2>비밀번호 변경</h2>
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
