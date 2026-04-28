// Boards — notice + free
function Boards({ me, go }) {
  const [tab, setTab] = useState('notice');
  const [q, setQ] = useState('');
  const list = BOARDS[tab].filter(p => !q || p.title.includes(q));

  return (
    <div className="fadein" style={{maxWidth: 1360, margin:'0 auto', padding:'28px 40px 64px'}}>
      <div className="flex items-end justify-between mb-5">
        <div>
          <div className="mono text-[11px] uppercase tracking-[0.18em] mb-1" style={{color:'var(--ink-4)'}}>Common-04 · Boards</div>
          <h1 className="text-[24px] font-bold tracking-tight">게시판</h1>
        </div>
        <Btn variant="primary" icon="pen-square">글쓰기</Btn>
      </div>

      <Card pad={false}>
        <div className="flex items-center justify-between px-5 pt-4 pb-3" style={{borderBottom:'1px solid var(--line-2)'}}>
          <div className="flex gap-1">
            <button onClick={()=>setTab('notice')} className="px-3 py-2 text-[12.5px] font-semibold rounded-md"
              style={{background: tab==='notice' ? 'var(--ink)' : 'transparent', color: tab==='notice' ? '#fff' : 'var(--ink-3)'}}>공지사항</button>
            <button onClick={()=>setTab('free')} className="px-3 py-2 text-[12.5px] font-semibold rounded-md"
              style={{background: tab==='free' ? 'var(--ink)' : 'transparent', color: tab==='free' ? '#fff' : 'var(--ink-3)'}}>자유 게시판</button>
          </div>
          <div className="flex items-center gap-2">
            <select className="text-[12px] outline-none" style={{padding:'7px 10px', border:'1px solid var(--line)', borderRadius:8, background:'#fff'}}>
              <option>기간 · 전체</option><option>최근 7일</option><option>이번 달</option>
            </select>
            <Input icon="search" placeholder="통합 검색" value={q} onChange={setQ} style={{width:240}} />
          </div>
        </div>
        <div>
          <div className="grid px-5 py-2.5 mono text-[10.5px] uppercase tracking-wider"
            style={{gridTemplateColumns:'40px 1fr 140px 120px 80px', color:'var(--ink-3)', borderBottom:'1px solid var(--line-2)', background:'#FBFBF7'}}>
            <div>#</div><div>제목</div><div>작성자</div><div>등록일</div><div className="text-right">조회</div>
          </div>
          {list.map((p,i) => (
            <div key={p.id} className="grid items-center px-5 py-3.5 hover:bg-[--line-2] cursor-pointer" style={{
              gridTemplateColumns:'40px 1fr 140px 120px 80px', borderBottom:'1px solid var(--line-2)'
            }}>
              <div className="mono text-[11.5px]" style={{color:'var(--ink-4)'}}>
                {p.pinned ? <Icon name="pin" size={13} style={{color:'var(--danger)'}}/> : String(list.length-i).padStart(2,'0')}
              </div>
              <div className="text-[13.5px]" style={{fontWeight: p.pinned ? 700 : 500}}>
                {p.pinned && <span className="mono text-[10px] mr-2 px-1.5 py-0.5 rounded" style={{background:'oklch(0.97 0.03 25)', color:'oklch(0.45 0.14 25)'}}>필독</span>}
                {p.title}
                {p.comments && <span className="mono text-[11px] ml-2" style={{color:'var(--primary-700)'}}>[{p.comments}]</span>}
              </div>
              <div className="flex items-center gap-1.5"><Avatar user={userById(p.author)} size={18}/><span className="text-[12px]">{userById(p.author).name}</span></div>
              <div className="mono text-[11.5px]" style={{color:'var(--ink-3)'}}>{p.date}</div>
              <div className="mono text-[11.5px] text-right" style={{color:'var(--ink-3)'}}>{p.views || '—'}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

window.Boards = Boards;
