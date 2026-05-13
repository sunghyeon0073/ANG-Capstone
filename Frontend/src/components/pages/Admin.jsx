import React, { useState, useEffect } from 'react';
import { getPendingUsers, approveUser } from '../../api/adminApi';

const ROLE_OPTIONS = [
  { value: 0,  label: '일반' },
  { value: 50, label: '관리자' },
];

export default function Admin() {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [formState, setFormState] = useState({});
  const [approving, setApproving] = useState({});

  const fetchPending = async () => {
    try {
      setIsLoading(true);
      const res = await getPendingUsers();
      setPendingUsers(res.data?.data || []);
    } catch (error) {
      console.error('승인 대기자 로드 실패', error);
      setPendingUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchPending(); }, []);

  const setField = (userId, field, value) =>
    setFormState(prev => ({ ...prev, [userId]: { ...prev[userId], [field]: value } }));

  const handleApprove = async (userId) => {
    const roleLevel = formState[userId]?.roleLevel ?? 0;
    try {
      setApproving(prev => ({ ...prev, [userId]: true }));
      await approveUser(userId, roleLevel);
      setPendingUsers(prev => prev.filter(u => u.id !== userId));
      alert('승인되었습니다.');
    } catch (error) {
      alert('승인 실패: ' + (error.response?.data?.message || '오류가 발생했습니다.'));
    } finally {
      setApproving(prev => ({ ...prev, [userId]: false }));
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginBottom: 8 }}>가입 승인 관리</h2>
      <p style={{ color: '#888', marginBottom: 24 }}>승인 대기 중인 사용자의 권한을 선택하고 승인하세요.</p>

      {isLoading ? (
        <div className="file-empty">불러오는 중...</div>
      ) : pendingUsers.length === 0 ? (
        <div className="file-empty">승인 대기 중인 사용자가 없습니다.</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f5f7fa', borderBottom: '2px solid #eee' }}>
              <th style={{ padding: '10px 12px', textAlign: 'left' }}>사번</th>
              <th style={{ padding: '10px 12px', textAlign: 'left' }}>이름</th>
              <th style={{ padding: '10px 12px', textAlign: 'left' }}>이메일</th>
              <th style={{ padding: '10px 12px', textAlign: 'left' }}>부서</th>
              <th style={{ padding: '10px 12px', textAlign: 'left' }}>권한</th>
              <th style={{ padding: '10px 12px', textAlign: 'center' }}>승인</th>
            </tr>
          </thead>
          <tbody>
            {pendingUsers.map(user => (
              <tr key={user.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '10px 12px' }}>{user.empNo}</td>
                <td style={{ padding: '10px 12px' }}>{user.name}</td>
                <td style={{ padding: '10px 12px', color: '#888' }}>{user.email}</td>
                <td style={{ padding: '10px 12px' }}>{user.dept}</td>
                <td style={{ padding: '10px 12px' }}>
                  <select
                    value={formState[user.id]?.roleLevel ?? 0}
                    onChange={e => setField(user.id, 'roleLevel', Number(e.target.value))}
                    style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #ddd' }}
                  >
                    {ROLE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                  <button
                    onClick={() => handleApprove(user.id)}
                    disabled={approving[user.id]}
                    className="btn btn-primary"
                    style={{ padding: '4px 16px', fontSize: 13 }}
                  >
                    {approving[user.id] ? '처리 중...' : '승인'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
