import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { USERS, DEPTS, DOCS, TASKS, APPROVALS, BOARDS, CHATS, CHAT_MESSAGES, MAILS, NOTIFICATIONS, TODAY, EVENTS, userById, fmtDate, d } from '../data';
import { Icon, Avatar, Pill, Btn, Card, SectionLabel, Input, AIBadge, Modal, Empty, FileTypeIcon, DocPreviewModal, DocPreviewContent } from '../ui';
import { api } from '../api';

// Approval — 전자결재
function Approval({ me, go, subPage }) {
  const [tab, setTab] = useState(subPage || 'pending');
  useEffect(() => { if (subPage) setTab(subPage); }, [subPage]);
  const [list, setList] = useState(APPROVALS);
  const [modal, setModal] = useState(null);

  useEffect(() => {
    api.get('/approvals').then(data => { if (data) setList(data); });
  }, []);
  const [reqOpen, setReqOpen] = useState(false);
  const [newReq, setNewReq] = useState({ title:'', amount:'', content:'' });
  const [rejectModal, setRejectModal] = useState(null); // item being rejected
  const [rejectReason, setRejectReason] = useState('');
  const [delegateOpen, setDelegateOpen] = useState(false);
  const [delegateUser, setDelegateUser] = useState(null);
  const [toast, setToast] = useState(null);

  const showMsg = (m) => { setToast(m); setTimeout(() => setToast(null), 2200); };

  const tabs = [
    { k:'pending',  l:'결재 대기', ic:'clock',          c: list.filter(a=>a.status==='pending').length },
    { k:'approved', l:'승인 완료', ic:'check-circle-2', c: list.filter(a=>a.status==='approved').length },
    { k:'rejected', l:'반려',      ic:'x-circle',       c: list.filter(a=>a.status==='rejected').length },
    { k:'mine',     l:'내가 요청', ic:'user',            c: list.filter(a=>a.requester==='u_me').length },
  ];
  const filtered = tab==='mine' ? list.filter(a=>a.requester==='u_me') : list.filter(a=>a.status===tab);

  const approve = (id) => {
    const decided = fmtDate(TODAY);
    setList(prev => prev.map(a => a.id===id ? {...a, status:'approved', decided} : a));
    setModal(null);
    showMsg('승인 처리되었습니다.');
    setTab('approved');
    api.patch('/approvals/' + id, { status: 'approved', decided });
  };

  const doReject = () => {
    if (!rejectReason.trim()) return;
    const decided = fmtDate(TODAY);
    const reason = rejectReason;
    const id = rejectModal.id;
    setList(prev => prev.map(a => a.id===id ? {...a, status:'rejected', decided, reason} : a));
    setRejectModal(null);
    setModal(null);
    setRejectReason('');
    showMsg('반려 처리되었습니다.');
    setTab('rejected');
    api.patch('/approvals/' + id, { status: 'rejected', decided, reason });
  };

  return (
    <div className="fadein" style={{maxWidth: 1160, margin:'0 auto', padding:'22px 24px 48px'}}>

      {toast && (
        <div style={{
          position:'fixed', bottom:28, left:'50%', transform:'translateX(-50%)',
          background:'var(--ink)', color:'#fff', padding:'10px 22px', borderRadius:12,
          fontSize:13, fontWeight:600, zIndex:9999, boxShadow:'0 4px 20px rgba(0,0,0,0.18)',
          pointerEvents:'none',
        }}>{toast}</div>
      )}

      <div className="flex items-end justify-between mb-5">
        <div>
          <div className="mono text-[11px] uppercase tracking-[0.18em] mb-1" style={{color:'var(--ink-4)'}}>Approval-01 · Digital Signature</div>
          <h1 className="text-[24px] font-bold tracking-tight">전자결재</h1>
        </div>
        <div className="flex gap-2">
          <Btn variant="outline" icon="user-check" onClick={()=>setDelegateOpen(true)}>대리 결재인 지정</Btn>
          <Btn variant="primary" icon="plus" onClick={()=>{ setNewReq({title:'',amount:'',content:''}); setReqOpen(true); }}>결재 요청</Btn>
        </div>
      </div>

      <Card pad={false}>
        <div className="flex items-center justify-between px-5 pt-4 pb-3" style={{borderBottom:'1px solid var(--line-2)'}}>
          <div className="flex items-center gap-2">
            <Icon name={tabs.find(t=>t.k===tab)?.ic || 'clock'} size={14} style={{color:'var(--primary)'}} />
            <span style={{fontSize:13, fontWeight:700, color:'var(--ink)'}}>
              {tabs.find(t=>t.k===tab)?.l || '결재 대기'}
            </span>
            <span className="mono" style={{fontSize:11.5, color:'var(--ink-4)'}}>· {filtered.length}건</span>
          </div>
        </div>
        <div style={{overflowX:'auto'}}>
          <div style={{minWidth: 700}}>
          {filtered.map(a => (
            <div key={a.id} onClick={()=>setModal(a)}
              className="grid items-center px-5 py-4 hover:bg-[--line-2] cursor-pointer"
              style={{gridTemplateColumns:'1fr 120px 110px 110px 96px 108px', borderBottom:'1px solid var(--line-2)'}}>
              <div>
                <div className="text-[13px] font-medium">{a.title}</div>
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
          ))}
          {filtered.length===0 && <Empty icon="file-check" title="항목이 없습니다" />}
          </div>
        </div>
      </Card>

      {/* 결재 요청 모달 */}
      <Modal open={reqOpen} onClose={()=>setReqOpen(false)} title="결재 요청" width={520}>
        <div className="p-6 space-y-4">
          <div>
            <div className="mono text-[11px] uppercase tracking-wider mb-1.5" style={{color:'var(--ink-3)'}}>문서 제목</div>
            <input className="w-full outline-none px-3 py-2.5 rounded-xl text-[13.5px]"
              style={{border:'1px solid var(--line)'}}
              placeholder="결재 요청 제목 입력"
              value={newReq.title}
              onChange={e=>setNewReq({...newReq, title: e.target.value})} />
          </div>
          <div>
            <div className="mono text-[11px] uppercase tracking-wider mb-1.5" style={{color:'var(--ink-3)'}}>결재자</div>
            <div className="flex items-center gap-3 p-3 rounded-xl" style={{background:'var(--primary-50)', border:'1px solid var(--primary-100)'}}>
              <Avatar user={userById('u_lead')} size={28}/>
              <div>
                <div className="text-[13px] font-semibold">{userById('u_lead').name}</div>
                <div className="mono text-[11px]" style={{color:'var(--ink-3)'}}>팀장</div>
              </div>
              <div className="flex-1"/>
              <button className="text-[12px] px-2 py-1 rounded-lg" style={{color:'var(--primary)', border:'1px solid var(--primary-100)'}}
                onClick={() => setDelegateOpen(true)}>변경</button>
            </div>
          </div>
          <div>
            <div className="mono text-[11px] uppercase tracking-wider mb-1.5" style={{color:'var(--ink-3)'}}>금액 (선택)</div>
            <input className="w-full outline-none px-3 py-2.5 rounded-xl text-[13.5px]"
              style={{border:'1px solid var(--line)'}}
              placeholder="예: ₩1,200,000"
              value={newReq.amount}
              onChange={e=>setNewReq({...newReq, amount: e.target.value})} />
          </div>
          <div>
            <div className="mono text-[11px] uppercase tracking-wider mb-1.5" style={{color:'var(--ink-3)'}}>요청 내용</div>
            <textarea className="w-full outline-none px-3 py-2.5 rounded-xl text-[13px]"
              style={{border:'1px solid var(--line)', resize:'vertical', minHeight:100}}
              placeholder="결재 요청 내용을 입력하세요"
              value={newReq.content}
              onChange={e=>setNewReq({...newReq, content: e.target.value})} />
          </div>
          <div className="flex items-center gap-2 pt-2">
            <Btn variant="outline" icon="paperclip" onClick={() => showMsg('파일 첨부 기능 준비 중입니다.')}>첨부파일</Btn>
            <div className="flex-1"/>
            <Btn variant="ghost" onClick={()=>setReqOpen(false)}>취소</Btn>
            <Btn variant="primary" icon="send" onClick={()=>{
              if (!newReq.title.trim()) return;
              const item = {
                id: 'a'+Date.now(),
                title: newReq.title,
                requester: me.id,
                approver: 'u_lead',
                status: 'pending',
                created: fmtDate(TODAY),
                amount: newReq.amount || '—',
              };
              setList(prev => [item, ...prev]);
              setReqOpen(false);
              setTab('mine');
              showMsg('결재가 상신되었습니다.');
              api.post('/approvals', item);
            }}>상신</Btn>
          </div>
        </div>
      </Modal>

      {/* 결재 상세 모달 */}
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
            {modal.reason && (
              <div className="mb-4 p-3 rounded-lg" style={{background:'oklch(0.97 0.03 25)', border:'1px solid oklch(0.9 0.05 25)'}}>
                <div className="mono text-[10.5px] uppercase tracking-wider mb-1" style={{color:'oklch(0.45 0.14 25)'}}>반려 사유</div>
                <div className="text-[12.5px]">{modal.reason}</div>
              </div>
            )}
            <div className="flex items-center gap-2 pt-4" style={{borderTop:'1px solid var(--line-2)'}}>
              <Btn variant="outline" icon="paperclip" onClick={() => showMsg('첨부파일을 불러오는 중입니다…')}>첨부파일 (2)</Btn>
              <div className="flex-1" />
              {modal.status==='pending' && (me.role==='팀장' || me.role==='최고관리자') && (
                <>
                  <Btn variant="danger" icon="x" onClick={()=>{ setRejectModal(modal); setRejectReason(''); }}>반려</Btn>
                  <Btn variant="primary" icon="check" onClick={()=>approve(modal.id)}>승인</Btn>
                </>
              )}
              {modal.status!=='pending' && <div className="mono text-[11px]" style={{color:'var(--ink-3)'}}>처리일 · {modal.decided}</div>}
              <Btn variant="ghost" icon="x" onClick={()=>setModal(null)}>닫기</Btn>
            </div>
          </div>
        )}
      </Modal>

      {/* 반려 사유 모달 */}
      <Modal open={!!rejectModal} onClose={()=>setRejectModal(null)} title="반려 사유 입력" width={480}>
        {rejectModal && (
          <div className="p-6 space-y-4">
            <div className="p-3 rounded-xl" style={{background:'oklch(0.97 0.03 25)', border:'1.5px solid oklch(0.9 0.05 25)'}}>
              <div className="mono text-[10.5px] uppercase tracking-wider mb-1" style={{color:'oklch(0.45 0.14 25)'}}>반려 대상 문서</div>
              <div className="text-[13.5px] font-semibold">{rejectModal.title}</div>
            </div>
            <div>
              <div className="mono text-[11px] uppercase tracking-wider mb-1.5" style={{color:'var(--ink-3)'}}>반려 사유 <span style={{color:'var(--danger)'}}>*</span></div>
              <textarea
                className="w-full outline-none px-3 py-2.5 rounded-xl text-[13px]"
                style={{border:'1.5px solid var(--line)', resize:'vertical', minHeight:100}}
                placeholder="반려 사유를 구체적으로 입력하세요"
                value={rejectReason}
                onChange={e=>setRejectReason(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex items-center gap-2 pt-2">
              <div className="flex-1"/>
              <Btn variant="ghost" onClick={()=>setRejectModal(null)}>취소</Btn>
              <Btn variant="danger" icon="x" disabled={!rejectReason.trim()} onClick={doReject}>반려 처리</Btn>
            </div>
          </div>
        )}
      </Modal>

      {/* 대리 결재인 지정 모달 */}
      <Modal open={delegateOpen} onClose={()=>setDelegateOpen(false)} title="대리 결재인 지정" width={480}>
        <div className="p-6 space-y-4">
          <p className="text-[13px]" style={{color:'var(--ink-3)'}}>부재 기간 동안 결재 권한을 대행할 직원을 지정합니다.</p>
          <div style={{display:'flex', flexDirection:'column', gap:8}}>
            {USERS.filter(u => u.id !== me.id && (u.role === '팀장' || u.role === '최고관리자')).map(u => (
              <div key={u.id}
                onClick={() => setDelegateUser(u.id)}
                className="flex items-center gap-3 p-3 rounded-xl cursor-pointer"
                style={{
                  border: '1.5px solid ' + (delegateUser === u.id ? 'var(--primary)' : 'var(--line-2)'),
                  background: delegateUser === u.id ? 'var(--primary-50)' : '#fff',
                }}>
                <Avatar user={u} size={32} />
                <div className="flex-1">
                  <div style={{fontSize:13.5, fontWeight:700}}>{u.name}</div>
                  <div className="mono" style={{fontSize:11, color:'var(--ink-3)'}}>{u.dept} · {u.rank}</div>
                </div>
                {delegateUser === u.id && <Icon name="check-circle-2" size={18} style={{color:'var(--primary)'}} />}
              </div>
            ))}
          </div>
          <div>
            <div className="mono text-[11px] uppercase tracking-wider mb-1.5" style={{color:'var(--ink-3)'}}>대리 기간</div>
            <div className="flex gap-2">
              <input type="date" className="flex-1 outline-none px-3 py-2 rounded-xl text-[13px]" style={{border:'1px solid var(--line)'}} />
              <span className="self-center text-[12px]" style={{color:'var(--ink-3)'}}>~</span>
              <input type="date" className="flex-1 outline-none px-3 py-2 rounded-xl text-[13px]" style={{border:'1px solid var(--line)'}} />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <div className="flex-1"/>
            <Btn variant="ghost" onClick={()=>setDelegateOpen(false)}>취소</Btn>
            <Btn variant="primary" icon="user-check" disabled={!delegateUser} onClick={()=>{
              setDelegateOpen(false);
              showMsg(`${userById(delegateUser).name}님을 대리 결재인으로 지정했습니다.`);
            }}>지정 완료</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}


export default Approval;
