import React, { useState } from 'react';
import { Card, Btn, Input, SectionLabel } from '../ui';
import { USERS } from '../data';

function LoginPage({ onLoginSuccess, onGoToSignup }) {
  const [empId, setEmpId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!empId.trim() || !password.trim()) {
      setError('사번과 비밀번호를 입력해주세요.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emp_id: empId.trim(), password }),
      });
      const data = await res.json();

      if (data.ok) {
        onLoginSuccess({ ...data.user, id: data.user.emp_id });
        return;
      } else {
        setError(data.message);
      }
    } catch {
      // 백엔드 없을 때 mock 데이터로 fallback
      const user = USERS.find(u => u.emp === empId.trim());
      if (user) {
        onLoginSuccess(user);
        return;
      }
      setError('사번 또는 비밀번호가 올바르지 않습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--line-3)' }}>
      <div style={{ width: 400 }}>
        <div className="text-center mb-8">
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 900, fontSize: 32, letterSpacing: '-0.04em', color: 'var(--primary)', marginBottom: 8 }}>ANG</div>
          <div className="mono text-[11px] uppercase tracking-widest" style={{ color: 'var(--ink-4)' }}>AI Network Groupware</div>
        </div>
        <Card style={{ padding: 36 }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 24 }}>로그인</h2>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <SectionLabel>사번</SectionLabel>
              <Input icon="hash" placeholder="예: 2024-0143" value={empId} onChange={setEmpId}
                onKeyDown={e => e.key === 'Enter' && handleLogin()} />
            </div>
            <div className="space-y-1.5">
              <SectionLabel>비밀번호</SectionLabel>
              <Input icon="lock" type="password" placeholder="비밀번호 입력" value={password} onChange={setPassword}
                onKeyDown={e => e.key === 'Enter' && handleLogin()} />
            </div>
            {error && (
              <div className="text-[12px] font-semibold" style={{ color: 'var(--danger)' }}>{error}</div>
            )}
            <Btn variant="primary" size="lg" style={{ width: '100%', justifyContent: 'center' }}
              onClick={handleLogin} disabled={loading}>
              {loading ? '로그인 중...' : '접속하기'}
            </Btn>
            <Btn variant="subtle" style={{ width: '100%', justifyContent: 'center' }} onClick={onGoToSignup}>
              신규 계정 등록
            </Btn>
          </div>
          <div className="mono text-[10.5px] mt-5 text-center" style={{ color: 'var(--ink-4)' }}>
            테스트 사번: 2024-0143 · 비밀번호: 아무거나
          </div>
        </Card>
      </div>
    </div>
  );
}

export default LoginPage;
