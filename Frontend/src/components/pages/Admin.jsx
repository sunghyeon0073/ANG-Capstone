import React, { useState, useEffect } from 'react';
import { 
  getPendingUsers, 
  approveUser, 
  rejectUser,
  getAllUsers, 
  deleteUser,
  addMemberToScope,
  removeMemberFromScope,
  updateMemberPosition,
  updateUserRole
} from '../../api/adminApi';
import { getScopes } from '../../api/scopeApi';

const ROLE_LEVELS = [
  { label: '일반 사용자 (Lv 1)', value: 1 },
  { label: '중간 관리자 (Lv 50)', value: 50 },
  { label: '최고 관리자 (Lv 100)', value: 100 },
];

export default function Admin({ me, currentSubPage }) {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [scopes, setScopes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // 가입 승인용 상태
  const [selections, setSelections] = useState({}); 
  const [positionSelections, setPositionSelections] = useState({});
  const [approving, setApproving] = useState({});

  // 거절용 상태
  const [rejectingUser, setRejectingUser] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // 부서 추가용 상태
  const [showAddDept, setShowAddDept] = useState(null); // target user object
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [addDeptPosition, setAddDeptPosition] = useState('사원');

  const [editingRole, setEditingRole] = useState(null);
  const [editingPosition, setEditingPosition] = useState(null);

  const POSITIONS = ['사원', '대리', '과장', '차장', '부장', '팀장', '센터장', '원장'];

  const myLevel = me?.roleLevel || 0;

  // 본인 권한보다 높은 레벨은 부여할 수 없도록 필터링
  const availableRoles = ROLE_LEVELS.filter(r => r.value <= myLevel);

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
    const roleLevel = selections[userId];
    if (roleLevel === undefined) return alert('권한 레벨을 선택해주세요.');
    try {
      setApproving(prev => ({ ...prev, [userId]: true }));
      await approveUser(userId, roleLevel, positionSelections[userId]);
      setPendingUsers(prev => prev.filter(u => u.id !== userId));
      alert('승인이 완료되었습니다.');
    } catch (error) {
      alert('승인 실패: ' + (error.response?.data?.message || '오류가 발생했습니다.'));
    } finally {
      setApproving(prev => ({ ...prev, [userId]: false }));
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) return alert('거절 사유를 입력해주세요.');
    try {
      await rejectUser(rejectingUser.id, rejectionReason);
      setPendingUsers(prev => prev.filter(u => u.id !== rejectingUser.id));
      alert('거절 처리가 완료되었습니다.');
      setRejectingUser(null);
      setRejectionReason('');
    } catch (error) {
      alert('거절 실패: ' + (error.response?.data?.message || '오류가 발생했습니다.'));
    }
  };

  const handleAddDept = async () => {
    if (!selectedDeptId) return alert('부서를 선택해주세요.');
    try {
      await addMemberToScope(selectedDeptId, showAddDept.id, addDeptPosition);
      alert('부서가 추가되었습니다.');
      setShowAddDept(null);
      setSelectedDeptId('');
      loadData();
    } catch (error) {
      alert('부서 추가 실패: ' + (error.response?.data?.message || '권한이 없거나 이미 소속된 부서입니다.'));
    }
  };

  const handleRemoveDept = async (scopeId, userId) => {
    if (!window.confirm('해당 부서 소속을 해제하시겠습니까?')) return;
    try {
      await removeMemberFromScope(scopeId, userId);
      alert('소속이 해제되었습니다.');
      loadData();
    } catch (error) {
      alert('해제 실패: ' + (error.response?.data?.message || '오류가 발생했습니다.'));
    }
  };

  const openUpdatePosition = (scopeId, userId, currentPosition) => {
    setEditingPosition({ scopeId, userId, position: currentPosition || '사원' });
  };

  const submitUpdatePosition = async () => {
    if (!editingPosition || !editingPosition.position) return alert('직급을 선택해주세요.');
    try {
      await updateMemberPosition(editingPosition.scopeId, editingPosition.userId, editingPosition.position);
      alert('직급이 변경되었습니다.');
      setEditingPosition(null);
      loadData();
    } catch (error) {
      alert('직급 변경 실패: ' + (error.response?.data?.message || '오류가 발생했습니다.'));
    }
  };

  const openUpdateRole = (userId, currentRoleLevel) => {
    setEditingRole({ userId, roleLevel: currentRoleLevel });
  };

  const submitUpdateRole = async () => {
    if (!editingRole || !editingRole.roleLevel) return alert('권한을 선택해주세요.');
    try {
      await updateUserRole(editingRole.userId, editingRole.roleLevel);
      alert('권한이 변경되었습니다.');
      setEditingRole(null);
      loadData();
    } catch (error) {
      alert('권한 변경 실패: ' + (error.response?.data?.message || '오류가 발생했습니다.'));
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
                        <th style={thStyle}>권한 및 직급 부여</th>
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
                            <div style={{ display: 'flex', gap: 6 }}>
                              <select
                                onChange={e => setSelections(prev => ({ ...prev, [user.id]: parseInt(e.target.value) }))}
                                style={selectStyle}
                              >
                                <option value="">레벨 선택</option>
                                {availableRoles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                              </select>
                              <select
                                onChange={e => setPositionSelections(prev => ({ ...prev, [user.id]: e.target.value }))}
                                style={selectStyle}
                                defaultValue=""
                              >
                                <option value="" disabled>직급 선택 (기본: 사원)</option>
                                {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                              </select>
                            </div>
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                              <button 
                                onClick={() => handleApprove(user.id)}
                                disabled={approving[user.id] || selections[user.id] === undefined}
                                className="btn btn-primary"
                                style={{ margin: 0, padding: '6px 16px' }}
                              >승인</button>
                              <button 
                                onClick={() => setRejectingUser(user)}
                                className="btn btn-secondary"
                                style={{ margin: 0, padding: '6px 16px', background: '#f5f5f5', color: '#666' }}
                              >거절</button>
                            </div>
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
                      <th style={thStyle}>권한</th>
                      <th style={thStyle}>소속 부서 및 직급</th>
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
                          <td style={tdStyle}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={roleBadgeStyle(user.roleLevel)}>{user.role}</span>
                              {!isHigher && (
                                <button 
                                  onClick={() => openUpdateRole(user.id, user.roleLevel)} 
                                  style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: '#007fa1', padding: '2px 6px', borderRadius: 4 }}
                                  onMouseOver={e => e.currentTarget.style.background = '#e6f7ff'}
                                  onMouseOut={e => e.currentTarget.style.background = 'none'}
                                >
                                  변경
                                </button>
                              )}
                            </div>
                          </td>
                          <td style={tdStyle}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {(user.departments || []).map(d => (
                                <div key={d.scopeId} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fafafa', padding: '6px 12px', borderRadius: 6, border: '1px solid #eaeaea' }}>
                                  <span style={{ fontSize: 13, fontWeight: 500, color: '#333' }}>{d.scopeName}</span>
                                  <span style={{ width: 1, height: 12, background: '#ddd' }}></span>
                                  <span style={{ fontSize: 13, color: '#007fa1', fontWeight: 600 }}>{d.position || '사원'}</span>
                                  {!isHigher && (
                                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                                      <button 
                                        onClick={() => openUpdatePosition(d.scopeId, user.id, d.position)} 
                                        style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: '#007fa1', padding: '2px 6px', borderRadius: 4 }}
                                        onMouseOver={e => e.currentTarget.style.background = '#e6f7ff'}
                                        onMouseOut={e => e.currentTarget.style.background = 'none'}
                                      >
                                        변경
                                      </button>
                                      <button 
                                        onClick={() => handleRemoveDept(d.scopeId, user.id)} 
                                        style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: '#ff4d4f', padding: '2px 6px', borderRadius: 4 }}
                                        onMouseOver={e => e.currentTarget.style.background = '#fff1f0'}
                                        onMouseOut={e => e.currentTarget.style.background = 'none'}
                                      >
                                        해제
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ))}
                              {!isHigher && (
                                <button 
                                  onClick={() => setShowAddDept(user)} 
                                  style={{ alignSelf: 'flex-start', border: '1px dashed #007fa1', background: '#f0f9ff', color: '#007fa1', cursor: 'pointer', fontSize: 12, padding: '4px 10px', borderRadius: 4, marginTop: 2, fontWeight: 500 }}
                                  onMouseOver={e => e.currentTarget.style.background = '#e6f7ff'}
                                  onMouseOut={e => e.currentTarget.style.background = '#f0f9ff'}
                                >
                                  + 부서 추가
                                </button>
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

      {rejectingUser && (
        <div className="modal-overlay" onClick={() => setRejectingUser(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ minWidth: 400 }}>
            <h3>가입 승인 거절</h3>
            <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
              <strong>[{rejectingUser.name}]</strong> 사용자의 가입 요청을 거절하시겠습니까?<br/>
              거절 사유를 입력해주세요. 이 사유는 사용자에게 노출됩니다.
            </p>
            <textarea
              placeholder="거절 사유를 입력하세요..."
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              style={{ width: '100%', height: 100, padding: 12, borderRadius: 4, border: '1px solid #ddd', marginBottom: 20 }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setRejectingUser(null)}>취소</button>
              <button className="btn btn-danger" onClick={handleReject}>거절 확정</button>
            </div>
          </div>
        </div>
      )}

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
              style={{ ...selectStyle, width: '100%', marginBottom: 12 }}
            >
              <option value="">추가할 부서 선택</option>
              {scopes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select 
              value={addDeptPosition} 
              onChange={e => setAddDeptPosition(e.target.value)}
              style={{ ...selectStyle, width: '100%', marginBottom: 20 }}
            >
              <option value="">직급 선택</option>
              {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowAddDept(null)}>취소</button>
              <button className="btn btn-primary" onClick={handleAddDept}>부서 추가</button>
            </div>
          </div>
        </div>
      )}

      {editingPosition && (
        <div className="modal-overlay" onClick={() => setEditingPosition(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ minWidth: 320 }}>
            <h3>직급 변경</h3>
            <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
              사용자의 직급을 변경합니다.
            </p>
            <select 
              value={editingPosition.position} 
              onChange={e => setEditingPosition({...editingPosition, position: e.target.value})}
              style={{ ...selectStyle, width: '100%', marginBottom: 20 }}
            >
              <option value="">직급 선택</option>
              {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setEditingPosition(null)}>취소</button>
              <button className="btn btn-primary" onClick={submitUpdatePosition}>저장</button>
            </div>
          </div>
        </div>
      )}

      {editingRole && (
        <div className="modal-overlay" onClick={() => setEditingRole(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ minWidth: 320 }}>
            <h3>권한 변경</h3>
            <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
              사용자의 시스템 권한을 변경합니다.
            </p>
            <select 
              value={editingRole.roleLevel} 
              onChange={e => setEditingRole({...editingRole, roleLevel: parseInt(e.target.value)})}
              style={{ ...selectStyle, width: '100%', marginBottom: 20 }}
            >
              <option value="">권한 선택</option>
              {availableRoles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setEditingRole(null)}>취소</button>
              <button className="btn btn-primary" onClick={submitUpdateRole}>저장</button>
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
