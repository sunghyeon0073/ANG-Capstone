function LoginPage({ onLoginSuccess, onGoToSignup }) {
  const [empId, setEmpId] = useState('');
  const [password, setPassword] = useState('');

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--line-3)' }}>
      <Card style={{ width: 380, padding: 40 }}>
        <div className="text-center mb-8">
          <h2 style={{ fontSize: 22, fontWeight: 900 }}>Auth-01 Login</h2>
        </div>
        <div className="space-y-5">
          <div className="space-y-1.5">
            <SectionLabel>사번</SectionLabel>
            <Input icon="hash" placeholder="사번을 입력하세요" value={empId} onChange={setEmpId} />
          </div>
          <div className="space-y-1.5">
            <SectionLabel>비밀번호</SectionLabel>
            <Input icon="lock" type="password" placeholder="••••••••" value={password} onChange={setPassword} />
          </div>
          <Btn variant="primary" size="lg" className="w-full" onClick={() => onLoginSuccess({ empId, name: '사용자' })}>
            접속하기
          </Btn>
          <Btn variant="subtle" className="w-full" onClick={onGoToSignup}>신규 계정 등록</Btn>
        </div>
      </Card>
    </div>
  );
}
window.LoginPage = LoginPage; // 전역 등록