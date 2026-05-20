import React, { useEffect, useMemo, useState } from 'react';
import { getScopes, getScopeMembers } from '../../api/scopeApi';

const positionOrder = { 원장: 1, 팀장: 2, 팀원: 3 };

const getScopeId = scope => scope.id ?? scope.scopeId;
const getScopeName = scope => scope.name ?? scope.scopeName;
const getScopeType = scope => scope.scopeType ?? scope.type;
const getParentId = scope => scope.parentId ?? scope.parentScopeId ?? scope.parent?.id ?? scope.parent?.scopeId;
const getMemberId = member => member.id ?? member.userId ?? member.empNo;
const getInitials = name => name?.charAt(0) || '?';

const getPositionInScope = (member, scopeId) => {
  const scopedPosition = member.departments?.find(dept => (dept.scopeId ?? dept.id) === scopeId)?.position;
  return scopedPosition || member.position || '직급 미정';
};

const isVisibleOrgMember = member => (member.roleLevel ?? 0) < 100;
const hasPosition = (member, scopeId, keyword) => getPositionInScope(member, scopeId).includes(keyword);

const sortMembersByPosition = (members, scopeId) => (
  [...members].sort((a, b) => {
    const aPosition = getPositionInScope(a, scopeId);
    const bPosition = getPositionInScope(b, scopeId);
    return (positionOrder[aPosition] || 99) - (positionOrder[bPosition] || 99);
  })
);

