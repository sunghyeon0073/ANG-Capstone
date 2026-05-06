import { useState } from 'react'

export default function TestPage() {
  const [health, setHealth] = useState(null)
  const [members, setMembers] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleHealthTest = async () => {
    setLoading(true)
    setHealth(null)
    setError(null)
    try {
      const res = await fetch('/api/health')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setHealth(await res.json())
    } catch (e) {
      setError('서버 연결 실패: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleMembersTest = async () => {
    setLoading(true)
    setMembers(null)
    setError(null)
    try {
      const res = await fetch('/api/members')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setMembers(json.data)
    } catch (e) {
      setError('회원 조회 실패: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: '60px auto', fontFamily: 'sans-serif', padding: '0 20px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 900, marginBottom: 32 }}>백엔드 연동 테스트</h1>

      <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
        <button onClick={handleHealthTest} disabled={loading}
          style={{ padding: '10px 24px', fontSize: 14, fontWeight: 700, borderRadius: 10, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer' }}>
          서버 상태 확인
        </button>
        <button onClick={handleMembersTest} disabled={loading}
          style={{ padding: '10px 24px', fontSize: 14, fontWeight: 700, borderRadius: 10, border: 'none', background: '#7c3aed', color: '#fff', cursor: 'pointer' }}>
          회원 목록 조회
        </button>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '2px solid #ef4444', borderRadius: 10, padding: 16, marginBottom: 20, color: '#dc2626' }}>
          {error}
        </div>
      )}

      {health && (
        <div style={{ background: '#f0fdf4', border: '2px solid #22c55e', borderRadius: 10, padding: 16, marginBottom: 20 }}>
          <div style={{ fontWeight: 800, color: '#16a34a', marginBottom: 8 }}>서버 연결 성공</div>
          <div style={{ fontSize: 13, color: '#166534' }}>status: {health.status}</div>
          <div style={{ fontSize: 13, color: '#166534' }}>message: {health.message}</div>
          <div style={{ fontSize: 12, color: '#166534' }}>{health.timestamp}</div>
        </div>
      )}

      {members && (
        <div style={{ background: '#faf5ff', border: '2px solid #7c3aed', borderRadius: 10, padding: 16 }}>
          <div style={{ fontWeight: 800, color: '#7c3aed', marginBottom: 12 }}>회원 목록 ({members.length}명)</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#ede9fe' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left' }}>ID</th>
                <th style={{ padding: '8px 12px', textAlign: 'left' }}>이름</th>
                <th style={{ padding: '8px 12px', textAlign: 'left' }}>이메일</th>
                <th style={{ padding: '8px 12px', textAlign: 'left' }}>역할</th>
              </tr>
            </thead>
            <tbody>
              {members.map(m => (
                <tr key={m.id} style={{ borderTop: '1px solid #ddd6fe' }}>
                  <td style={{ padding: '8px 12px' }}>{m.id}</td>
                  <td style={{ padding: '8px 12px' }}>{m.name}</td>
                  <td style={{ padding: '8px 12px' }}>{m.email}</td>
                  <td style={{ padding: '8px 12px' }}>{m.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
