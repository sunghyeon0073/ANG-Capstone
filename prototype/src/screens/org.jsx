// Org — 조직도 (fullHeight, 이미지 참고 트리 스타일)

// ── OrgNode ──────────────────────────────────────────────────────────────────
function OrgNode({ user, size = 48, isRoot = false, teamLabel = null, onClick }) {
  const has = !!user;
  return (
    <div onClick={onClick}
      style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:5,
               cursor: onClick ? 'pointer' : 'default' }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.opacity = '0.8'; }}
      onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}>

      {/* 팀 라벨 */}
      {teamLabel && (
        <div style={{
          padding:'2px 10px', borderRadius:5, fontSize:10.5, fontWeight:700,
          background:'var(--line-2)', color:'var(--ink-3)', letterSpacing:'0.04em',
          whiteSpace:'nowrap', marginBottom:2,
        }}>{teamLabel}</div>
      )}

      {/* Position 배지 */}
      <div style={{
        padding:'3px 12px', borderRadius:999, fontSize:10.5, fontWeight:800,
        background: isRoot ? 'oklch(0.32 0.10 210)' : has ? 'var(--primary)' : 'var(--line)',
        color: has ? '#fff' : 'var(--ink-4)',
        letterSpacing:'0.05em', whiteSpace:'nowrap',
      }}>
        {has ? user.rank : '미정'}
      </div>

      {/* 원형 아바타 링 */}
      <div style={{
        width: size+14, height: size+14, borderRadius:'50%',
        border:`3px solid ${isRoot ? 'oklch(0.48 0.14 210)' : has ? 'var(--primary)' : 'var(--line-2)'}`,
        background: isRoot ? 'oklch(0.93 0.04 210)' : has ? 'var(--primary-50)' : 'var(--line-3)',
        display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
        boxShadow: has ? `0 4px 16px -4px ${isRoot ? 'oklch(0.48 0.14 210 / 0.25)' : 'var(--primary-100)'}` : 'none',
      }}>
        {has
          ? <Avatar user={user} size={size} />
          : <Icon name="user" size={Math.round(size*0.4)} style={{color:'var(--line)'}} />}
      </div>

      {/* 이름 */}
      <div style={{textAlign:'center', marginTop:2}}>
        <div style={{fontSize: isRoot?14:12.5, fontWeight:800, color: has?'var(--ink)':'var(--ink-4)', whiteSpace:'nowrap'}}>
          {has ? user.name : '미정'}
        </div>
      </div>
    </div>
  );
}

// ── TreeBranch ─────────────────────────────────────────────────────────────
// 가로바 + 세로선으로 자식 노드들을 연결 (CSS half-border 기법)
function TreeBranch({ children, vGap = 28 }) {
  const arr = React.Children.toArray(children);
  const count = arr.length;
  if (!count) return null;

  return (
    <div style={{display:'flex', alignItems:'flex-start'}}>
      {arr.map((child, i) => {
        const isFirst = i === 0;
        const isLast  = i === count - 1;
        return (
          <div key={i} style={{
            display:'flex', flexDirection:'column', alignItems:'center',
            position:'relative',
            paddingTop: count > 1 ? 2 : 0,
          }}>
            {/* 가로바 왼쪽 절반 */}
            {count > 1 && !isFirst && (
              <div style={{position:'absolute', top:0, left:0, right:'50%', height:2, background:'var(--line)'}} />
            )}
            {/* 가로바 오른쪽 절반 */}
            {count > 1 && !isLast && (
              <div style={{position:'absolute', top:0, left:'50%', right:0, height:2, background:'var(--line)'}} />
            )}
            {/* 세로선 */}
            <div style={{width:2, height:vGap, background:'var(--line)', borderRadius:1, flexShrink:0}} />
            {child}
          </div>
        );
      })}
    </div>
  );
}

