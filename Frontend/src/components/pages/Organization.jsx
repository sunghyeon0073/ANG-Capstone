import React, { useEffect, useMemo, useState } from 'react';
import { getScopes, getScopeMembers } from '../../api/scopeApi';

<<<<<<< Updated upstream
const positionOrder = { '원장': 1, '팀장': 2, '팀원': 3 };

const getMemberId = member => member.id ?? member.userId ?? member.empNo;
=======
const USE_DUMMY_ORG_DATA = true;

const dummyScopes = [
  { id: 1, scopeCode: 'COMPANY01', name: 'ANG', scopeType: 'COMPANY', parentId: null },
  { id: 2, scopeCode: 'DEPT_EDU', name: '평생교육원', scopeType: 'DEPARTMENT', parentId: 1 },
  { id: 3, scopeCode: 'ANG-EDU-OPS', name: '운영지원팀', scopeType: 'TEAM', parentId: 2 },
  { id: 4, scopeCode: 'ANG-EDU-HR', name: '인사담당팀', scopeType: 'TEAM', parentId: 2 },
  { id: 5, scopeCode: 'ANG-EDU-FIN', name: '재무담당팀', scopeType: 'TEAM', parentId: 2 },
];

const dummyMembersByScope = {
  2: [
    {
      id: 2,
      empNo: 'manager',
      name: '김원장',
      email: 'manager@ang.com',
      status: 'ACTIVE',
      roleLevel: 50,
      position: '원장',
      departments: [
        { scopeId: 2, scopeName: '평생교육원', scopeCode: 'DEPT_EDU', position: '원장' },
        { scopeId: 3, scopeName: '운영지원팀', scopeCode: 'ANG-EDU-OPS', position: '팀장' },
      ],
    },
  ],
  3: [
    {
      id: 2,
      empNo: 'manager',
      name: '김원장',
      email: 'manager@ang.com',
      status: 'ACTIVE',
      roleLevel: 50,
      position: '원장, 팀장',
      departments: [
        { scopeId: 2, scopeName: '평생교육원', scopeCode: 'DEPT_EDU', position: '원장' },
        { scopeId: 3, scopeName: '운영지원팀', scopeCode: 'ANG-EDU-OPS', position: '팀장' },
      ],
    },
    {
      id: 10,
      empNo: 'ops001',
      name: '박운영',
      email: 'ops001@ang.com',
      status: 'ACTIVE',
      roleLevel: 0,
      position: '팀원',
      departments: [
        { scopeId: 3, scopeName: '운영지원팀', scopeCode: 'ANG-EDU-OPS', position: '팀원' },
      ],
    },
  ],
  4: [
    {
      id: 11,
      empNo: 'hr001',
      name: '이인사',
      email: 'hr001@ang.com',
      status: 'ACTIVE',
      roleLevel: 50,
      position: '팀장',
      departments: [
        { scopeId: 4, scopeName: '인사담당팀', scopeCode: 'ANG-EDU-HR', position: '팀장' },
      ],
    },
    {
      id: 12,
      empNo: 'hr002',
      name: '최담당',
      email: 'hr002@ang.com',
      status: 'ACTIVE',
      roleLevel: 0,
      position: '팀원',
      departments: [
        { scopeId: 4, scopeName: '인사담당팀', scopeCode: 'ANG-EDU-HR', position: '팀원' },
      ],
    },
  ],
  5: [
    {
      id: 13,
      empNo: 'fin001',
      name: '정재무',
      email: 'fin001@ang.com',
      status: 'ACTIVE',
      roleLevel: 50,
      position: '팀장',
      departments: [
        { scopeId: 5, scopeName: '재무담당팀', scopeCode: 'ANG-EDU-FIN', position: '팀장' },
      ],
    },
    {
      id: 14,
      empNo: 'fin002',
      name: '한회계',
      email: 'fin002@ang.com',
      status: 'ACTIVE',
      roleLevel: 0,
      position: '팀원',
      departments: [
        { scopeId: 5, scopeName: '재무담당팀', scopeCode: 'ANG-EDU-FIN', position: '팀원' },
      ],
    },
  ],
};

const positionOrder = { 원장: 1, 팀장: 2, 팀원: 3 };

const getMemberId = member => member.id ?? member.userId;
>>>>>>> Stashed changes
const getInitials = name => name?.charAt(0) || '?';

