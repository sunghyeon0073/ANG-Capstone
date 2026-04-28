function SignupPage({ onSignupSuccess, onGoToLogin }) {
  const [formData, setFormData] = useState({
    name: '', empId: '', birth: '', email: '', 
    password: '', confirmPassword: '', deptCode: ''
  });

  // 비밀번호 조건: 6자리 이상, 25자리 미만, 영문 + 특수문자 조합
  const validatePassword = (pw) => {
    const regex = /^(?=.*[a-zA-Z])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{6,24}$/;
    return regex.test(pw);
  };

  const isFormValid = 
    Object.values(formData).every(val => val.trim() !== '') &&
    validatePassword(formData.password) &&
    formData.password === formData.confirmPassword;

  const handleChange = (key, val) => setFormData(prev => ({ ...prev, [key]: val }));

  return (
    <div className="min-h-screen flex items-center justify-center p-10" style={{ background: 'var(--line-3)' }}>
      <Card style={{ width: 500, padding: 40 }}>
        <div className="mb-8">
          <h2 style={{ fontSize: 24, fontWeight: 900, color: 'var(--ink)' }}>계정 생성</h2>
          <p style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>시스템 접근을 위해 모든 항목을 입력해주세요.</p>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-5">
          <div className="space-y-1.5"><SectionLabel>이름</SectionLabel>
            <Input placeholder="성함 입력" value={formData.name} onChange={v => handleChange('name', v)} /></div>
          <div className="space-y-1.5"><SectionLabel>사번</SectionLabel>
            <Input placeholder="8자리 사번" value={formData.empId} onChange={v => handleChange('empId', v)} /></div>
          <div className="space-y-1.5"><SectionLabel>생년월일</SectionLabel>
            <Input type="date" value={formData.birth} onChange={v => handleChange('birth', v)} /></div>
          <div className="space-y-1.5"><SectionLabel>부서 고유 코드</SectionLabel>
            <Input placeholder="D-XXXX" value={formData.deptCode} onChange={v => handleChange('deptCode', v)} /></div>
          <div className="col-span-2 space-y-1.5"><SectionLabel>이메일</SectionLabel>
            <Input icon="mail" placeholder="email@company.com" value={formData.email} onChange={v => handleChange('email', v)} /></div>
          <div className="space-y-1.5">
            <SectionLabel>비밀번호</SectionLabel>
            <Input type="password" placeholder="영문+특수 6~24자" value={formData.password} onChange={v => handleChange('password', v)} />
          </div>
          <div className="space-y-1.5">
            <SectionLabel>비밀번호 확인</SectionLabel>
            <Input type="password" placeholder="비밀번호 재입력" value={formData.confirmPassword} onChange={v => handleChange('confirmPassword', v)} />
          </div>
        </div>

        {formData.password && !validatePassword(formData.password) && (
          <div className="mt-3 text-[11px] font-bold text-red-500">
            * 비밀번호는 영문과 특수문자를 포함하여 6~24자여야 합니다.
          </div>
        )}

        <Btn variant="dark" size="lg" className="w-full mt-8" onClick={onSignupSuccess} disabled={!isFormValid}>
          가입 승인 요청
        </Btn>
        <Btn variant="ghost" className="w-full mt-2" onClick={onGoToLogin}>이미 계정이 있나요? 로그인</Btn>
      </Card>
    </div>
  );
}
window.SignupPage = SignupPage; // 전역 등록