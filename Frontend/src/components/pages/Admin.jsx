import React, { useState, useEffect } from 'react';
import { 
  getPendingUsers, 
  approveUser, 
  getAllUsers, 
  deleteUser,
  addMemberToScope 
} from '../../api/adminApi';
import { getScopes } from '../../api/scopeApi';

const POSITIONS = [
  { label: '일반 사원 / 팀원', value: '팀원', level: 10 },
  { label: '팀장 / 파트장', value: '팀장', level: 50 },
  { label: '센터장 / 상임위원', value: '센터장', level: 80 },
  { label: '최고관리자 (원장/인사)', value: '원장', level: 100 },
];

export default function Admin({ me, currentSubPage }) {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [scopes, setScopes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // 가입 승인용 상태
  const [selections, setSelections] = useState({}); 
  const [approving, setApproving] = useState({});

  // 부서 추가용 상태
  const [showAddDept, setShowAddDept] = useState(null); // target user object
  const [selectedDeptId, setSelectedDeptId] = useState('');

  const myLevel = me?.roleLevel || 0;

  // 본인 권한보다 높은 직급은 부여할 수 없도록 필터링
  const availablePositions = POSITIONS.filter(p => p.level <= myLevel);

  // 대시보드 사이드바와 연동하기 위해 currentSubPage를 기준으로 탭 결정
  const activeTab = currentSubPage === 'admin-users' ? 'users' : 
                    currentSubPage === 'admin-org' ? 'org' : 'approval';

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'approval') {
        const res = await getPendingUsers();
        setPendingUsers(res.data?.data || []);
      } else if (activeTab === 'users') {
        const [userRes, scopeRes] = await Promise.all([getAllUsers(), getScopes()]);
        setAllUsers(userRes.data?.data || []);
        
        const flat = [];
        const flatten = (items) => {
          items.forEach(i => {
            flat.push({ id: i.id, name: i.name });
            if (i.children) flatten(i.children);
          });
        };
        const scopeData = scopeRes.data?.data;
        if (scopeData) {
          flatten(Array.isArray(scopeData) ? scopeData : [scopeData]);
        }
        setScopes(flat);
      }
    } catch (error) {
      console.error('데이터 로드 실패', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (userId) => {
    const selection = selections[userId];
    if (!selection) return alert('직급을 선택해주세요.');
    try {
      setApproving(prev => ({ ...prev, [userId]: true }));
      await approveUser(userId, selection.value, selection.level);
      setPendingUsers(prev => prev.filter(u => u.id !== userId));
      alert('승인이 완료되었습니다.');
    } catch (error) {
      alert('승인 실패: ' + (error.response?.data?.message || '오류가 발생했습니다.'));
    } finally {
      setApproving(prev => ({ ...prev, [userId]: false }));
    }
  };

  const handleAddDept = async () => {
    if (!selectedDeptId) return alert('부서를 선택해주세요.');
    try {
      await addMemberToScope(selectedDeptId, showAddDept.id);
      alert('부서가 추가되었습니다.');
      setShowAddDept(null);
      setSelectedDeptId('');
      loadData();
    } catch (error) {
      alert('부서 추가 실패: ' + (error.response?.data?.message || '권한이 없거나 이미 소속된 부서입니다.'));
    }
  };

  const handleUserDelete = async (targetUser) => {
    if (targetUser.roleLevel > myLevel) {
      alert('본인보다 높은 권한을 가진 사용자는 관리할 수 없습니다.');
      return;
    }
    if (me && targetUser.id === me.id) {
      alert('본인 계정은 관리자 페이지에서 삭제할 수 없습니다.');
      return;
    }

    if (!window.confirm(`정말 [${targetUser.name}] 사용자를 퇴사(익명화) 처리하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
    try {
      await deleteUser(targetUser.id);
      alert('탈퇴 처리되었습니다.');
      loadData();
    } catch (error) {
      alert('처리 실패: ' + (error.response?.data?.message || '오류가 발생했습니다.'));
    }
  };

  const getTitle = () => {
    if (activeTab === 'users') return '직원 정보 관리';
    if (activeTab === 'org') return '조직 구조 관리';
    return '가입 승인 관리';
  };

  return (
    <div className="admin-dashboard" style={{ padding: 24 }}>
      <div className="admin-header" style={{ marginBottom: 30 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#333', marginBottom: 8 }}>{getTitle()}</h1>
        <p style={{ color: '#888' }}>통합 관리자 센터에서 시스템의 사용자 및 조직을 관리합니다.</p>
      </div>

      <div className="admin-content">
        {isLoading ? (
          <div className="file-empty">데이터를 불러오는 중...</div>
        ) : (
          <>
            {activeTab === 'approval' && (
              <div className="tab-pane">
                {pendingUsers.length === 0 ? (
                  <div className="file-empty">승인 대기 중인 사용자가 없습니다.</div>
                ) : (
                  <table className="admin-table" style={tableStyle}>
                    <thead>
                      <tr style={theadRowStyle}>
                        <th style={thStyle}>사번</th>
                        <th style={thStyle}>이름</th>
                        <th style={thStyle}>신청 부서</th>
                        <th style={thStyle}>직급/권한 부여</th>
                        <th style={{ ...thStyle, textAlign: 'center' }}>작업</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingUsers.filter(u => u && u.id).map(user => (
                        <tr key={user.id} style={trStyle}>
                          <td style={tdStyle}>{user.empNo}</td>
                          <td style={tdStyle}>{user.name}</td>
                          <td style={tdStyle}>{user.dept}</td>
                          <td style={tdStyle}>
                            <select
                              onChange={e => {
                                const pos = POSITIONS.find(p => p.value === e.target.value);
                                setSelections(prev => ({ ...prev, [user.id]: pos }));
                              }}
                              style={selectStyle}
                            >
                              <option value="">직급 선택</option>
                              {availablePositions.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                            </select>
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            <button 
                              onClick={() => handleApprove(user.id)}
                              disabled={approving[user.id] || !selections[user.id]}
                              className="btn btn-primary"
                              style={{ margin: 0, padding: '6px 16px' }}
                            >승인</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {activeTab === 'users' && (
              <div className="tab-pane">
                <table className="admin-table" style={tableStyle}>
                  <thead>
                    <tr style={theadRowStyle}>
                      <th style={thStyle}>사번</th>
                      <th style={thStyle}>이름</th>
                      <th style={thStyle}>직급</th>
                      <th style={thStyle}>권한</th>
                      <th style={thStyle}>소속 부서 (다중)</th>
                      <th style={{ ...thStyle, textAlign: 'center' }}>작업</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allUsers.map(user => {
                      const isHigher = user.roleLevel > myLevel;
                      return (
                        <tr key={user.id} style={{ ...trStyle, opacity: isHigher ? 0.7 : 1 }}>
                          <td style={tdStyle}>{user.empNo}</td>
                          <td style={tdStyle}>{user.name}</td>
                          <td style={tdStyle}>{user.position || '-'}</td>
                          <td style={tdStyle}>
                            <span style={roleBadgeStyle(user.roleLevel)}>{user.role}</span>
                          </td>
                          <td style={tdStyle}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              {user.dept?.split(', ').map(d => (
                                <span key={d} style={deptBadgeStyle}>{d}</span>
                              ))}
                              {!isHigher && (
                                <button 
                                  onClick={() => setShowAddDept(user)}
                                  style={addBtnStyle}
                                >+</button>
                              )}
                            </div>
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            {!isHigher && me && user.id !== me.id && (
                              <button 
                                onClick={() => handleUserDelete(user)}
                                className="btn btn-danger"
                                style={{ margin: 0, padding: '4px 10px', fontSize: 12 }}
                              >강제퇴사</button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'org' && (
              <div className="file-empty">
                조직도 관리 및 부서 생성 기능 준비 중입니다.
              </div>
            )}
          </>
        )}
      </div>

      {showAddDept && (
        <div className="modal-overlay" onClick={() => setShowAddDept(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ minWidth: 320 }}>
            <h3>부서 추가 소속 설정</h3>
            <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
              <strong>[{showAddDept.name}]</strong> 직원을 새로운 부서에 추가로 배정합니다.
            </p>
            <select 
              value={selectedDeptId} 
              onChange={e => setSelectedDeptId(e.target.value)}
              style={{ ...selectStyle, width: '100%', marginBottom: 20 }}
            >
              <option value="">추가할 부서 선택</option>
              {scopes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowAddDept(null)}>취소</button>
              <button className="btn btn-primary" onClick={handleAddDept}>부서 추가</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const tableStyle = { width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: 8, overflow: 'hidden' };
const theadRowStyle = { background: '#f8f9fa', borderBottom: '2px solid #eee' };
const thStyle = { padding: '12px 16px', textAlign: 'left', fontSize: 14, color: '#555' };
const trStyle = { borderBottom: '1px solid #eee' };
const tdStyle = { padding: '12px 16px', fontSize: 14, color: '#333' };
const selectStyle = { padding: '6px 10px', borderRadius: 4, border: '1px solid #ddd', outline: 'none' };

const roleBadgeStyle = (level) => ({
  padding: '2px 8px',
  borderRadius: 12,
  fontSize: 11,
  fontWeight: 600,
  background: level >= 100 ? '#fff1f0' : level >= 50 ? '#e6f7ff' : '#f6ffed',
  color: level >= 100 ? '#cf1322' : level >= 50 ? '#096dd9' : '#389e0d',
  border: level >= 100 ? '1px solid #ffa39e' : level >= 50 ? '1px solid #91d5ff' : '1px solid #b7eb8f'
});

const deptBadgeStyle = {
  background: '#f0f0f0',
  padding: '2px 8px',
  borderRadius: 4,
  fontSize: 12,
  color: '#666'
};

const addBtnStyle = {
  width: 24,
  height: 24,
  borderRadius: '50%',
  border: '1px dashed #4A90D9',
  background: 'white',
  color: '#4A90D9',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 'bold'
};
