import React, { useState, useEffect, useRef } from 'react';
import { FiShield, FiUsers, FiGitBranch, FiCheckCircle, FiAlertCircle, FiX, FiSearch } from 'react-icons/fi';
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
import { ROLE_LEVELS, POSITIONS, roleBadgeStyle } from '../../constants/roles';

const ADMIN_NAV = [
  { id: 'admin-approval', label: '가입 승인 관리', icon: FiShield },
  { id: 'admin-users',    label: '직원 정보 관리', icon: FiUsers },
  { id: 'admin-org',      label: '조직 구조 관리', icon: FiGitBranch },
];

/* ── 인라인 알림 배너 (채팅 토스트와 분리된 Admin 전용 피드백) ── */
function InlineNotification({ notification, onClose }) {
  if (!notification) return null;
  const isSuccess = notification.type === 'success';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 16px', borderRadius: 8, marginBottom: 16,
      background: isSuccess ? '#f6ffed' : '#fff2f0',
      border: `1px solid ${isSuccess ? '#b7eb8f' : '#ffccc7'}`,
      color: isSuccess ? '#389e0d' : '#cf1322',
      fontSize: 14, flexShrink: 0,
    }}>
      {isSuccess
        ? <FiCheckCircle size={16} style={{ flexShrink: 0 }} />
        : <FiAlertCircle size={16} style={{ flexShrink: 0 }} />}
      <span style={{ flex: 1 }}>{notification.message}</span>
      <button
        onClick={onClose}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'flex' }}
      >
        <FiX size={14} />
      </button>
    </div>
  );
}

/* ── 공통 확인 모달 (window.confirm 대체) ── */
function ConfirmModal({ state, onClose }) {
  if (!state) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ minWidth: 360 }}>
        {state.title && <h3 style={{ marginBottom: 12 }}>{state.title}</h3>}
        <p style={{ fontSize: 14, color: '#555', marginBottom: 24, lineHeight: 1.6 }}>
          {state.message}
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>취소</button>
          <button
            className={state.dangerous ? 'btn btn-danger' : 'btn btn-primary'}
            onClick={() => { state.onConfirm(); onClose(); }}
          >{state.confirmLabel || '확인'}</button>
        </div>
      </div>
    </div>
  );
}

