import React, { useState, useEffect } from 'react';
import { getScopes, getScopeMembers } from '../../api/scopeApi';

const SimpleModal = ({ open, onClose, children }) => {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content org-modal" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
};

const COLORS = ['#4A90D9', '#7B68EE', '#50C878', '#FF6B6B', '#FFD700', '#FF8C00', '#20B2AA'];
const getColor = (id) => COLORS[id % COLORS.length];
const getInitials = (name) => name?.charAt(0) || '?';

export default function Organization({ currentSubPage = 'org-all' }) {
  const [scopes, setScopes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [membersCache, setMembersCache] = useState({});
  const [activeTab, setActiveTab] = useState(null);
  const [loadingMembers, setLoadingMembers] = useState(false);

  useEffect(() => {
    const fetchScopes = async () => {
      try {
        setIsLoading(true);
        const res = await getScopes();
        const data = res.data?.data || [];
        setScopes(Array.isArray(data) ? data : [data]);
      } catch (error) {
        console.error('조직도 로드 실패', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchScopes();
  }, []);

  const fetchMembers = async (scopeId) => {
    if (membersCache[scopeId]) return;
    try {
      setLoadingMembers(true);
      const res = await getScopeMembers(scopeId);
      setMembersCache(prev => ({ ...prev, [scopeId]: res.data?.data || [] }));
    } catch (error) {
      console.error('멤버 로드 실패', error);
      setMembersCache(prev => ({ ...prev, [scopeId]: [] }));
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleTabChange = (scope) => {
    setActiveTab(scope);
    fetchMembers(scope.id);
  };

  // 트리 렌더링 재귀 컴포넌트
  const ScopeNode = ({ scope, depth = 0 }) => {
    const [expanded, setExpanded] = useState(depth < 2);
    const hasChildren = scope.children?.length > 0;

    return (
      <div style={{ marginLeft: depth * 24, marginTop: 8 }}>
        <div
          className="org-scope-node"
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
            background: depth === 0 ? '#4A90D9' : depth === 1 ? '#7B68EE' : '#f0f4ff',
            color: depth < 2 ? '#fff' : '#333',
            borderRadius: 8, cursor: hasChildren ? 'pointer' : 'default',
            fontWeight: depth === 0 ? 700 : depth === 1 ? 600 : 400,
            fontSize: depth === 0 ? 15 : 14
          }}
          onClick={() => hasChildren && setExpanded(v => !v)}
        >
          <span>{depth === 0 ? '🏢' : depth === 1 ? '🏬' : '👥'}</span>
          <span>{scope.name}</span>
          <span style={{ fontSize: 11, opacity: 0.7 }}>({scope.type})</span>
          {hasChildren && <span style={{ marginLeft: 'auto' }}>{expanded ? '▲' : '▼'}</span>}
        </div>
        {expanded && hasChildren && scope.children.map(child => (
          <ScopeNode key={child.id} scope={child} depth={depth + 1} />
        ))}
      </div>
    );
  };

  // 부서 탭용: 최상위 아래 dept들
  const deptScopes = scopes.flatMap(s => s.children || []);

  return (
    <div className="org-page">
      {isLoading ? (
        <div className="org-loading">데이터를 불러오는 중입니다...</div>
      ) : (
        <>
          {currentSubPage === 'org-all' && (
            <div style={{ padding: 24 }}>
              <h2 style={{ marginBottom: 16 }}>전체 조직도</h2>
              {scopes.length === 0 ? (
                <div className="file-empty">조직 데이터가 없습니다.</div>
              ) : (
                scopes.map(scope => <ScopeNode key={scope.id} scope={scope} depth={0} />)
              )}
            </div>
          )}

          {currentSubPage === 'org-dept' && (
            <div className="org-dept-view">
              <div className="org-tabs">
                {deptScopes.map(dept => (
                  <button
                    key={dept.id}
                    onClick={() => handleTabChange(dept)}
                    className={`org-tab-btn ${activeTab?.id === dept.id ? 'active' : ''}`}
                  >
                    {dept.name}
                  </button>
                ))}
              </div>

              {activeTab ? (
                <div style={{ padding: '16px 24px' }}>
                  <h3 style={{ marginBottom: 12 }}>{activeTab.name} 구성원</h3>
                  {loadingMembers ? (
                    <div>불러오는 중...</div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                      {(membersCache[activeTab.id] || []).length === 0 ? (
                        <div className="file-empty">구성원이 없습니다.</div>
                      ) : (
                        (membersCache[activeTab.id] || []).map(member => (
                          <div
                            key={member.userId}
                            className="profile-node profile-node-active"
                            onClick={() => setSelectedMember(member)}
                            style={{ cursor: 'pointer' }}
                          >
                            <div
                              className="profile-avatar"
                              style={{ background: getColor(member.userId) }}
                            >
                              {getInitials(member.name)}
                            </div>
                            <div className="profile-name">{member.name}</div>
                            <div className="profile-role" style={{ fontSize: 12, color: '#666' }}>
                              {member.position || '직급 미정'}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="file-empty" style={{ marginTop: 40 }}>
                  부서를 선택하면 구성원을 볼 수 있습니다.
                </div>
              )}
            </div>
          )}
        </>
      )}

      <SimpleModal open={!!selectedMember} onClose={() => setSelectedMember(null)}>
        {selectedMember && (
          <div className="org-modal-content">
            <div className="org-modal-header">
              <div className="org-modal-avatar" style={{ background: getColor(selectedMember.userId) }}>
                {getInitials(selectedMember.name)}
              </div>
              <div>
                <h2 className="org-modal-name">{selectedMember.name}</h2>
                <div className="org-modal-role-info">
                  <span className="org-modal-role">{selectedMember.position || '직급 미정'}</span>
                </div>
              </div>
            </div>
            <div className="org-modal-details">
              <div className="org-modal-detail-row">
                <div className="org-modal-label">사번</div>
                <div className="org-modal-value">{selectedMember.empNo}</div>
              </div>
              <div className="org-modal-detail-row">
                <div className="org-modal-label">이메일</div>
                <div className="org-modal-value">{selectedMember.email}</div>
              </div>
              <div className="org-modal-detail-row">
                <div className="org-modal-label">상태</div>
                <div className="org-modal-value">{selectedMember.status}</div>
              </div>
            </div>
            <div className="org-modal-actions">
              <button onClick={() => setSelectedMember(null)} className="org-modal-btn org-modal-btn-close">✕ 닫기</button>
            </div>
          </div>
        )}
      </SimpleModal>
    </div>
  );
}
