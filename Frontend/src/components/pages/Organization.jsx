import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FiMail, FiMessageSquare, FiList, FiUsers } from 'react-icons/fi';
import { getScopes, getScopeMembers } from '../../api/scopeApi';

const positionOrder = { '원장': 1, '센터장': 2, '본부장': 3, '팀장': 4, '팀원': 5 };
const leaderKeywords = ['원장', '센터장', '본부장', '팀장'];

const getMemberId = member => member.id ?? member.userId ?? member.empNo;
const getInitials = name => name?.charAt(0) || '?';
const normalizeScopeType = scope => scope.scopeType ?? scope.type ?? 'TEAM';

const uniqueMembers = members => {
  const memberMap = new Map();
  members.forEach(member => {
    const memberId = getMemberId(member);
    if (!memberMap.has(memberId)) memberMap.set(memberId, member);
  });
  return [...memberMap.values()];
};

const buildScopeTree = scopeList => {
  const scopeMap = new Map(
    scopeList.map(scope => [scope.id, { ...scope, type: normalizeScopeType(scope), children: [] }])
  );
  const roots = [];
  scopeMap.forEach(scope => {
    if (scope.parentId && scopeMap.has(scope.parentId)) {
      scopeMap.get(scope.parentId).children.push(scope);
    } else {
      roots.push(scope);
    }
  });
  const sortScopes = items => {
    items.sort((a, b) => a.id - b.id);
    items.forEach(item => sortScopes(item.children));
  };
  sortScopes(roots);
  return roots;
};

const flattenScopeTree = scopes => scopes.flatMap(scope => [scope, ...flattenScopeTree(scope.children || [])]);

const getScopeMembership = (member, scopeId) => member.departments?.find(dept => dept.scopeId === scopeId) ?? null;

const getPositionInScope = (member, scopeId) => {
  const scopedPosition = getScopeMembership(member, scopeId)?.position;
  return scopedPosition || member.position || '직급 미정';
};

const isVisibleOrgMember = member => member.status === 'ACTIVE' && (member.roleLevel ?? 0) < 100;
const hasAnyPosition = (member, scopeId, keywords) => keywords.some(kw => getPositionInScope(member, scopeId).includes(kw));

const getPositionRank = position => {
  const matched = Object.keys(positionOrder).find(kw => position.includes(kw));
  return positionOrder[matched] || 99;
};

const sortMembersByPosition = (members, scopeId) =>
  [...members].sort((a, b) => {
    const rankDiff = getPositionRank(getPositionInScope(a, scopeId)) - getPositionRank(getPositionInScope(b, scopeId));
    return rankDiff !== 0 ? rankDiff : (a.name || '').localeCompare(b.name || '', 'ko');
  });

const getScopeGroups = (scope, members) => {
  const visible = uniqueMembers(members.filter(isVisibleOrgMember));
  const leaders = visible.filter(m => hasAnyPosition(m, scope.id, leaderKeywords));
  const regularMembers = visible.filter(m => !hasAnyPosition(m, scope.id, leaderKeywords));
  return {
    leaders: sortMembersByPosition(leaders, scope.id),
    members: sortMembersByPosition(regularMembers, scope.id),
  };
};

/* ── 서브 컴포넌트 (Organization 외부에 정의 → 렌더마다 리마운트 방지) ── */

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

const MemberCard = ({ member, scopeId, onClick, teamName }) => (
  <button type="button" className="profile-node profile-node-active" onClick={() => onClick(member, scopeId)}>
    {teamName && <div className="team-dept-label">{teamName}</div>}
    <div className="profile-avatar">{getInitials(member.name)}</div>
    <div className="profile-name">{member.name}</div>
    <div className="profile-role">{getPositionInScope(member, scopeId)}</div>
  </button>
);