// ── Org ───────────────────────────────────────────────────────────────────────
function Org({ me, go, subPage }) {
  const [selected, setSelected] = useState(null);
  const [searchQ,  setSearchQ]  = useState('');

  const activeDept = subPage ? DEPTS.find(d => d.id === subPage) : DEPTS.find(d => d.parent === null);
  const isRoot     = !activeDept || activeDept.parent === null;

  const rootDept  = DEPTS.find(d => d.parent === null);
  const rootUser  = rootDept?.head ? USERS.find(u => u.id === rootDept.head) : null;
  const childDepts = DEPTS.filter(d => d.parent !== null);

  const getTeamData = (dept) => ({
    head:    dept.head ? USERS.find(u => u.id === dept.head) : null,
    members: USERS.filter(u => u.dept === dept.name && u.id !== dept.head),
  });

  const searchedUsers = searchQ
    ? USERS.filter(u => u.name.includes(searchQ) || u.dept.includes(searchQ) || u.rank.includes(searchQ))
    : null;

  return (
    <div style={{height:'100%', display:'flex', flexDirection:'column', overflow:'hidden'}}>

      {/* ── 헤더 ── */}
      <div style={{padding:'16px 28px 12px', borderBottom:'1px solid var(--line-2)', flexShrink:0, background:'#fff'}}>
        <div className="flex items-center justify-between">
          <div>
            <div className="mono text-[11px] uppercase tracking-[0.18em] mb-0.5" style={{color:'var(--ink-4)'}}>
              Common-01 · Organization
            </div>
            <h1 style={{fontSize:22, fontWeight:800, letterSpacing:'-0.02em'}}>
              {isRoot ? '평생교육원 조직도' : activeDept?.name}
              {!isRoot && (
                <span className="mono ml-2" style={{fontSize:13, fontWeight:500, color:'var(--ink-3)'}}>
                  · {USERS.filter(u => u.dept === activeDept?.name).length}명
                </span>
              )}
            </h1>
          </div>
          <Input icon="search" placeholder="구성원 검색" value={searchQ} onChange={setSearchQ} style={{width:220}} />
        </div>
      </div>

      {/* ── 콘텐츠 ── */}
      <div className="col-scroll" style={{flex:1, overflow:'auto', padding:'48px 40px 60px', background:'#FAFAF7'}}>

        {/* 검색 결과 */}
        {searchedUsers && (
          <div className="fadein">
            <div className="mono text-[11px] uppercase tracking-wider mb-3" style={{color:'var(--ink-3)'}}>
              "{searchQ}" 검색 결과 · {searchedUsers.length}명
            </div>
            <div className="grid gap-3" style={{gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))'}}>
              {searchedUsers.map(u => (
                <div key={u.id} onClick={() => setSelected(u)}
                  className="cursor-pointer flex items-center gap-3 p-3 rounded-xl"
                  style={{border:'1.5px solid var(--line-2)', background:'#fff'}}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-50)'}
                  onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                  <Avatar user={u} size={36} />
                  <div>
                    <div style={{fontSize:13.5, fontWeight:700}}>{u.name}</div>
                    <div className="mono" style={{fontSize:11, color:'var(--ink-3)'}}>{u.dept} · {u.rank}</div>
                  </div>
                </div>
              ))}
              {searchedUsers.length === 0 && <Empty icon="search" title="검색 결과 없음" />}
            </div>
          </div>
        )}

        {/* ── 전체 조직도 트리 ── */}
        {!searchedUsers && isRoot && (
          <div className="fadein" style={{display:'flex', flexDirection:'column', alignItems:'center', minWidth:'max-content', margin:'0 auto'}}>

            {/* 원장 (루트) */}
            <OrgNode user={rootUser} size={68} isRoot onClick={() => rootUser && setSelected(rootUser)} />

            {/* 루트 → 팀 세로선 */}
            {childDepts.length > 0 && (
              <div style={{width:2, height:36, background:'var(--line)', borderRadius:1}} />
            )}

            {/* 팀 레벨 */}
            <TreeBranch vGap={32}>
              {childDepts.map(dept => {
                const { head, members } = getTeamData(dept);
                return (
                  <div key={dept.id} style={{display:'flex', flexDirection:'column', alignItems:'center', padding:'0 28px'}}>

                    <OrgNode user={head} size={52} teamLabel={dept.name}
                      onClick={head ? () => setSelected(head) : undefined} />

                    {/* 팀장 → 팀원 */}
                    {members.length > 0 && (
                      <>
                        <div style={{width:2, height:28, background:'var(--line)', borderRadius:1}} />
                        <TreeBranch vGap={22}>
                          {members.map(u => (
                            <div key={u.id} style={{padding:'0 10px'}}>
                              <OrgNode user={u} size={36} onClick={() => setSelected(u)} />
                            </div>
                          ))}
                        </TreeBranch>
                      </>
                    )}

                    {members.length === 0 && (
                      <div style={{marginTop:14, padding:'6px 14px', borderRadius:8,
                        border:'1.5px dashed var(--line-2)', fontSize:11, color:'var(--ink-4)'}}>
                        구성원 미정
                      </div>
                    )}
                  </div>
                );
              })}
            </TreeBranch>
          </div>
        )}

        {/* ── 특정 팀 트리 ── */}
        {!searchedUsers && !isRoot && (() => {
          const { head, members } = getTeamData(activeDept);
          return (
            <div className="fadein" style={{display:'flex', flexDirection:'column', alignItems:'center', minWidth:'max-content', margin:'0 auto'}}>

              {/* 팀 배지 */}
              <div style={{
                padding:'4px 18px', borderRadius:999, fontSize:12, fontWeight:800,
                background:'var(--primary-50)', color:'var(--primary-700)',
                border:'1.5px solid var(--primary-100)', marginBottom:14, letterSpacing:'0.04em',
              }}>{activeDept.name}</div>

              <OrgNode user={head} size={62} onClick={head ? () => setSelected(head) : undefined} />

              {members.length > 0 && (
                <>
                  <div style={{width:2, height:36, background:'var(--line)', borderRadius:1}} />
                  <TreeBranch vGap={28}>
                    {members.map(u => (
                      <div key={u.id} style={{padding:'0 16px'}}>
                        <OrgNode user={u} size={44} onClick={() => setSelected(u)} />
                      </div>
                    ))}
                  </TreeBranch>
                </>
              )}

              {members.length === 0 && (
                <div style={{marginTop:20}}>
                  <Empty icon="users" title="구성원 정보가 없습니다" />
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* ── 상세 모달 ── */}
      <Modal open={!!selected} onClose={() => setSelected(null)} width={480}>
        {selected && (
          <div className="p-6">
            <div className="flex items-center gap-4 mb-5">
              <div style={{
                width:72, height:72, borderRadius:'50%',
                border:'3px solid var(--primary)',
                background:'var(--primary-50)',
                display:'flex', alignItems:'center', justifyContent:'center',
              }}>
                <Avatar user={selected} size={58} />
              </div>
              <div>
                <div style={{fontSize:20, fontWeight:800}}>{selected.name}</div>
                <div style={{
                  display:'inline-block', marginTop:4,
                  padding:'2px 10px', borderRadius:999, fontSize:11, fontWeight:700,
                  background:'var(--primary)', color:'#fff',
                }}>{selected.rank}</div>
                <div className="mono" style={{fontSize:11.5, color:'var(--ink-3)', marginTop:4}}>
                  {selected.dept}
                </div>
              </div>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'80px 1fr', gap:'8px 12px',
              padding:'14px 16px', borderRadius:12, background:'#FBFBF7',
              border:'1px solid var(--line-2)', fontSize:12, marginBottom:20}}>
              <div className="mono" style={{color:'var(--ink-3)'}}>사번</div><div>{selected.emp}</div>
              <div className="mono" style={{color:'var(--ink-3)'}}>권한</div><div>{selected.role}</div>
              <div className="mono" style={{color:'var(--ink-3)'}}>이메일</div>
              <div>{selected.name.toLowerCase().replace(/\s/g,'')}@ang.lab</div>
              <div className="mono" style={{color:'var(--ink-3)'}}>내선</div>
              <div>1{selected.emp?.slice(-3)}</div>
            </div>
            <div className="flex gap-2 pt-4" style={{borderTop:'1px solid var(--line-2)'}}>
              <Btn variant="outline" icon="message-square" onClick={() => { setSelected(null); go('chat'); }}>채팅</Btn>
              <Btn variant="outline" icon="mail" onClick={() => { setSelected(null); go('mail'); }}>메일</Btn>
              <div className="flex-1" />
              <Btn variant="ghost" icon="x" onClick={() => setSelected(null)}>닫기</Btn>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

window.Org = Org;