const buildScopeTree = scopeList => {
  const scopeMap = new Map(
    scopeList.map(scope => [
      getScopeId(scope),
      {
        ...scope,
        id: getScopeId(scope),
        name: getScopeName(scope),
        type: getScopeType(scope),
        parentId: getParentId(scope),
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
    onClick={() => onClick(member)}
  >
    {teamName && <div className="team-dept-label">{teamName}</div>}
    <div className="profile-avatar">{getInitials(member.name)}</div>
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

  const scopeTree = useMemo(() => buildScopeTree(scopes), [scopes]);
  const orgUnits = useMemo(() => {
    const departments = scopes.filter(scope => getScopeType(scope) === 'DEPARTMENT');
    return departments.length > 0 ? departments : scopeTree.flatMap(scope => scope.children || []);
  }, [scopeTree, scopes]);
  const deptScopes = useMemo(() => (orgUnits.length > 0 ? orgUnits : scopeTree), [orgUnits, scopeTree]);

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

  useEffect(() => {
    if (currentSubPage !== 'org-dept') return;
    if (!activeTab && orgUnits.length > 0) {
      setActiveTab(orgUnits[0]);
    }
  }, [activeTab, currentSubPage, orgUnits]);

  const loadMembers = async scope => {
    const scopeId = getScopeId(scope);
    if (!scopeId || membersCache[scopeId]) return;

    setLoadingMembers(true);
    setErrorMessage('');

    try {
      const res = await getScopeMembers(scopeId);
      const data = res.data?.data || [];
      setMembersCache(prev => ({
        ...prev,
        [scopeId]: Array.isArray(data) ? data.filter(isVisibleOrgMember) : [],
      }));
    } catch (error) {
      console.error('구성원 로드 실패', error);
      setMembersCache(prev => ({ ...prev, [scopeId]: [] }));
      setErrorMessage('구성원 데이터를 불러오지 못했습니다.');
    } finally {
      setLoadingMembers(false);
    }
  };

  useEffect(() => {
    if (activeTab) {
      loadMembers(activeTab);
    }
  }, [activeTab]);

  const handleTabChange = unit => {
    setActiveTab(unit);
    loadMembers(unit);
  };

  const getMembersForScope = scope => {
    const scopeId = getScopeId(scope);
    return sortMembersByPosition(membersCache[scopeId] || [], scopeId);
  };

  const DepartmentTree = ({ scope, leaders, members }) => {
    const scopeId = getScopeId(scope);

    return (
      <div className="org-tree org-dept-tree">
        <div className="tree-parent">
          <div className="org-parent-row">
            {leaders.length === 0 ? (
              <div className="team-empty">팀장 정보가 없습니다.</div>
            ) : (
              leaders.map(member => (
                <MemberCard
                  key={`${scopeId}-leader-${getMemberId(member)}`}
                  member={member}
                  scopeId={scopeId}
                  onClick={setSelectedMember}
                />
              ))
            )}
          </div>

          {members.length > 0 && (
            <div className={`org-children-block ${members.length === 1 ? 'org-children-single' : 'org-children-multi'}`}>
              <div className="org-connector-down" />
              <div className="org-children-row">
                {members.map(member => (
                  <div className="org-child-node" key={`${scopeId}-member-${getMemberId(member)}`}>
                    <MemberCard
                      member={member}
                      scopeId={scopeId}
                      onClick={setSelectedMember}
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

  const OrgTree = ({ dept }) => {
    const deptId = getScopeId(dept);
    const teams = dept.children || [];
    const deptMembers = getMembersForScope(dept);
    const deptLeaders = deptMembers.filter(member => hasPosition(member, deptId, '원장') || hasPosition(member, deptId, '팀장'));
    const teamLeaders = teams.flatMap(team => {
      const teamId = getScopeId(team);
      return getMembersForScope(team)
        .filter(member => hasPosition(member, teamId, '팀장'))
        .map(member => ({ member, team }));
    });

    return (
      <div className="org-tree">
        <div className="tree-parent">
          <div className="org-parent-row">
            {deptLeaders.length === 0 ? (
              <div className="team-empty">원장 정보가 없습니다.</div>
            ) : (
              deptLeaders.map(member => (
                <MemberCard
                  key={`${deptId}-${getMemberId(member)}`}
                  member={member}
                  scopeId={deptId}
                  onClick={setSelectedMember}
                />
              ))
            )}
          </div>

          {teamLeaders.length > 0 && (
            <div className={`org-children-block ${teamLeaders.length === 1 ? 'org-children-single' : 'org-children-multi'}`}>
              <div className="org-connector-down" />
              <div className="org-children-row">
                {teamLeaders.map(({ member, team }) => (
                  <div className="org-child-node" key={`${getScopeId(team)}-${getMemberId(member)}`}>
                    <MemberCard
                      member={member}
                      scopeId={getScopeId(team)}
                      onClick={setSelectedMember}
                      teamName={getScopeName(team)}
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

  const selectedMembers = activeTab ? getMembersForScope(activeTab) : [];
  const selectedScopeId = activeTab ? getScopeId(activeTab) : null;
  const selectedLeaders = selectedMembers.filter(member => selectedScopeId && hasPosition(member, selectedScopeId, '팀장'));
  const selectedTeamMembers = selectedMembers.filter(member => selectedScopeId && !hasPosition(member, selectedScopeId, '팀장'));

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
                deptScopes.map(dept => <OrgTree key={getScopeId(dept)} dept={dept} />)
              )}
            </div>
          )}

          {currentSubPage === 'org-dept' && (
            <div className="org-dept-view">
              <div className="org-tabs">
                {orgUnits.map(unit => (
                  <button
                    key={getScopeId(unit)}
                    type="button"
                    onClick={() => handleTabChange(unit)}
                    className={`org-tab-btn ${getScopeId(activeTab || {}) === getScopeId(unit) ? 'active' : ''}`}
                  >
                    {getScopeName(unit)}
                  </button>
                ))}
              </div>

              {activeTab ? (
                <div>
                  <h3>{getScopeName(activeTab)} 구성원</h3>
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
                <div className="file-empty">부서를 선택하면 구성원을 볼 수 있습니다.</div>
              )}
            </div>
          )}
        </>
      )}

      <SimpleModal open={!!selectedMember} onClose={() => setSelectedMember(null)}>
        {selectedMember && (
          <div className="org-modal-content">
            <div className="org-modal-header">
              <div className="org-modal-avatar">{getInitials(selectedMember.name)}</div>
              <div>
                <h2 className="org-modal-name">{selectedMember.name}</h2>
                <div className="org-modal-role-info">
                  <span className="org-modal-role">
                    {activeTab ? getPositionInScope(selectedMember, getScopeId(activeTab)) : selectedMember.position || '직급 미정'}
                  </span>
                </div>
              </div>
            </div>
            <div className="org-modal-details">
              <div className="org-modal-label">사번</div>
              <div className="org-modal-value">{selectedMember.empNo}</div>
              <div className="org-modal-label">이메일</div>
              <div className="org-modal-value">{selectedMember.email}</div>
              <div className="org-modal-label">상태</div>
              <div className="org-modal-value">{selectedMember.status}</div>
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