const buildScopeTree = scopeList => {
  const scopeMap = new Map(
    scopeList.map(scope => [
      scope.id,
      {
        ...scope,
        type: scope.scopeType ?? scope.type,
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

const getPositionInScope = (member, scopeId) => {
  const scopedPosition = member.departments?.find(dept => dept.scopeId === scopeId)?.position;
  return scopedPosition || member.position || '직급 미정';
};

const isVisibleOrgMember = member => (member.roleLevel ?? 0) < 100;
const hasPosition = (member, scopeId, keyword) => getPositionInScope(member, scopeId).includes(keyword);

<<<<<<< Updated upstream
const sortMembersByPosition = (members, scopeId) => (
  [...members].sort((a, b) => {
    const aPosition = getPositionInScope(a, scopeId);
    const bPosition = getPositionInScope(b, scopeId);
    return (positionOrder[aPosition] || 99) - (positionOrder[bPosition] || 99);
  })
);
=======
const sortMembersByPosition = (members, scopeId) => {
  return [...members].sort((a, b) => {
    const aPosition = getPositionInScope(a, scopeId);
    const bPosition = getPositionInScope(b, scopeId);
    return (positionOrder[aPosition] || 99) - (positionOrder[bPosition] || 99);
  });
};
>>>>>>> Stashed changes

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

<<<<<<< Updated upstream
const MemberCard = ({ member, scopeId, onClick, teamName }) => (
  <button
    type="button"
    className="profile-node profile-node-active"
    onClick={() => onClick(member)}
  >
    {teamName && <div className="team-dept-label">{teamName}</div>}
    <div className="profile-avatar">
      {getInitials(member.name)}
    </div>
    <div className="profile-name">{member.name}</div>
    <div className="profile-role">{getPositionInScope(member, scopeId)}</div>
  </button>
);
=======
const MemberCard = ({ member, scopeId, onClick, teamName }) => {
  const memberId = getMemberId(member);

  return (
    <button
      type="button"
      className="profile-node profile-node-active"
      onClick={() => onClick(member)}
    >
      {teamName && <div className="team-dept-label">{teamName}</div>}
      <div className="profile-avatar">
        {getInitials(member.name)}
      </div>
      <div className="profile-name">{member.name}</div>
      <div className="profile-role">{getPositionInScope(member, scopeId)}</div>
    </button>
  );
};
>>>>>>> Stashed changes

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
<<<<<<< Updated upstream
      setIsLoading(true);
      setErrorMessage('');
=======
      if (USE_DUMMY_ORG_DATA) {
        setScopes(dummyScopes);
        setMembersCache(dummyMembersByScope);
        return;
      }
>>>>>>> Stashed changes

      try {
        const res = await getScopes();
        const data = res.data?.data || [];
<<<<<<< Updated upstream
        setScopes(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('조직도 로드 실패', error);
        setScopes([]);
        setMembersCache({});
        setErrorMessage('조직 데이터를 불러오지 못했습니다.');
=======
        setScopes(Array.isArray(data) && data.length > 0 ? data : dummyScopes);
        if (!Array.isArray(data) || data.length === 0) {
          setMembersCache(dummyMembersByScope);
        }
      } catch (error) {
        console.error('조직도 로드 실패', error);
        setScopes(dummyScopes);
        setMembersCache(dummyMembersByScope);
>>>>>>> Stashed changes
      } finally {
        setIsLoading(false);
      }
    };

    fetchScopes();
  }, []);

  const fetchMembers = async scopeId => {
    if (membersCache[scopeId]) return;

<<<<<<< Updated upstream
=======
    if (USE_DUMMY_ORG_DATA) {
      setMembersCache(prev => ({ ...prev, [scopeId]: dummyMembersByScope[scopeId] || [] }));
      return;
    }

>>>>>>> Stashed changes
    try {
      setLoadingMembers(true);
      const res = await getScopeMembers(scopeId);
      setMembersCache(prev => ({ ...prev, [scopeId]: res.data?.data || [] }));
    } catch (error) {
<<<<<<< Updated upstream
      console.error('조직 구성원 로드 실패', error);
      setMembersCache(prev => ({ ...prev, [scopeId]: [] }));
      setErrorMessage('조직 구성원을 불러오지 못했습니다.');
=======
      console.error('멤버 로드 실패', error);
      setMembersCache(prev => ({ ...prev, [scopeId]: dummyMembersByScope[scopeId] || [] }));
>>>>>>> Stashed changes
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
    () => deptScopes.flatMap(dept => (dept.children?.length > 0 ? dept.children : [dept])),
    [deptScopes]
  );

  useEffect(() => {
    if (currentSubPage !== 'org-all' || deptScopes.length === 0) return;

    deptScopes.forEach(dept => {
      fetchMembers(dept.id);
      dept.children?.forEach(team => fetchMembers(team.id));
    });
  }, [currentSubPage, deptScopes]);

  const selectedMembers = activeTab
    ? sortMembersByPosition(
        (membersCache[activeTab.id] || [])
          .filter(isVisibleOrgMember)
          .filter(member => {
            const position = getPositionInScope(member, activeTab.id);
            return position.includes('팀장') || position.includes('팀원');
          }),
        activeTab.id
      )
    : [];

  const selectedLeaders = activeTab
    ? selectedMembers.filter(member => hasPosition(member, activeTab.id, '팀장'))
    : [];

  const selectedTeamMembers = activeTab
    ? selectedMembers.filter(member => hasPosition(member, activeTab.id, '팀원'))
    : [];

  const OrgTree = ({ dept }) => {
    const directors = sortMembersByPosition(
      (membersCache[dept.id] || [])
        .filter(isVisibleOrgMember)
        .filter(member => hasPosition(member, dept.id, '원장')),
      dept.id
    );

    const teamLeaders = dept.children.flatMap(team => (
      (membersCache[team.id] || [])
        .filter(isVisibleOrgMember)
        .filter(member => hasPosition(member, team.id, '팀장'))
        .map(member => ({ member, team }))
    ));

    return (
      <div className="org-tree">
        <div className="tree-parent">
          <div className="org-parent-row">
            {directors.length === 0 ? (
              <div className="team-empty">원장 정보가 없습니다.</div>
            ) : (
              directors.map(member => (
                <MemberCard
                  key={`${dept.id}-${getMemberId(member)}`}
                  member={member}
                  scopeId={dept.id}
                  teamName={dept.name}
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
                  <div className="org-child-node" key={`${team.id}-${getMemberId(member)}`}>
                    <MemberCard
                      member={member}
                      scopeId={team.id}
                      teamName={team.name}
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

<<<<<<< Updated upstream
  const DepartmentTree = ({ scope, leaders, members }) => (
    <div className="org-tree org-dept-tree">
      <div className="tree-parent">
        <div className="org-parent-row">
          {leaders.length === 0 ? (
            <div className="team-empty">팀장 정보가 없습니다.</div>
          ) : (
            leaders.map(member => (
              <MemberCard
                key={`${scope.id}-leader-${getMemberId(member)}`}
                member={member}
                scopeId={scope.id}
                teamName={scope.name}
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
                <div className="org-child-node" key={`${scope.id}-member-${getMemberId(member)}`}>
                  <MemberCard
                    member={member}
                    scopeId={scope.id}
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
=======
  const DepartmentTree = ({ scope, leaders, members }) => {
    return (
      <div className="org-tree org-dept-tree">
        <div className="tree-parent">
          <div className="org-parent-row">
            {leaders.length === 0 ? (
              <div className="team-empty">팀장 정보가 없습니다.</div>
            ) : (
              leaders.map(member => (
                <MemberCard
                  key={`${scope.id}-leader-${getMemberId(member)}`}
                  member={member}
                  scopeId={scope.id}
                  teamName={scope.name}
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
                  <div className="org-child-node" key={`${scope.id}-member-${getMemberId(member)}`}>
                    <MemberCard
                      member={member}
                      scopeId={scope.id}
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
>>>>>>> Stashed changes

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
<<<<<<< Updated upstream
                    <DepartmentTree
                      scope={activeTab}
                      leaders={selectedLeaders}
                      members={selectedTeamMembers}
                    />
=======
                    <>
                      {selectedMembers.length === 0 ? (
                        <div className="file-empty">구성원이 없습니다.</div>
                      ) : (
                        <DepartmentTree
                          scope={activeTab}
                          leaders={selectedLeaders}
                          members={selectedTeamMembers}
                        />
                      )}
                    </>
>>>>>>> Stashed changes
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
                {getInitials(selectedMember.name)}
              </div>
              <div>
                <h2 className="org-modal-name">{selectedMember.name}</h2>
                <div className="org-modal-role-info">
                  <span className="org-modal-role">
                    {activeTab
                      ? getPositionInScope(selectedMember, activeTab.id)
                      : selectedMember.position || '직급 미정'}
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
