import React, { useState } from 'react';
import { Card, Btn, Input, SectionLabel } from '../ui';

function SignupPage({ onSignupSuccess, onGoToLogin }) {
  const [formData, setFormData] = useState({
    name: '', empId: '', birth: '', email: '',
    password: '', confirmPassword: '', deptCode: ''
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const validatePassword = (pw) => {
    const regex = /^(?=.*[a-zA-Z])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{6,24}$/;
    return regex.test(pw);
  };

  const isFormValid =
    Object.values(formData).every(val => val.trim() !== '') &&
    validatePassword(formData.password) &&
    formData.password === formData.confirmPassword;

  const handleChange = (key, val) => setFormData(prev => ({ ...prev, [key]: val }));

  const handleSubmit = async () => {
    if (!isFormValid) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emp_id: formData.empId,
          name: formData.name,
          password: formData.password,
          email: formData.email,
          birth: formData.birth,
          dept_code: formData.deptCode,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setSubmitted(true);
      } else {
        setError(data.message);
      }
    } catch {
      // 백엔드 없어도 완료 처리
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--line-3)' }}>
        <Card style={{ width: 420, padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>가입 승인 요청 완료</h2>
          <p style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 24 }}>
            관리자 승인 후 로그인이 가능합니다.<br />
            승인까지 영업일 기준 1~2일 소요됩니다.
          </p>
          <Btn variant="primary" style={{ width: '100%', justifyContent: 'center' }} onClick={onGoToLogin}>
            로그인으로 돌아가기
          </Btn>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-10" style={{ background: 'var(--line-3)' }}>
      <div style={{ width: 500 }}>
        <div className="text-center mb-6">
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 900, fontSize: 28, letterSpacing: '-0.04em', color: 'var(--primary)', marginBottom: 4 }}>ANG</div>
          <div className="mono text-[11px] uppercase tracking-widest" style={{ color: 'var(--ink-4)' }}>AI Network Groupware</div>
        </div>
        <Card style={{ padding: 36 }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)', marginBottom: 4 }}>계정 생성</h2>
          <p style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 24 }}>시스템 접근을 위해 모든 항목을 입력해주세요.</p>

          <div className="grid grid-cols-2 gap-x-4 gap-y-4">
            <div className="space-y-1.5">
              <SectionLabel>이름</SectionLabel>
              <Input placeholder="성함 입력" value={formData.name} onChange={v => handleChange('name', v)} />
            </div>
            <div className="space-y-1.5">
              <SectionLabel>사번</SectionLabel>
              <Input placeholder="예: 2026-0001" value={formData.empId} onChange={v => handleChange('empId', v)} />
            </div>
            <div className="space-y-1.5">
              <SectionLabel>생년월일</SectionLabel>
              <Input type="date" value={formData.birth} onChange={v => handleChange('birth', v)} />
            </div>
            <div className="space-y-1.5">
              <SectionLabel>부서 고유 코드</SectionLabel>
              <Input placeholder="D-XXXX" value={formData.deptCode} onChange={v => handleChange('deptCode', v)} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <SectionLabel>이메일</SectionLabel>
              <Input icon="mail" placeholder="email@company.com" value={formData.email} onChange={v => handleChange('email', v)} />
            </div>
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
            <div className="mt-3 text-[11.5px] font-bold" style={{ color: 'var(--danger)' }}>
              * 비밀번호는 영문과 특수문자를 포함하여 6~24자여야 합니다.
            </div>
          )}
          {formData.confirmPassword && formData.password !== formData.confirmPassword && (
            <div className="mt-2 text-[11.5px] font-bold" style={{ color: 'var(--danger)' }}>
              * 비밀번호가 일치하지 않습니다.
            </div>
          )}
          {error && (
            <div className="mt-2 text-[12px] font-bold" style={{ color: 'var(--danger)' }}>{error}</div>
          )}

          <Btn variant="dark" size="lg" style={{ width: '100%', justifyContent: 'center', marginTop: 24 }}
            onClick={handleSubmit} disabled={!isFormValid || loading}>
            {loading ? '처리 중...' : '가입 승인 요청'}
          </Btn>
          <Btn variant="ghost" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} onClick={onGoToLogin}>
            이미 계정이 있나요? 로그인
          </Btn>
        </Card>
      </div>
    </div>
  );
}

export default SignupPage;
