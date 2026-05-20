import React, { useEffect, useMemo, useState } from 'react';
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
    if (!memberMap.has(memberId)) {
      memberMap.set(memberId, member);
    }
  });

  return [...memberMap.values()];
};

const buildScopeTree = scopeList => {
  const scopeMap = new Map(
    scopeList.map(scope => [
      scope.id,
      {
        ...scope,
        type: normalizeScopeType(scope),
        children: [],
      },
    ])
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

const isVisibleOrgMember = member => (member.roleLevel ?? 0) < 100;
const hasAnyPosition = (member, scopeId, keywords) => keywords.some(keyword => getPositionInScope(member, scopeId).includes(keyword));

const getPositionRank = position => {
  const matchedKeyword = Object.keys(positionOrder).find(keyword => position.includes(keyword));
  return positionOrder[matchedKeyword] || 99;
};

const sortMembersByPosition = (members, scopeId) => {
  return [...members].sort((a, b) => {
    const aPosition = getPositionInScope(a, scopeId);
    const bPosition = getPositionInScope(b, scopeId);
    const rankDiff = getPositionRank(aPosition) - getPositionRank(bPosition);

    if (rankDiff !== 0) return rankDiff;

    return (a.name || '').localeCompare(b.name || '', 'ko');
  });
};

const getScopeGroups = (scope, members) => {
  const visibleMembers = uniqueMembers(members.filter(isVisibleOrgMember));

  const leaders = visibleMembers.filter(member => hasAnyPosition(member, scope.id, leaderKeywords));
  const regularMembers = visibleMembers.filter(member => !hasAnyPosition(member, scope.id, leaderKeywords));

  return {
    leaders: sortMembersByPosition(leaders, scope.id),
    members: sortMembersByPosition(regularMembers, scope.id),
  };
};

const SimpleModal = ({ open, onClose, children }) => {
  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content org-modal" onClick={event => event.stopPropagation()}>
        {children}
      </div>
    </div>
  );
};

const MemberCard = ({ member, scopeId, onClick, teamName }) => (
  <button
    type="button"
    className="profile-node profile-node-active"
    onClick={() => onClick(member, scopeId)}
  >
    {teamName && <div className="team-dept-label">{teamName}</div>}
    <div className="profile-avatar">
      {getInitials(member.name)}
    </div>
    <div className="profile-name">{member.name}</div>
    <div className="profile-role">{getPositionInScope(member, scopeId)}</div>
  </button>
);

export default function Organization({ currentSubPage = 'org-all' }) {
  const [scopes, setScopes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [membersCache, setMembersCache] = useState({});
  const [activeTab, setActiveTab] = useState(null);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

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
    if (membersCache[scopeId]) return;

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
  const companyScopes = useMemo(
    () => scopeTree.filter(scope => scope.type === 'COMPANY'),
    [scopeTree]
  );
  const deptScopes = useMemo(
    () => companyScopes
      .flatMap(company => company.children)
      .filter(scope => scope.type === 'DEPARTMENT'),
    [companyScopes]
  );
  const orgUnits = useMemo(
    () => flattenScopeTree(deptScopes).filter(scope => scope.type !== 'COMPANY' && !scope.children?.length),
    [deptScopes]
  );

  useEffect(() => {
    if (currentSubPage !== 'org-dept' || orgUnits.length === 0) return;

    if (!activeTab || !orgUnits.some(unit => unit.id === activeTab.id)) {
      setActiveTab(orgUnits[0]);
    }
  }, [currentSubPage, orgUnits, activeTab]);

  useEffect(() => {
    if (currentSubPage !== 'org-all' || deptScopes.length === 0) return;

    const scopeIdsToLoad = flattenScopeTree(deptScopes).map(scope => scope.id);
    let isCancelled = false;

    const loadAllMembers = async () => {
      await Promise.all(
        scopeIdsToLoad.map(async scopeId => {
          if (membersCache[scopeId]) return;

          try {
            const res = await getScopeMembers(scopeId);
            const data = Array.isArray(res.data?.data) ? res.data.data : [];

            if (!isCancelled) {
              setMembersCache(prev => ({ ...prev, [scopeId]: data }));
            }
          } catch (error) {
            console.error('조직 구성원 로드 실패', error);
            if (!isCancelled) {
              setMembersCache(prev => ({ ...prev, [scopeId]: [] }));
            }
          }
        })
      );
    };

    loadAllMembers();

    return () => {
      isCancelled = true;
    };
  }, [currentSubPage, deptScopes]);

  useEffect(() => {
    if (currentSubPage !== 'org-dept' || !activeTab) return;

    if (!membersCache[activeTab.id]) {
      fetchMembers(activeTab.id);
    }
  }, [currentSubPage, activeTab?.id]);

  const selectedGroups = activeTab ? getScopeGroups(activeTab, membersCache[activeTab.id] || []) : { leaders: [], members: [] };
  const selectedMembers = [...selectedGroups.leaders, ...selectedGroups.members];

  const selectedLeaders = selectedGroups.leaders;

  const selectedTeamMembers = selectedGroups.members;

  const OrgTree = ({ dept }) => {
    const deptGroups = getScopeGroups(dept, membersCache[dept.id] || []);
    const directors = deptGroups.leaders;

    const teamLeaders = dept.children.flatMap(team => (
      getScopeGroups(team, membersCache[team.id] || []).leaders.map(member => ({ member, team }))
    ));

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
                  onClick={(clickedMember, scopeId) => setSelectedMember({ member: clickedMember, scopeId })}
                />
              ))
            )}
          </div>

          {teamLeaders.length > 0 && (
            <div className={`org-children-block ${teamLeaders.length === 1 ? 'org-children-single' : 'org-children-multi'}`}>
              <div className="org-connector-down" />
              <div className="org-children-row">
                {teamLeaders.map(({ member, team }) => (
                  <div className="org-child-node" key={`${team.id}-${getMemberId(member)}`}>
                    <MemberCard
                      member={member}
                      scopeId={team.id}
                      teamName={team.name}
                      onClick={(clickedMember, scopeId) => setSelectedMember({ member: clickedMember, scopeId })}
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

  const DepartmentTree = ({ scope, leaders, members }) => (
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
                  onClick={(clickedMember, scopeId) => setSelectedMember({ member: clickedMember, scopeId })}
              />
            ))
          )}
        </div>

        {members.length > 0 && (
          <div className={`org-children-block ${members.length === 1 ? 'org-children-single' : 'org-children-multi'}`}>
            <div className="org-connector-down" />
            <div className="org-children-row">
              {members.map(member => (
                <div className="org-child-node" key={`${scope.id}-member-${getMemberId(member)}`}>
                  <MemberCard
                    member={member}
                    scopeId={scope.id}
                    onClick={(clickedMember, scopeId) => setSelectedMember({ member: clickedMember, scopeId })}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="org-page">
      {isLoading ? (
        <div className="org-loading">데이터를 불러오는 중입니다...</div>
      ) : (
        <>
          {errorMessage && <div className="mail-error">{errorMessage}</div>}

          {currentSubPage === 'org-all' && (
            <div>
              <h2>전체 조직도</h2>
              {deptScopes.length === 0 ? (
                <div className="file-empty">조직 데이터가 없습니다.</div>
              ) : (
                deptScopes.map(dept => <OrgTree key={dept.id} dept={dept} />)
              )}
            </div>
          )}

          {currentSubPage === 'org-dept' && (
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
                    <div>불러오는 중...</div>
                  ) : selectedMembers.length === 0 ? (
                    <div className="file-empty">구성원이 없습니다.</div>
                  ) : (
                    <DepartmentTree
                      scope={activeTab}
                      leaders={selectedLeaders}
                      members={selectedTeamMembers}
                    />
                  )}
                </div>
              ) : (
                <div className="file-empty">
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
              <div className="org-modal-avatar">
                {getInitials(selectedMember.member.name)}
              </div>
              <div>
                <h2 className="org-modal-name">{selectedMember.member.name}</h2>
                <div className="org-modal-role-info">
                  <span className="org-modal-role">
                    {getPositionInScope(
                      selectedMember.member,
                      selectedMember.scopeId || activeTab?.id
                    )}
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
