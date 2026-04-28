// Approval — 전자결재
function Approval({ me, go }) {
  const [tab, setTab] = useState('pending');
  const [list, setList] = useState(APPROVALS);
  const [modal, setModal] = useState(null);

  const tabs = [
    { k:'pending',  l:'결재 대기', c: list.filter(a=>a.status==='pending').length },
    { k:'approved', l:'승인 완료', c: list.filter(a=>a.status==='approved').length },
    { k:'rejected', l:'반려',      c: list.filter(a=>a.status==='rejected').length },
    { k:'mine',     l:'내가 요청', c: list.filter(a=>a.requester==='u_me').length },
  ];
  const filtered = tab==='mine' ? list.filter(a=>a.requester==='u_me') : list.filter(a=>a.status===tab);

  const decide = (id, status) => {
    setList(list.map(a => a.id===id ? {...a, status, decided: fmtDate(TODAY)} : a));
    setModal(null);
  };

  return (
    <div className="fadein" style={{maxWidth: 1360, margin:'0 auto', padding:'28px 40px 64px'}}>
      <div className="flex items-end justify-between mb-5">
        <div>
          <div className="mono text-[11px] uppercase tracking-[0.18em] mb-1" style={{color:'var(--ink-4)'}}>Approval-01 · Digital Signature</div>
          <h1 className="text-[24px] font-bold tracking-tight">전자결재</h1>
        </div>
        <div className="flex gap-2">
          <Btn variant="outline" icon="user-check">대리 결재인 지정</Btn>
          <Btn variant="primary" icon="plus">결재 요청</Btn>
        </div>
      </div>

      <Card pad={false}>
        <div className="flex items-center gap-1 px-5 pt-4">
          {tabs.map(t=>(
            <button key={t.k} onClick={()=>setTab(t.k)}
              className="flex items-center gap-2 px-3 py-2 text-[12.5px] font-semibold rounded-md"
              style={{background: tab===t.k ? 'var(--ink)' : 'transparent', color: tab===t.k ? '#fff' : 'var(--ink-3)'}}>
              {t.l} <span className="mono text-[10.5px] opacity-70">{t.c}</span>
            </button>
          ))}
        </div>
        <div style={{borderTop:'1px solid var(--line-2)', marginTop:12}}>
          {filtered.map(a => {
            const isLead = me.role === '팀장' || me.role === '최고관리자';
            return (
              <div key={a.id} onClick={()=>setModal(a)}
                className="grid items-center px-5 py-4 hover:bg-[--line-2] cursor-pointer"
                style={{gridTemplateColumns:'1fr 140px 120px 120px 100px 120px', borderBottom:'1px solid var(--line-2)'}}>
                <div>
                  <div className="text-[13.5px] font-medium">{a.title}</div>
                  <div className="mono text-[10.5px] mt-0.5" style={{color:'var(--ink-4)'}}>ID {a.id.toUpperCase()}</div>
                </div>
                <div className="flex items-center gap-1.5"><Avatar user={userById(a.requester)} size={18}/><span className="text-[12px]">{userById(a.requester).name}</span></div>
                <div className="flex items-center gap-1.5"><Avatar user={userById(a.approver)} size={18}/><span className="text-[12px]">{userById(a.approver).name}</span></div>
                <div className="mono text-[11.5px]" style={{color:'var(--ink-3)'}}>{a.amount}</div>
                <div className="mono text-[11.5px]" style={{color:'var(--ink-3)'}}>{a.created}</div>
                <Pill tone={a.status==='pending'?'warn':a.status==='approved'?'good':'danger'}>
                  {a.status==='pending'?'대기':a.status==='approved'?'승인':'반려'}
                </Pill>
              </div>
            );
          })}
          {filtered.length===0 && <Empty icon="file-check" title="항목이 없습니다" />}
        </div>
      </Card>

      <Modal open={!!modal} onClose={()=>setModal(null)} title="결재 문서 상세" width={640}>
        {modal && (
          <div className="p-6">
            <div className="flex items-center gap-2 mb-2">
              <Pill tone={modal.status==='pending'?'warn':modal.status==='approved'?'good':'danger'}>
                {modal.status==='pending'?'대기':modal.status==='approved'?'승인':'반려'}
              </Pill>
              <span className="mono text-[11px]" style={{color:'var(--ink-4)'}}>{modal.id.toUpperCase()}</span>
            </div>
            <div className="text-[20px] font-bold tracking-tight mb-4">{modal.title}</div>
            <div className="grid grid-cols-2 gap-4 mb-5 p-4 rounded-lg" style={{background:'#FBFBF7', border:'1px solid var(--line-2)'}}>
              <div><div className="mono text-[10.5px] uppercase tracking-wider mb-1" style={{color:'var(--ink-3)'}}>요청자</div><div className="flex items-center gap-2"><Avatar user={userById(modal.requester)} size={20}/> {userById(modal.requester).name}</div></div>
              <div><div className="mono text-[10.5px] uppercase tracking-wider mb-1" style={{color:'var(--ink-3)'}}>결재자</div><div className="flex items-center gap-2"><Avatar user={userById(modal.approver)} size={20}/> {userById(modal.approver).name}</div></div>
              <div><div className="mono text-[10.5px] uppercase tracking-wider mb-1" style={{color:'var(--ink-3)'}}>요청일</div><div className="mono text-[12.5px]">{modal.created}</div></div>
              <div><div className="mono text-[10.5px] uppercase tracking-wider mb-1" style={{color:'var(--ink-3)'}}>금액</div><div className="mono text-[12.5px]">{modal.amount}</div></div>
            </div>
            <div className="p-4 rounded-lg mb-5" style={{background:'#fff', border:'1px solid var(--line)'}}>
              <div className="text-[13px] leading-relaxed" style={{color:'var(--ink-2)'}}>
                첨부 문서 기준 요청사항 상세 내역입니다. 증빙 자료 확인 후 승인/반려 처리 바랍니다.
              </div>
            </div>
            {modal.reason && <div className="mb-4 p-3 rounded-lg" style={{background:'oklch(0.97 0.03 25)', border:'1px solid oklch(0.9 0.05 25)'}}>
              <div className="mono text-[10.5px] uppercase tracking-wider mb-1" style={{color:'oklch(0.45 0.14 25)'}}>반려 사유</div>
              <div className="text-[12.5px]">{modal.reason}</div>
            </div>}
            <div className="flex items-center gap-2 pt-4" style={{borderTop:'1px solid var(--line-2)'}}>
              <Btn variant="outline" icon="paperclip">첨부파일 (2)</Btn>
              <div className="flex-1" />
              {modal.status==='pending' && (me.role==='팀장' || me.role==='최고관리자') && (
                <>
                  <Btn variant="danger" icon="x" onClick={()=>decide(modal.id,'rejected')}>반려</Btn>
                  <Btn variant="primary" icon="check" onClick={()=>decide(modal.id,'approved')}>승인</Btn>
                </>
              )}
              {modal.status!=='pending' && <div className="mono text-[11px]" style={{color:'var(--ink-3)'}}>처리일 · {modal.decided}</div>}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

window.Approval = Approval;