const OrgTree = ({ dept, membersCache, onSelectMember }) => {
  const deptGroups = getScopeGroups(dept, membersCache[dept.id] || []);
  const directors = deptGroups.leaders;
  const teamLeaders = dept.children.flatMap(team =>
    getScopeGroups(team, membersCache[team.id] || []).leaders.map(member => ({ member, team }))
  );

  return (
    <div className="org-tree">
      <div className="tree-parent">
        <div className="org-parent-row">
          {directors.length === 0 ? (
            <div className="team-empty">책임자 정보가 없습니다.</div>
          ) : (
            directors.map(member => (
              <MemberCard
                key={`${dept.id}-${getMemberId(member)}`}
                member={member}
                scopeId={dept.id}
                teamName={dept.name}
                onClick={onSelectMember}
              />
            ))
          )}
        </div>

        {teamLeaders.length > 0 && (
          <div className="org-children-block">
            <div className="org-children-row">
              {teamLeaders.map(({ member, team }) => (
                <div className="org-child-node" key={`${team.id}-${getMemberId(member)}`}>
                  <MemberCard
                    member={member}
                    scopeId={team.id}
                    teamName={team.name}
                    onClick={onSelectMember}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const DepartmentTree = ({ scope, leaders, members, onSelectMember }) => (
  <div className="org-tree org-dept-tree">
    <div className="tree-parent">
      <div className="org-parent-row">
        {leaders.length === 0 ? (
          <div className="team-empty">책임자 정보가 없습니다.</div>
        ) : (
          leaders.map(member => (
            <MemberCard
              key={`${scope.id}-leader-${getMemberId(member)}`}
              member={member}
              scopeId={scope.id}
              teamName={scope.name}
              onClick={onSelectMember}
            />
          ))
        )}
      </div>

      {members.length > 0 && (
        <div className="org-children-block">
          <div className="org-children-row">
            {members.map(member => (
              <div className="org-child-node" key={`${scope.id}-member-${getMemberId(member)}`}>
                <MemberCard
                  member={member}
                  scopeId={scope.id}
                  teamName={scope.name}
                  onClick={onSelectMember}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  </div>
);

const ORG_NAV = [
  { id: 'org-all',  label: '전체조직', icon: FiList },
  { id: 'org-dept', label: '부서별',   icon: FiUsers },
];

/* ── 메인 컴포넌트 ── */

export default function Organization({ currentSubPage = 'org-all', onSendMail, onStartChat, onSubPageChange }) {
  const [localSubPage, setLocalSubPage] = useState(currentSubPage);
  const [scopes, setScopes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingAll, setIsLoadingAll] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [membersCache, setMembersCache] = useState({});
  const [activeTab, setActiveTab] = useState(null);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // 비동기 클로저에서 항상 최신 캐시를 읽기 위한 ref (stale closure 방지)
  const membersCacheRef = useRef(membersCache);
  membersCacheRef.current = membersCache;

  useEffect(() => {
    setLocalSubPage(currentSubPage);
  }, [currentSubPage]);

  const handleSubPageChange = (pageId) => {
    setLocalSubPage(pageId);
    onSubPageChange?.(pageId);
  };

  const handleSelectMember = useCallback((member, scopeId) => {
    setSelectedMember({ member, scopeId });
  }, []);

  useEffect(() => {
    const fetchScopes = async () => {
      setIsLoading(true);
      setErrorMessage('');
      try {
        const res = await getScopes();
        const data = res.data?.data || [];
        setScopes(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('조직도 로드 실패', error);
        setScopes([]);
        setMembersCache({});
        setErrorMessage('조직 데이터를 불러오지 못했습니다.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchScopes();
  }, []);

  const fetchMembers = async scopeId => {
    if (membersCacheRef.current[scopeId]) return;
    try {
      setLoadingMembers(true);
      const res = await getScopeMembers(scopeId);
      const data = res.data?.data || [];
      setMembersCache(prev => ({
        ...prev,
        [scopeId]: Array.isArray(data) ? data.filter(isVisibleOrgMember) : [],
      }));
    } catch (error) {
      console.error('조직 구성원 로드 실패', error);
      setMembersCache(prev => ({ ...prev, [scopeId]: [] }));
      setErrorMessage('조직 구성원을 불러오지 못했습니다.');
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleTabChange = scope => {
    setActiveTab(scope);
    fetchMembers(scope.id);
  };

  const scopeTree = useMemo(() => buildScopeTree(scopes), [scopes]);
  const companyScopes = useMemo(() => scopeTree.filter(s => s.type === 'COMPANY'), [scopeTree]);
  const deptScopes = useMemo(
    () => companyScopes.flatMap(c => c.children).filter(s => s.type === 'DEPARTMENT'),
    [companyScopes]
  );
  const orgUnits = useMemo(
    () => flattenScopeTree(deptScopes).filter(s => s.type !== 'COMPANY' && !s.children?.length),
    [deptScopes]
  );

  // org-dept: 첫 탭 자동 선택
  useEffect(() => {
    if (localSubPage !== 'org-dept' || orgUnits.length === 0) return;
    if (!activeTab || !orgUnits.some(u => u.id === activeTab.id)) {
      setActiveTab(orgUnits[0]);
    }
  }, [localSubPage, orgUnits, activeTab]);

  // org-all: 전체 구성원 백그라운드 로드
  useEffect(() => {
    if (localSubPage !== 'org-all' || deptScopes.length === 0) return;

    const scopeIdsToLoad = flattenScopeTree(deptScopes).map(s => s.id);
    const pendingIds = scopeIdsToLoad.filter(id => !membersCacheRef.current[id]);
    if (pendingIds.length === 0) return;

    let isCancelled = false;
    setIsLoadingAll(true);

    const loadAllMembers = async () => {
      await Promise.all(
        pendingIds.map(async scopeId => {
          try {
            const res = await getScopeMembers(scopeId);
            const data = Array.isArray(res.data?.data) ? res.data.data : [];
            if (!isCancelled) {
              setMembersCache(prev => ({ ...prev, [scopeId]: data.filter(isVisibleOrgMember) }));
            }
          } catch (error) {
            console.error('조직 구성원 로드 실패', error);
            if (!isCancelled) {
              setMembersCache(prev => ({ ...prev, [scopeId]: [] }));
            }
          }
        })
      );
      if (!isCancelled) setIsLoadingAll(false);
    };

    loadAllMembers();

    return () => {
      isCancelled = true;
      setIsLoadingAll(false);
    };
  }, [localSubPage, deptScopes]);

  // org-dept: 탭 변경 시 해당 부서 구성원 로드
  useEffect(() => {
    if (localSubPage !== 'org-dept' || !activeTab) return;
    if (!membersCacheRef.current[activeTab.id]) {
      fetchMembers(activeTab.id);
    }
  }, [localSubPage, activeTab?.id]);

  const selectedGroups = activeTab
    ? getScopeGroups(activeTab, membersCache[activeTab.id] || [])
    : { leaders: [], members: [] };
  const selectedLeaders = selectedGroups.leaders;
  const selectedTeamMembers = selectedGroups.members;
  const selectedMembers = [...selectedLeaders, ...selectedTeamMembers];

  return (
    <div className="org-workspace">
      <aside className="org-rail">
        <div className="org-rail-header">
          <span className="org-rail-title">조직도</span>
        </div>
        <nav className="org-nav">
          {ORG_NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`org-nav-item ${localSubPage === id ? 'active' : ''}`}
              onClick={() => handleSubPageChange(id)}
            >
              <Icon size={15} />
              <span className="org-nav-label">{label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <div className="org-page">
        {isLoading ? (
          <div className="org-loading">데이터를 불러오는 중입니다...</div>
        ) : (
          <>
            {errorMessage && <div className="mail-error">{errorMessage}</div>}

            {localSubPage === 'org-all' && (
              <div>
                <h2>전체 조직도</h2>
                {isLoadingAll && (
                  <div className="org-loading-banner">구성원 정보를 불러오는 중...</div>
                )}
                {deptScopes.length === 0 ? (
                  <div className="file-empty">조직 데이터가 없습니다.</div>
                ) : (
                  deptScopes.map(dept => (
                    <OrgTree
                      key={dept.id}
                      dept={dept}
                      membersCache={membersCache}
                      onSelectMember={handleSelectMember}
                    />
                  ))
                )}
              </div>
            )}

            {localSubPage === 'org-dept' && (
              <div className="org-dept-view">
                <div className="org-tabs">
                  {orgUnits.map(unit => (
                    <button
                      key={unit.id}
                      type="button"
                      onClick={() => handleTabChange(unit)}
                      className={`org-tab-btn ${activeTab?.id === unit.id ? 'active' : ''}`}
                    >
                      {unit.name}
                    </button>
                  ))}
                </div>

                {activeTab ? (
                  <div>
                    <h3>{activeTab.name} 구성원</h3>
                    {loadingMembers ? (
                      <div className="org-loading">불러오는 중...</div>
                    ) : selectedMembers.length === 0 ? (
                      <div className="file-empty">구성원이 없습니다.</div>
                    ) : (
                      <DepartmentTree
                        scope={activeTab}
                        leaders={selectedLeaders}
                        members={selectedTeamMembers}
                        onSelectMember={handleSelectMember}
                      />
                    )}
                  </div>
                ) : (
                  <div className="file-empty">부서를 선택하면 구성원을 볼 수 있습니다.</div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <SimpleModal open={!!selectedMember} onClose={() => setSelectedMember(null)}>
        {selectedMember && (
          <div className="org-modal-content">
            <div className="org-modal-header">
              <div className="org-modal-avatar">
                {getInitials(selectedMember.member.name)}
              </div>
              <div>
                <h2 className="org-modal-name">{selectedMember.member.name}</h2>
                <div className="org-modal-role-info">
                  <span className="org-modal-role">
                    {getPositionInScope(selectedMember.member, selectedMember.scopeId || activeTab?.id)}
                  </span>
                </div>
              </div>
            </div>
            <div className="org-modal-details">
              <div className="org-modal-label">사번</div>
              <div className="org-modal-value">{selectedMember.member.empNo}</div>
              <div className="org-modal-label">이메일</div>
              <div className="org-modal-value">{selectedMember.member.email}</div>
              <div className="org-modal-label">상태</div>
              <div className="org-modal-value">{selectedMember.member.status}</div>
              <div className="org-modal-label">소속/직책</div>
              <div className="org-modal-value">
                {(selectedMember.member.departments || []).length === 0
                  ? '소속 정보가 없습니다.'
                  : (selectedMember.member.departments || []).map(dept => (
                      <div key={`${dept.scopeId}-${dept.position || 'none'}`}>
                        {dept.scopeName} · {dept.position || '직급 미정'}
                      </div>
                    ))}
              </div>
            </div>
            <div className="org-modal-actions">
              <div className="org-modal-left">
                <button
                  type="button"
                  onClick={() => { onStartChat?.(selectedMember.member); setSelectedMember(null); }}
                  className="org-modal-btn org-modal-btn-chat"
                  title="1:1 채팅"
                >
                  <FiMessageSquare />
                  채팅
                </button>
                <button
                  type="button"
                  onClick={() => onSendMail?.(selectedMember.member)}
                  className="org-modal-btn org-modal-btn-mail"
                >
                  <FiMail />
                  메일
                </button>
              </div>
              <button onClick={() => setSelectedMember(null)} className="org-modal-btn org-modal-btn-close">
                닫기
              </button>
            </div>
          </div>
        )}
      </SimpleModal>
    </div>
  );
}
