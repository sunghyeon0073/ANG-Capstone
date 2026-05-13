import React, { useState, useEffect } from 'react';

const SimpleModal = ({ open, onClose, title, children }) => {
  if (!open) return null;
  return (
    <div className="modal-overlay">
      <div className="modal-content org-modal">
        {children}
      </div>
    </div>
  );
};

// =====================================================================

export default function Organization({ currentSubPage = 'org-all' }) {
  
  // 조직도 데이터 상태 관리

  const [employees, setEmployees] = useState([]); 
  
  const [isLoading, setIsLoading] = useState(false); 
  const [selectedEmp, setSelectedEmp] = useState(null); 
  const [activeTab, setActiveTab] = useState('학사운영팀');

  useEffect(() => {
    const fetchOrganization = async () => {
      try {
        setIsLoading(true);
        /* 나중에 여기에 백엔드 DB에서 직원 데이터를 불러오는(GET) 코드를 넣으면 됩니다. */
      } catch (error) {
        console.error("데이터 로드 실패", error);
      } finally {
        setIsLoading(false); 
      }
    };
    fetchOrganization();
  }, []);

  /* 나중에 여기에 백엔드 DB에 직원 데이터를 추가하거나, 수정, 삭제하는 코드를 넣으면 됩니다. */


  // ✨ 데이터 자동 분류 로직 (부서 이름 하드코딩 제거)
  // 1. 최상단 원장님 찾기 (parentId가 없는 사람)
  const topLeader = employees.find(e => e.parentId === null);
  
  // 2. 팀장들 찾기 (원장님을 부모로 두고 있는 사람들)
  const teamLeaders = employees.filter(e => e.parentId === topLeader?.id);
  
  // 3. 탭 메뉴를 만들기 위해 팀장들의 부서 이름만 중복 없이 추출
  const uniqueDepts = Array.from(new Set(teamLeaders.map(l => l.dept)));

  // 프로필 노드 (동그라미) 컴포넌트
  const ProfileNode = ({ emp }) => {
    if (!emp) {
      return (
        <div className="profile-node">
          <div className="profile-role-empty">미정</div>
          <div className="profile-avatar-empty">👤</div>
          <div className="profile-name-empty">미정</div>
        </div>
      );
    }
    return (
      <div onClick={() => setSelectedEmp(emp)} className="profile-node profile-node-active">
        <div className="profile-role">{emp.role}</div>
        <div className="profile-avatar" style={{ background: emp.color || '#999' }}>
          {emp.initials}
        </div>
        <div className="profile-name">{emp.name}</div>
      </div>
    );
  };

  const treeStyles = `
    .org-tree { display: flex; flex-direction: column; alignItems: center; padding: 40px 0; }
    .tree-level { display: flex; justify-content: center; position: relative; margin-top: 40px; }
    .tree-parent::after { content: ''; position: absolute; top: 100%; left: 50%; width: 2px; height: 40px; background: #ddd; transform: translateX(-50%); }
    .tree-children { display: flex; justify-content: center; position: relative; padding-top: 20px; }
    .tree-children::before { content: ''; position: absolute; top: 0; left: 50%; width: 2px; height: 20px; background: #ddd; transform: translateX(-50%); }
    .team-group { position: relative; padding: 0 20px; }
    .team-group::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: #ddd; }
    .team-group:first-child::before { left: 50%; }
    .team-group:last-child::before { right: 50%; }
    .team-group::after { content: ''; position: absolute; top: 0; left: 50%; width: 2px; height: 20px; background: #ddd; transform: translateX(-50%); }
  `;

  return (
    <div className="org-page">
      <style>{treeStyles}</style>

      {isLoading ? (
        <div className="org-loading">데이터를 불러오는 중입니다...</div>
      ) : (
        <>
          {currentSubPage === 'org-all' && (
            <div className="org-tree" style={{ minHeight: 600 }}>
              <div className="tree-parent">
                <ProfileNode emp={topLeader} />
              </div>

              <div className="tree-level tree-children" style={{ gap: 40 }}>
                {teamLeaders.map(leader => {
                  const members = employees.filter(e => e.parentId === leader.id);
                  return (
                    <div key={leader.id} className="team-group org-team-group">
                      <div className="team-dept-label">{leader.dept}</div>
                      <div className="tree-parent"><ProfileNode emp={leader} /></div>
                      <div className="tree-level tree-children" style={{ gap: 10 }}>
                        {members.length > 0
                          ? members.map(emp => <div key={emp.id} className="team-group"><ProfileNode emp={emp} /></div>)
                          : <div className="team-group"><div className="team-empty">구성원 미정</div></div>
                        }
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {currentSubPage === 'org-dept' && (
            <div className="org-dept-view">

              <div className="org-tabs">
                {uniqueDepts.map(dept => (
                  <button key={dept} onClick={() => setActiveTab(dept)} className={`org-tab-btn ${activeTab === dept ? 'active' : ''}`}>{dept}</button>
                ))}
              </div>

              <div className="org-tree">
                {teamLeaders.filter(leader => leader.dept === activeTab).map(leader => {
                  const members = employees.filter(e => e.parentId === leader.id);
                  return (
                    <div key={leader.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div className="tree-parent"><ProfileNode emp={leader} /></div>
                      <div className="tree-level tree-children" style={{ gap: 10 }}>
                        {members.length > 0
                          ? members.map(emp => <div key={emp.id} className="team-group"><ProfileNode emp={emp} /></div>)
                          : <div className="team-group"><div className="team-empty">구성원 미정</div></div>
                        }
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* 모달창 */}
      <SimpleModal open={!!selectedEmp} onClose={() => setSelectedEmp(null)} title="">
        {selectedEmp && (
          <div className="org-modal-content">
            <div className="org-modal-header">
              <div className="org-modal-avatar" style={{ background: selectedEmp.color }}>
                {selectedEmp.initials}
              </div>
              <div>
                <h2 className="org-modal-name">{selectedEmp.name}</h2>
                <div className="org-modal-role-info">
                  <span className="org-modal-role">{selectedEmp.role}</span>
                  <span className="org-modal-dept">{selectedEmp.dept}</span>
                </div>
              </div>
            </div>
            <div className="org-modal-details">
              <div className="org-modal-detail-row">
                <div className="org-modal-label">사번</div>
                <div className="org-modal-value">{selectedEmp.empNo}</div>
              </div>
              <div className="org-modal-detail-row">
                <div className="org-modal-label">권한</div>
                <div className="org-modal-value">{selectedEmp.role}</div>
              </div>
              <div className="org-modal-detail-row">
                <div className="org-modal-label">이메일</div>
                <div className="org-modal-value">{selectedEmp.email}</div>
              </div>
              <div className="org-modal-detail-row">
                <div className="org-modal-label">내선</div>
                <div className="org-modal-value">{selectedEmp.phone}</div>
              </div>
            </div>
            <div className="org-modal-actions">
              <div className="org-modal-left">
                <button className="org-modal-btn org-modal-btn-chat">💬 채팅</button>
                <button className="org-modal-btn org-modal-btn-mail">✉️ 메일</button>
              </div>
              <button onClick={() => setSelectedEmp(null)} className="org-modal-btn org-modal-btn-close">✕ 닫기</button>
            </div>
          </div>
        )}
      </SimpleModal>
    </div>
  );
}