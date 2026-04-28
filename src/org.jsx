// Org — chart + directory
function Org({ me, go }) {
  const [selected, setSelected] = useState(null);
  const leader = USERS.find(u=>u.rank==='팀장');
  const members = USERS.filter(u=>u.dept==='학사운영팀' && u.rank!=='팀장');

  return (
    <div className="fadein" style={{maxWidth: 1360, margin:'0 auto', padding:'28px 40px 64px'}}>
      <div className="flex items-end justify-between mb-5">
        <div>
          <div className="mono text-[11px] uppercase tracking-[0.18em] mb-1" style={{color:'var(--ink-4)'}}>Common-01 · Organization</div>
          <h1 className="text-[24px] font-bold tracking-tight">조직도</h1>
        </div>
        <Input icon="search" placeholder="구성원 검색" style={{width:240}} />
      </div>

      <div className="grid gap-5" style={{gridTemplateColumns:'280px 1fr'}}>
        <Card pad={false}>
          <div className="mono text-[11px] uppercase tracking-[0.14em] px-4 py-3 font-semibold" style={{color:'var(--ink-3)', borderBottom:'1px solid var(--line-2)'}}>
            부서
          </div>
          <div className="p-2">
            <div className="flex items-center gap-2 px-3 py-2 font-semibold text-[13px]"><Icon name="building-2" size={14}/> 평생교육원</div>
            <div className="pl-5 space-y-1">
              {DEPTS.filter(d=>d.parent).map(d=>(
                <div key={d.id} className="flex items-center gap-2 px-3 py-2 text-[12.5px] rounded-md cursor-pointer"
                  style={{background: d.id==='d_haksa' ? 'var(--primary-50)' : 'transparent', color: d.id==='d_haksa' ? 'var(--primary-700)' : 'var(--ink-2)'}}>
                  <Icon name="chevron-right" size={12} /> {d.name}
                  {d.id==='d_haksa' && <span className="mono text-[10.5px] ml-auto">{USERS.filter(u=>u.dept==='학사운영팀').length}</span>}
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <SectionLabel>학사운영팀 · {USERS.filter(u=>u.dept==='학사운영팀').length}명</SectionLabel>
          <div className="flex flex-col items-center">
            <div onClick={()=>setSelected(leader)} className="cursor-pointer flex flex-col items-center gap-2 p-4 rounded-xl"
              style={{background:'var(--primary-50)', border:'1px solid var(--primary-100)', minWidth:180}}>
              <Avatar user={leader} size={48}/>
              <div className="text-[13.5px] font-bold">{leader.name}</div>
              <div className="mono text-[10.5px]" style={{color:'var(--primary-700)'}}>팀장</div>
            </div>
            <div style={{width:1, height:24, background:'var(--line)'}}/>
            <div style={{width:'80%', height:1, background:'var(--line)'}}/>
            <div className="grid gap-3 mt-6 w-full" style={{gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))'}}>
              {members.map(u=>(
                <div key={u.id} onClick={()=>setSelected(u)}
                  className="cursor-pointer flex flex-col items-center gap-2 p-4 rounded-xl hover:bg-[--line-2]"
                  style={{border:'1px solid var(--line-2)'}}>
                  <Avatar user={u} size={40}/>
                  <div className="text-[13px] font-semibold">{u.name}</div>
                  <div className="mono text-[10.5px]" style={{color:'var(--ink-3)'}}>{u.rank}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <Modal open={!!selected} onClose={()=>setSelected(null)} width={480}>
        {selected && (
          <div className="p-6">
            <div className="flex items-center gap-4 mb-5">
              <Avatar user={selected} size={64}/>
              <div>
                <div className="text-[18px] font-bold">{selected.name}</div>
                <div className="mono text-[11px]" style={{color:'var(--ink-3)'}}>{selected.dept} · {selected.rank}</div>
              </div>
            </div>
            <div className="grid grid-cols-[80px_1fr] gap-2 mono text-[12px] mb-5">
              <div style={{color:'var(--ink-3)'}}>사번</div><div>{selected.emp}</div>
              <div style={{color:'var(--ink-3)'}}>권한</div><div>{selected.role}</div>
              <div style={{color:'var(--ink-3)'}}>이메일</div><div>{selected.name.toLowerCase().replace(/\s/g,'')}@ang.lab</div>
              <div style={{color:'var(--ink-3)'}}>연락처</div><div>내선 1{selected.emp.slice(-3)}</div>
            </div>
            <div className="flex gap-2 pt-4" style={{borderTop:'1px solid var(--line-2)'}}>
              <Btn variant="outline" icon="message-square" onClick={()=>{setSelected(null); go('chat');}}>채팅</Btn>
              <Btn variant="outline" icon="mail" onClick={()=>{setSelected(null); go('mail');}}>메일</Btn>
              <div className="flex-1"/>
              <Btn variant="ghost" icon="x" onClick={()=>setSelected(null)}>닫기</Btn>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

window.Org = Org;