export default function Admin({ me, currentSubPage, onSubPageChange }) {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [scopes, setScopes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // 알림 배너
  const [notification, setNotification] = useState(null);
  const notifTimerRef = useRef(null);

  // 확인 모달
  const [confirmModal, setConfirmModal] = useState(null);

  // 승인 모달 (역할/직급 선택 포함)
  const [approveModal, setApproveModal] = useState(null);
  const [approveRoleLevel, setApproveRoleLevel] = useState(1);
  const [approvePosition, setApprovePosition] = useState('사원');
  const [approving, setApproving] = useState({});

  // 거절 모달
  const [rejectingUser, setRejectingUser] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // 부서 추가 모달
  const [showAddDept, setShowAddDept] = useState(null);
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [addDeptPosition, setAddDeptPosition] = useState('사원');

  const [editingRole, setEditingRole] = useState(null);
  const [editingPosition, setEditingPosition] = useState(null);

  // 직원 검색
  const [userSearch, setUserSearch] = useState('');

  // 탭별 데이터 캐시
  const loadedTabsRef = useRef(new Set());

  const myLevel = me?.roleLevel || 0;
  const isSuperAdmin = myLevel >= 100;
  const availableRoles = ROLE_LEVELS.filter(r => r.value < 100);

  const activeTab = currentSubPage === 'admin-users' ? 'users'
                  : currentSubPage === 'admin-org'   ? 'org'
                  : 'approval';

  useEffect(() => () => { if (notifTimerRef.current) clearTimeout(notifTimerRef.current); }, []);

  useEffect(() => { loadData(); }, [activeTab]);

  // 탭 바뀔 때 검색 초기화
  useEffect(() => { setUserSearch(''); }, [activeTab]);

  const notify = (type, message) => {
    if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
    setNotification({ type, message });
    notifTimerRef.current = setTimeout(() => setNotification(null), 3500);
  };

  const showConfirm = (config) => setConfirmModal(config);

  const loadData = async (forceReload = false) => {
    if (!forceReload && loadedTabsRef.current.has(activeTab)) return;
    setIsLoading(true);
    try {
      if (activeTab === 'approval') {
        const res = await getPendingUsers();
        setPendingUsers(res.data?.data || []);
      } else if (activeTab === 'users') {
        const [userRes, scopeRes] = await Promise.all([getAllUsers(), getScopes()]);
        setAllUsers(userRes.data?.data || []);

        const scopeData = scopeRes.data?.data || [];
        const buildTree = (list) => {
          const map = {};
          const roots = [];
          list.forEach(item => { map[item.id] = { ...item, children: [] }; });
          list.forEach(item => {
            if (item.parentId && map[item.parentId]) map[item.parentId].children.push(map[item.id]);
            else roots.push(map[item.id]);
          });
          return roots;
        };
        const tree = buildTree(scopeData);
        const secondLevelNodes = [];
        tree.forEach(root => { if (root.children?.length > 0) secondLevelNodes.push(...root.children); });

        const flatResult = [];
        const flattenWithIndent = (nodes, depth = 0) => {
          nodes.forEach(node => {
            flatResult.push({ id: node.id, name: (depth > 0 ? '　'.repeat(depth) + '└ ' : '') + node.name });
            if (node.children?.length > 0) flattenWithIndent(node.children, depth + 1);
          });
        };
        flattenWithIndent(secondLevelNodes);
        setScopes(flatResult);
      }
      loadedTabsRef.current.add(activeTab);
    } catch (error) {
      console.error('데이터 로드 실패', error);
      notify('error', '데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const reloadCurrentTab = () => {
    loadedTabsRef.current.delete(activeTab);
    loadData(true);
  };

  /* ── 가입 승인 ── */
  const openApproveModal = (user) => {
    setApproveRoleLevel(1);
    setApprovePosition('사원');
    setApproveModal(user);
  };

  const handleApprove = async () => {
    const user = approveModal;
    try {
      setApproving(prev => ({ ...prev, [user.id]: true }));
      await approveUser(user.id, approveRoleLevel, approvePosition);
      setPendingUsers(prev => prev.filter(u => u.id !== user.id));
      setApproveModal(null);
      notify('success', `[${user.name}] 승인이 완료되었습니다.`);
    } catch (error) {
      notify('error', '승인 실패: ' + (error.response?.data?.message || '오류가 발생했습니다.'));
    } finally {
      setApproving(prev => ({ ...prev, [user.id]: false }));
    }
  };

  /* ── 가입 거절 ── */
  const handleReject = async () => {
    if (!rejectionReason.trim()) { notify('error', '거절 사유를 입력해주세요.'); return; }
    try {
      await rejectUser(rejectingUser.id, rejectionReason);
      setPendingUsers(prev => prev.filter(u => u.id !== rejectingUser.id));
      notify('success', '거절 처리가 완료되었습니다.');
      setRejectingUser(null);
      setRejectionReason('');
    } catch (error) {
      notify('error', '거절 실패: ' + (error.response?.data?.message || '오류가 발생했습니다.'));
    }
  };

  /* ── 부서 추가 ── */
  const handleAddDept = async () => {
    if (!selectedDeptId) { notify('error', '부서를 선택해주세요.'); return; }
    try {
      await addMemberToScope(selectedDeptId, showAddDept.id, addDeptPosition);
      notify('success', '부서가 추가되었습니다.');
      setShowAddDept(null);
      setSelectedDeptId('');
      reloadCurrentTab();
    } catch (error) {
      notify('error', '부서 추가 실패: ' + (error.response?.data?.message || '권한이 없거나 이미 소속된 부서입니다.'));
    }
  };

  /* ── 부서 소속 해제 ── */
  const handleRemoveDept = (scopeId, userId) => {
    showConfirm({
      title: '부서 소속 해제',
      message: '해당 부서 소속을 해제하시겠습니까?',
      confirmLabel: '해제',
      dangerous: true,
      onConfirm: async () => {
        try {
          await removeMemberFromScope(scopeId, userId);
          notify('success', '소속이 해제되었습니다.');
          reloadCurrentTab();
        } catch (error) {
          notify('error', '해제 실패: ' + (error.response?.data?.message || '오류가 발생했습니다.'));
        }
      }
    });
  };

  /* ── 직급 변경 ── */
  const openUpdatePosition = (scopeId, userId, currentPosition) => {
    setEditingPosition({ scopeId, userId, position: currentPosition || '사원' });
  };

  const submitUpdatePosition = async () => {
    if (!editingPosition?.position) { notify('error', '직급을 선택해주세요.'); return; }
    try {
      await updateMemberPosition(editingPosition.scopeId, editingPosition.userId, editingPosition.position);
      notify('success', '직급이 변경되었습니다.');
      setEditingPosition(null);
      reloadCurrentTab();
    } catch (error) {
      notify('error', '직급 변경 실패: ' + (error.response?.data?.message || '오류가 발생했습니다.'));
    }
  };

  /* ── 권한 변경 ── */
  const openUpdateRole = (userId, currentRoleLevel) => {
    setEditingRole({ userId, roleLevel: '', currentRoleLevel });
  };

  const submitUpdateRole = async () => {
    if (!editingRole || editingRole.roleLevel === '' || editingRole.roleLevel === undefined) {
      notify('error', '권한을 선택해주세요.');
      return;
    }
    try {
      await updateUserRole(editingRole.userId, editingRole.roleLevel);
      notify('success', '권한이 변경되었습니다.');
      setEditingRole(null);
      reloadCurrentTab();
    } catch (error) {
      notify('error', '권한 변경 실패: ' + (error.response?.data?.message || '오류가 발생했습니다.'));
    }
  };

  /* ── 퇴사 처리 ── */
  const handleUserDelete = (targetUser) => {
    if (targetUser.roleLevel > myLevel) {
      notify('error', '본인보다 높은 권한을 가진 사용자는 관리할 수 없습니다.');
      return;
    }
    if (me && targetUser.id === me.id) {
      notify('error', '본인 계정은 관리자 페이지에서 삭제할 수 없습니다.');
      return;
    }
    showConfirm({
      title: '퇴사 처리',
      message: (
        <>
          정말 <strong>[{targetUser.name}]</strong> 사용자를 퇴사(익명화) 처리하시겠습니까?<br />
          사번이 유지되어 보안을 위해 해당 사번으로는 재가입이 불가능해집니다.
        </>
      ),
      confirmLabel: '퇴사 처리',
      dangerous: true,
      onConfirm: async () => {
        try {
          await deleteUser(targetUser.id);
          notify('success', '퇴사 처리되었습니다.');
          reloadCurrentTab();
        } catch (error) {
          notify('error', '처리 실패: ' + (error.response?.data?.message || '오류가 발생했습니다.'));
        }
      }
    });
  };

  const getTitle = () => {
    if (activeTab === 'users') return '직원 정보 관리';
    if (activeTab === 'org') return '조직 구조 관리';
    return '가입 승인 관리';
  };

  const filteredUsers = userSearch.trim()
    ? allUsers.filter(u => {
        const q = userSearch.toLowerCase();
        return u.name?.toLowerCase().includes(q) || String(u.empNo || '').includes(q);
      })
    : allUsers;

  return (
    <div className="org-workspace">
      {/* ── 자체 사이드바 ── */}
      <aside className="org-rail">
        <div className="org-rail-header">
          <span className="org-rail-title">관리자</span>
        </div>
        <nav className="org-nav">
          {ADMIN_NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`org-nav-item ${currentSubPage === id ? 'active' : ''}`}
              onClick={() => onSubPageChange?.(id)}
            >
              <Icon size={15} />
              <span className="org-nav-label">{label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* ── 메인 콘텐츠 ── */}
      <div className="org-page">
        <InlineNotification notification={notification} onClose={() => setNotification(null)} />

        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1a', marginBottom: 4 }}>{getTitle()}</h1>
          <p style={{ color: '#888', fontSize: 13 }}>통합 관리자 센터에서 시스템의 사용자 및 조직을 관리합니다.</p>
        </div>

        {isLoading ? (
          <div className="file-empty">데이터를 불러오는 중...</div>
        ) : (
          <>
            {/* ── 가입 승인 탭 ── */}
            {activeTab === 'approval' && (
              <div>
                {pendingUsers.length === 0 ? (
                  <div className="file-empty">승인 대기 중인 사용자가 없습니다.</div>
                ) : (
                  <table className="admin-table" style={tableStyle}>
                    <thead>
                      <tr style={theadRowStyle}>
                        <th style={thStyle}>사번</th>
                        <th style={thStyle}>이름</th>
                        <th style={thStyle}>신청 부서</th>
                        <th style={{ ...thStyle, textAlign: 'center' }}>작업</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingUsers.filter(u => u?.id).map(user => (
                        <tr key={user.id} style={trStyle}>
                          <td style={tdStyle}>{user.empNo}</td>
                          <td style={tdStyle}>{user.name}</td>
                          <td style={tdStyle}>{user.dept}</td>
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                              <button
                                onClick={() => openApproveModal(user)}
                                disabled={approving[user.id]}
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

            {/* ── 직원 정보 관리 탭 ── */}
            {activeTab === 'users' && (
              <div>
                {/* 검색 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: '7px 12px', width: 260 }}>
                  <FiSearch size={15} color="#aaa" />
                  <input
                    type="text"
                    placeholder="이름 또는 사번으로 검색"
                    value={userSearch}
                    onChange={e => setUserSearch(e.target.value)}
                    style={{ border: 'none', outline: 'none', fontSize: 13, width: '100%', background: 'transparent', color: '#333' }}
                  />
                  {userSearch && (
                    <button onClick={() => setUserSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: '#aaa' }}>
                      <FiX size={13} />
                    </button>
                  )}
                </div>

                {filteredUsers.length === 0 ? (
                  <div className="file-empty">{userSearch ? '검색 결과가 없습니다.' : '등록된 직원이 없습니다.'}</div>
                ) : (
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
                      {filteredUsers.map(user => {
                        const isHigher = user.roleLevel > myLevel;
                        return (
                          <tr key={user.id} style={{ ...trStyle, opacity: isHigher ? 0.7 : 1 }}>
                            <td style={tdStyle}>{user.empNo}</td>
                            <td style={tdStyle}>{user.name}</td>
                            <td style={tdStyle}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={roleBadgeStyle(user.roleLevel)}>{user.role}</span>
                                {isSuperAdmin && !isHigher && (
                                  <button
                                    onClick={() => openUpdateRole(user.id, user.roleLevel)}
                                    style={ghostBtnStyle('#096dd9')}
                                    onMouseOver={e => e.currentTarget.style.background = '#e6f7ff'}
                                    onMouseOut={e => e.currentTarget.style.background = 'none'}
                                  >변경</button>
                                )}
                              </div>
                            </td>
                            <td style={tdStyle}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {(user.departments || []).map(d => (
                                  <div key={d.scopeId} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fafafa', padding: '6px 12px', borderRadius: 6, border: '1px solid #eaeaea' }}>
                                    <span style={{ fontSize: 13, fontWeight: 500, color: '#333' }}>{d.scopeName}</span>
                                    <span style={{ width: 1, height: 12, background: '#ddd' }} />
                                    <span style={{ fontSize: 13, color: 'var(--color-primary)', fontWeight: 600 }}>{d.position || '사원'}</span>
                                    {!isHigher && (
                                      <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                                        <button
                                          onClick={() => openUpdatePosition(d.scopeId, user.id, d.position)}
                                          style={ghostBtnStyle('#096dd9')}
                                          onMouseOver={e => e.currentTarget.style.background = '#e6f7ff'}
                                          onMouseOut={e => e.currentTarget.style.background = 'none'}
                                        >변경</button>
                                        <button
                                          onClick={() => handleRemoveDept(d.scopeId, user.id)}
                                          style={ghostBtnStyle('#ff4d4f')}
                                          onMouseOver={e => e.currentTarget.style.background = '#fff1f0'}
                                          onMouseOut={e => e.currentTarget.style.background = 'none'}
                                        >해제</button>
                                      </div>
                                    )}
                                  </div>
                                ))}
                                {!isHigher && (
                                  <button
                                    onClick={() => setShowAddDept(user)}
                                    style={{ alignSelf: 'flex-start', border: '1px dashed var(--color-primary)', background: '#f0f9ff', color: 'var(--color-primary)', cursor: 'pointer', fontSize: 12, padding: '4px 10px', borderRadius: 4, marginTop: 2, fontWeight: 500 }}
                                    onMouseOver={e => e.currentTarget.style.background = '#e6f7ff'}
                                    onMouseOut={e => e.currentTarget.style.background = '#f0f9ff'}
                                  >+ 부서 추가</button>
                                )}
                              </div>
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'center' }}>
                              {!isHigher && me && user.id !== me.id && (
                                <button
                                  onClick={() => handleUserDelete(user)}
                                  className="btn btn-danger"
                                  style={{ margin: 0, padding: '4px 10px', fontSize: 12 }}
                                >퇴사</button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {activeTab === 'org' && (
              <div className="file-empty">조직도 관리 및 부서 생성 기능 준비 중입니다.</div>
            )}
          </>
        )}
      </div>

      {/* ── 공통 확인 모달 ── */}
      <ConfirmModal state={confirmModal} onClose={() => setConfirmModal(null)} />

      {/* ── 승인 모달 (역할/직급 선택) ── */}
      {approveModal && (
        <div className="modal-overlay" onClick={() => setApproveModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ minWidth: 380 }}>
            <h3 style={{ marginBottom: 8 }}>가입 승인</h3>
            <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
              <strong>[{approveModal.name}]</strong> ({approveModal.empNo}) 사용자의 가입을 승인합니다.
              초기 권한 및 직급을 설정하세요.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              <div>
                <label style={labelStyle}>권한</label>
                <select
                  value={approveRoleLevel}
                  onChange={e => setApproveRoleLevel(parseInt(e.target.value))}
                  style={{ ...selectStyle, width: '100%' }}
                >
                  {availableRoles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>직급</label>
                <select
                  value={approvePosition}
                  onChange={e => setApprovePosition(e.target.value)}
                  style={{ ...selectStyle, width: '100%' }}
                >
                  {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setApproveModal(null)}>취소</button>
              <button
                className="btn btn-primary"
                onClick={handleApprove}
                disabled={approving[approveModal.id]}
              >승인 확정</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 거절 모달 ── */}
      {rejectingUser && (
        <div className="modal-overlay" onClick={() => setRejectingUser(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ minWidth: 400 }}>
            <h3>가입 승인 거절</h3>
            <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
              <strong>[{rejectingUser.name}]</strong> 사용자의 가입 요청을 거절하시겠습니까?<br />
              거절 시 해당 가입 정보는 삭제되며, 사용자는 동일한 사번으로 다시 가입할 수 있게 됩니다.
            </p>
            <textarea
              placeholder="거절 사유를 입력하세요..."
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              style={{ width: '100%', height: 100, padding: 12, borderRadius: 4, border: '1px solid #ddd', marginBottom: 20, resize: 'vertical', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setRejectingUser(null)}>취소</button>
              <button className="btn btn-danger" onClick={handleReject}>거절 확정</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 부서 추가 모달 ── */}
      {showAddDept && (
        <div className="modal-overlay" onClick={() => setShowAddDept(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ minWidth: 320 }}>
            <h3>부서 추가 소속 설정</h3>
            <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
              <strong>[{showAddDept.name}]</strong> 직원을 새로운 부서에 추가로 배정합니다.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              <div>
                <label style={labelStyle}>부서 선택</label>
                <select
                  value={selectedDeptId}
                  onChange={e => setSelectedDeptId(e.target.value)}
                  style={{ ...selectStyle, width: '100%' }}
                >
                  <option value="">추가할 부서 선택</option>
                  {scopes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>직급</label>
                <select
                  value={addDeptPosition}
                  onChange={e => setAddDeptPosition(e.target.value)}
                  style={{ ...selectStyle, width: '100%' }}
                >
                  <option value="">직급 선택</option>
                  {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowAddDept(null)}>취소</button>
              <button className="btn btn-primary" onClick={handleAddDept}>부서 추가</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 직급 변경 모달 ── */}
      {editingPosition && (
        <div className="modal-overlay" onClick={() => setEditingPosition(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ minWidth: 320 }}>
            <h3>직급 변경</h3>
            <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>사용자의 직급을 변경합니다.</p>
            <label style={labelStyle}>직급 선택</label>
            <select
              value={editingPosition.position}
              onChange={e => setEditingPosition({ ...editingPosition, position: e.target.value })}
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

      {/* ── 권한 변경 모달 ── */}
      {editingRole && (
        <div className="modal-overlay" onClick={() => setEditingRole(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ minWidth: 320 }}>
            <h3>권한 변경</h3>
            <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>사용자의 시스템 권한을 변경합니다.</p>
            <label style={labelStyle}>권한 선택</label>
            <select
              value={editingRole.roleLevel}
              onChange={e => setEditingRole({ ...editingRole, roleLevel: parseInt(e.target.value) })}
              style={{ ...selectStyle, width: '100%', marginBottom: 20 }}
            >
              <option value="">권한 선택</option>
              {availableRoles
                .filter(r => r.value !== editingRole.currentRoleLevel)
                .map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
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
const selectStyle = { padding: '6px 10px', borderRadius: 4, border: '1px solid #ddd', outline: 'none', fontSize: 13 };
const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 6 };
const ghostBtnStyle = (color) => ({
  border: 'none', background: 'none', cursor: 'pointer',
  fontSize: 12, color, padding: '2px 6px', borderRadius: 4
});

