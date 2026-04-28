import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { USERS, DEPTS, DOCS, TASKS, APPROVALS, BOARDS, CHATS, CHAT_MESSAGES, MAILS, NOTIFICATIONS, TODAY, EVENTS, userById, fmtDate, d } from '../data';
import { Icon, Avatar, Pill, Btn, Card, SectionLabel, Input, AIBadge, Modal, Empty, FileTypeIcon, DocPreviewModal, DocPreviewContent } from '../ui';
import { api, parseEvent } from '../api';

// Calendar
function CalendarScreen({ me, go }) {
  const [cursor, setCursor] = useState({ y: 2026, m: 4 });
  const [selected, setSelected] = useState(TODAY);
  const [view, setView] = useState('month');
  const [showShared, setShowShared] = useState(true);
  const [showPersonal, setShowPersonal] = useState(true);
  const [showAI, setShowAI] = useState(true);
  const [modalEvent, setModalEvent] = useState(null);
  const [events, setEvents] = useState(EVENTS);
  const [addOpen, setAddOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editEvent, setEditEvent] = useState(null);
  const [alarmOpen, setAlarmOpen] = useState(false);
  const [alarmEvent, setAlarmEvent] = useState(null);
  const [alarmMin, setAlarmMin] = useState('10');

  useEffect(() => {
    api.get('/events').then(data => { if (data) setEvents(data.map(parseEvent)); });
  }, []);
  const [newEvent, setNewEvent] = useState({ title:'', time:'10:00', shared: false });
  const [showToast, setShowToast] = useState(null);

  const showMsg = (msg) => { setShowToast(msg); setTimeout(()=>setShowToast(null), 2200); };

  const monthStart = new Date(cursor.y, cursor.m-1, 1);
  const monthEnd = new Date(cursor.y, cursor.m, 0);
  const firstDow = monthStart.getDay();
  const daysInMonth = monthEnd.getDate();
  const cells = [];
  for (let i=0;i<firstDow;i++) cells.push(null);
  for (let d=1; d<=daysInMonth; d++) cells.push(new Date(cursor.y, cursor.m-1, d));
  while (cells.length < 42) cells.push(null);

  const eventsFor = (dt) => events.filter(e => {
    if (!dt) return false;
    if (e.start.toDateString() !== dt.toDateString()) return false;
    if (!showShared && e.shared) return false;
    if (!showPersonal && !e.shared && !e.ai) return false;
    if (!showAI && e.ai) return false;
    return true;
  });

  const selEvents = eventsFor(selected);

  const nav = (delta) => {
    let m = cursor.m + delta, y = cursor.y;
    if (m<1) { m=12; y--; } if (m>12) { m=1; y++; }
    setCursor({y,m});
  };

  return (
    <div className="fadein" style={{maxWidth: 1160, margin:'0 auto', padding:'22px 24px 48px'}}>
      <div className="flex items-end justify-between mb-5">
        <div>
          <div className="mono text-[11px] uppercase tracking-[0.18em] mb-1" style={{color:'var(--ink-4)'}}>Calender-01 / 02 · Schedule</div>
          <h1 className="text-[24px] font-bold tracking-tight">캘린더</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg p-0.5" style={{background:'#F3F3EE'}}>
            {['month','week'].map(v=>(
              <button key={v} onClick={()=>setView(v)}
                className="px-3 py-1.5 text-[12px] font-semibold rounded-md"
                style={{background: view===v ? '#fff' : 'transparent', color: view===v ? 'var(--ink)' : 'var(--ink-3)'}}>
                {v==='month'?'월':'주'}
              </button>
            ))}
          </div>
          <Btn variant="outline" icon="sparkles" onClick={() => setAiOpen(true)}>AI 일정 추천</Btn>
          <Btn variant="primary" icon="plus" onClick={()=>{ setNewEvent({title:'', time:'10:00', shared:false}); setAddOpen(true); }}>새 일정</Btn>
        </div>
      </div>

      <div className="grid gap-5" style={{gridTemplateColumns:'1fr 340px'}}>
        <Card pad={false}>
          <div className="flex items-center justify-between px-5 py-4" style={{borderBottom:'1px solid var(--line-2)'}}>
            <div className="flex items-center gap-3">
              <button onClick={()=>nav(-1)} className="p-1 rounded hover:bg-[--line-2]"><Icon name="chevron-left" size={18} /></button>
              <div className="text-[18px] font-bold tracking-tight mono">{cursor.y}.{String(cursor.m).padStart(2,'0')}</div>
              <button onClick={()=>nav(1)} className="p-1 rounded hover:bg-[--line-2]"><Icon name="chevron-right" size={18} /></button>
              <Btn variant="ghost" size="sm" onClick={()=>{setCursor({y:2026,m:4}); setSelected(TODAY);}}>오늘</Btn>
            </div>
            <div className="flex items-center gap-3 mono text-[11px]">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={showPersonal} onChange={e=>setShowPersonal(e.target.checked)} />
                <span className="w-2 h-2 rounded-full" style={{background:'var(--ink-2)'}} /> 개인
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={showShared} onChange={e=>setShowShared(e.target.checked)} />
                <span className="w-2 h-2 rounded-full" style={{background:'var(--primary)'}} /> 공유
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={showAI} onChange={e=>setShowAI(e.target.checked)} />
                <span className="w-2 h-2 rounded-full" style={{background:'var(--accent)'}} /> AI 추천
              </label>
            </div>
          </div>

          <div className="grid grid-cols-7" style={{background:'#FBFBF7'}}>
            {['일','월','화','수','목','금','토'].map((d,i)=>(
              <div key={i} className="px-3 py-2 mono text-[10.5px] uppercase tracking-wider"
                style={{color: i===0?'var(--danger)':i===6?'var(--primary-700)':'var(--ink-3)', borderBottom:'1px solid var(--line-2)', borderRight: i<6?'1px solid var(--line-2)':'none'}}>
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7" style={{gridAutoRows:'minmax(96px, auto)'}}>
            {cells.map((dt, i) => {
              const isSel = dt && selected && dt.toDateString() === selected.toDateString();
              const isToday = dt && dt.toDateString() === TODAY.toDateString();
              const evts = eventsFor(dt);
              const row = Math.floor(i/7);
              return (
                <div key={i} onClick={()=>dt && setSelected(dt)}
                  className="p-2 cursor-pointer transition"
                  style={{
                    background: isSel ? 'var(--primary-50)' : '#fff',
                    borderRight: (i%7)<6 ? '1px solid var(--line-2)' : 'none',
                    borderBottom: row<5 ? '1px solid var(--line-2)' : 'none',
                  }}
                >
                  {dt && (
                    <>
                      <div className="flex items-center justify-between mb-1">
                        <span className="mono text-[12px] font-semibold" style={{
                          color: isToday ? '#fff' : i%7===0 ? 'var(--danger)' : 'var(--ink-2)',
                          background: isToday ? 'var(--primary)' : 'transparent',
                          borderRadius: 10, padding: isToday ? '1px 8px' : '1px 2px',
                        }}>{dt.getDate()}</span>
                      </div>
                      <div className="space-y-0.5">
                        {evts.slice(0,3).map(e=>(
                          <div key={e.id} onClick={ev=>{ev.stopPropagation(); setModalEvent(e);}}
                            className="flex items-center gap-1 text-[11px] rounded px-1 py-0.5 truncate"
                            style={{background: e.ai ? 'var(--accent-50)' : e.shared ? 'var(--primary-50)' : '#F3F3EE', color: 'var(--ink)'}}
                          >
                            <span className="w-1 h-1 rounded-full shrink-0" style={{background:e.color}} />
                            {e.ai && <Icon name="sparkle" size={8} style={{color:'oklch(0.5 0.13 75)'}} strokeWidth={2.5} />}
                            <span className="truncate">{e.title}</span>
                          </div>
                        ))}
                        {evts.length>3 && <div className="mono text-[10px]" style={{color:'var(--ink-3)'}}>+{evts.length-3}</div>}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <SectionLabel>{selected && fmtDate(selected)} 일정</SectionLabel>
            <div className="space-y-2">
              {selEvents.length === 0 && <Empty icon="calendar-off" title="일정 없음" sub="이 날짜에는 등록된 일정이 없습니다." />}
              {selEvents.map(e=>(
                <div key={e.id} onClick={()=>setModalEvent(e)} className="p-3 rounded-lg cursor-pointer" style={{background:'#FBFBF7', border:'1px solid var(--line-2)'}}>
                  <div className="flex items-center gap-2 mb-1">
                    <div style={{width:3, height:14, background:e.color, borderRadius:2}}/>
                    <span className="mono text-[11px] font-semibold" style={{color:'var(--ink-2)'}}>{e.time}</span>
                    {e.ai && <AIBadge inline />}
                    {e.shared && <Pill tone="primary">공유</Pill>}
                  </div>
                  <div className="text-[13px] font-medium">{e.title}</div>
                  {e.desc && <div className="text-[11.5px] mt-1" style={{color:'var(--ink-3)'}}>{e.desc}</div>}
                </div>
              ))}
            </div>
          </Card>

          <Card style={{background:'linear-gradient(180deg, var(--accent-50) 0%, #fff 60%)'}}>
            <div className="flex items-center gap-2 mb-3">
              <Icon name="sparkles" size={14} style={{color:'oklch(0.50 0.13 75)'}} />
              <span className="mono text-[11px] font-semibold uppercase tracking-[0.14em]" style={{color:'oklch(0.45 0.13 75)'}}>
                AI-02-1 · 반복 업무 제안
              </span>
            </div>
            <div className="text-[12.5px] mb-3" style={{color:'var(--ink-2)'}}>
              과거 4년간의 업무 패턴을 분석해 다음 반복 일정을 제안합니다.
            </div>
            <div className="space-y-2">
              {[
                { t:'하반기 결산 준비 착수', d:'10.28', src:'매년 10월 말 착수 (2022–2025)' },
                { t:'외부강사 계약 갱신', d:'06.15', src:'매년 6월 중 갱신 (2023–2025)' },
                { t:'수강생 설문조사 발송', d:'11.10', src:'매년 11월 초 발송 (2022–2025)' },
              ].map((s,i)=>(
                <div key={i} className="p-2.5 rounded-lg flex items-center gap-3" style={{background:'#fff', border:'1px solid var(--line)'}}>
                  <div className="mono text-[11px] font-bold text-center" style={{color:'oklch(0.48 0.13 75)', width:38}}>{s.d}</div>
                  <div className="flex-1">
                    <div className="text-[12.5px] font-medium">{s.t}</div>
                    <div className="mono text-[10px]" style={{color:'var(--ink-4)'}}>{s.src}</div>
                  </div>
                  <Btn size="sm" variant="ai" icon="plus" onClick={()=>{
                    const parts = s.d.split('.').map(Number);
                    const dt = new Date(2026, parts[0]-1, parts[1]);
                    const eid = 'ai_'+Date.now();
                    const newE = { id:eid, title: s.t, start: dt, time:'09:00', shared:true, color:'var(--accent)', owner:'u_me', ai:true, aiReason: s.src };
                    setEvents(prev => [...prev, newE]);
                    showMsg('AI 추천 일정이 추가되었습니다.');
                    const sd = `2026-${String(parts[0]).padStart(2,'0')}-${String(parts[1]).padStart(2,'0')}`;
                    api.post('/events', { id:eid, title: s.t, start_date: sd, time:'09:00', shared:1, color:'var(--accent)', owner:'u_me', ai:1, ai_reason: s.src });
                  }}>추가</Btn>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* 새 일정 추가 Modal */}
      <Modal open={addOpen} onClose={()=>setAddOpen(false)} title="새 일정 추가" width={480}>
        <div className="p-6 space-y-4">
          <div>
            <div className="mono text-[11px] uppercase tracking-wider mb-1.5" style={{color:'var(--ink-3)'}}>일정 제목</div>
            <input className="w-full outline-none px-3 py-2.5 rounded-xl text-[13.5px]"
              style={{border:'1px solid var(--line)', fontSize:13}}
              placeholder="일정 제목 입력"
              value={newEvent.title}
              onChange={e=>setNewEvent({...newEvent, title: e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="mono text-[11px] uppercase tracking-wider mb-1.5" style={{color:'var(--ink-3)'}}>날짜</div>
              <input type="date" className="w-full outline-none px-3 py-2.5 rounded-xl text-[13px]"
                style={{border:'1px solid var(--line)'}}
                defaultValue={selected ? `${selected.getFullYear()}-${String(selected.getMonth()+1).padStart(2,'0')}-${String(selected.getDate()).padStart(2,'0')}` : '2026-04-20'}
                onChange={e=>setNewEvent({...newEvent, date: e.target.value})} />
            </div>
            <div>
              <div className="mono text-[11px] uppercase tracking-wider mb-1.5" style={{color:'var(--ink-3)'}}>시간</div>
              <input type="time" className="w-full outline-none px-3 py-2.5 rounded-xl text-[13px]"
                style={{border:'1px solid var(--line)'}}
                value={newEvent.time}
                onChange={e=>setNewEvent({...newEvent, time: e.target.value})} />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={newEvent.shared} onChange={e=>setNewEvent({...newEvent, shared: e.target.checked})} />
            <span className="text-[13px] font-medium">팀 공유 일정</span>
          </label>
          <div className="flex items-center gap-2 pt-2">
            <div className="flex-1"/>
            <Btn variant="ghost" onClick={()=>setAddOpen(false)}>취소</Btn>
            <Btn variant="primary" icon="calendar-plus" onClick={()=>{
              if (!newEvent.title.trim()) return;
              const dateParts = (newEvent.date || `${selected.getFullYear()}-${String(selected.getMonth()+1).padStart(2,'0')}-${String(selected.getDate()).padStart(2,'0')}`).split('-').map(Number);
              const dt = new Date(dateParts[0], dateParts[1]-1, dateParts[2]);
              const id = 'new_'+Date.now();
              const newE = {
                id, title: newEvent.title, start: dt,
                time: newEvent.time, shared: newEvent.shared,
                color: newEvent.shared ? 'var(--primary)' : 'var(--ink-2)', owner:'u_me'
              };
              setEvents(prev => [...prev, newE]);
              setAddOpen(false);
              showMsg('일정이 추가되었습니다.');
              api.post('/events', { ...newE, start_date: `${dateParts[0]}-${String(dateParts[1]).padStart(2,'0')}-${String(dateParts[2]).padStart(2,'0')}` });
            }}>추가</Btn>
          </div>
        </div>
      </Modal>

      {showToast && <div className="toast"><Icon name="check-circle-2" size={16} style={{color:'var(--good)'}}/> {showToast}</div>}

      <Modal open={!!modalEvent} onClose={()=>setModalEvent(null)} title="일정 상세">
        {modalEvent && (
          <div className="p-6">
            <div className="flex items-center gap-2 mb-3">
              {modalEvent.ai && <AIBadge source={modalEvent.aiReason} inline />}
              {modalEvent.shared && <Pill tone="primary">공유 캘린더</Pill>}
              {!modalEvent.shared && !modalEvent.ai && <Pill>개인 캘린더</Pill>}
            </div>
            <div className="text-[20px] font-bold tracking-tight mb-2">{modalEvent.title}</div>
            <div className="grid grid-cols-[80px_1fr] gap-2 mono text-[12px] mb-4">
              <div style={{color:'var(--ink-3)'}}>일시</div><div>{fmtDate(modalEvent.start)} {modalEvent.time}</div>
              <div style={{color:'var(--ink-3)'}}>담당</div>
              <div className="flex items-center gap-2"><Avatar user={userById(modalEvent.owner)} size={18} /> {userById(modalEvent.owner).name}</div>
              {modalEvent.desc && <><div style={{color:'var(--ink-3)'}}>메모</div><div>{modalEvent.desc}</div></>}
            </div>
            <div className="flex items-center gap-2 pt-4" style={{borderTop:'1px solid var(--line-2)'}}>
              <Btn variant="outline" icon="edit-3" onClick={() => { setEditEvent({...modalEvent, titleEdit: modalEvent.title, timeEdit: modalEvent.time}); setEditOpen(true); }}>수정</Btn>
              <Btn variant="outline" icon="bell" onClick={() => { setAlarmEvent(modalEvent); setAlarmMin('10'); setAlarmOpen(true); }}>알림 설정</Btn>
              <div className="flex-1" />
              <Btn variant="danger" icon="trash-2" onClick={()=>{
                const delId = modalEvent.id;
              setEvents(prev => prev.filter(e => e.id !== delId));
              setModalEvent(null);
              showMsg('일정이 삭제되었습니다.');
              api.delete('/events/' + delId);
              }}>삭제</Btn>
            </div>
          </div>
        )}
      </Modal>

      {/* AI 일정 추천 모달 */}
      <Modal open={aiOpen} onClose={() => setAiOpen(false)} title="AI 일정 추천" width={520}>
        <div className="p-6">
          <div className="flex items-center gap-2 mb-4 p-3 rounded-xl" style={{background:'var(--accent-50)', border:'1px solid var(--accent-100)'}}>
            <Icon name="sparkles" size={16} style={{color:'oklch(0.48 0.13 75)'}}/>
            <span className="text-[12.5px]" style={{color:'oklch(0.35 0.13 75)'}}>과거 4년간 업무 패턴을 분석하여 반복 일정을 추천합니다.</span>
          </div>
          <div className="space-y-3">
            {[
              { t:'하반기 결산 준비 착수', d:'2026-10-28', src:'매년 10월 말 착수 (2022–2025)', conf:96 },
              { t:'외부강사 계약 갱신',   d:'2026-06-15', src:'매년 6월 중 갱신 (2023–2025)', conf:88 },
              { t:'수강생 설문조사 발송', d:'2026-11-10', src:'매년 11월 초 발송 (2022–2025)', conf:91 },
              { t:'워크숍 장소 답사',     d:'2026-08-20', src:'매년 8월 말 답사 (2023–2025)', conf:78 },
            ].map((s,i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl" style={{border:'1px solid var(--line-2)', background:'#fff'}}>
                <div className="flex-1">
                  <div className="text-[13.5px] font-semibold">{s.t}</div>
                  <div className="mono text-[11px] mt-0.5" style={{color:'var(--ink-3)'}}>{s.d} · {s.src}</div>
                </div>
                <div className="mono text-[11px] font-bold" style={{color:'var(--good)'}}>{s.conf}%</div>
                <Btn size="sm" variant="ai" icon="plus" onClick={() => {
                  const parts = s.d.split('-').map(Number);
                  const dt = new Date(parts[0], parts[1]-1, parts[2]);
                  const eid = 'ai_'+Date.now();
                  setEvents(prev => [...prev, { id:eid, title:s.t, start:dt, time:'09:00', shared:true, color:'var(--accent)', owner:'u_me', ai:true, aiReason:s.src }]);
                  showMsg(`"${s.t}" 일정이 추가되었습니다.`);
                  api.post('/events', { id:eid, title:s.t, start_date:s.d, time:'09:00', shared:1, color:'var(--accent)', owner:'u_me', ai:1, ai_reason:s.src });
                }}>추가</Btn>
              </div>
            ))}
          </div>
          <div className="flex justify-end mt-5">
            <Btn variant="ghost" onClick={() => setAiOpen(false)}>닫기</Btn>
          </div>
        </div>
      </Modal>

      {/* 일정 수정 모달 */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="일정 수정" width={480}>
        {editEvent && (
          <div className="p-6 space-y-4">
            <div>
              <div className="mono text-[11px] uppercase tracking-wider mb-1.5" style={{color:'var(--ink-3)'}}>일정 제목</div>
              <input className="w-full outline-none px-3 py-2.5 rounded-xl text-[13.5px]"
                style={{border:'1px solid var(--line)'}}
                value={editEvent.titleEdit}
                onChange={e => setEditEvent(ev => ({...ev, titleEdit: e.target.value}))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="mono text-[11px] uppercase tracking-wider mb-1.5" style={{color:'var(--ink-3)'}}>날짜</div>
                <input type="date" className="w-full outline-none px-3 py-2.5 rounded-xl text-[13px]"
                  style={{border:'1px solid var(--line)'}}
                  defaultValue={editEvent.start ? `${editEvent.start.getFullYear()}-${String(editEvent.start.getMonth()+1).padStart(2,'0')}-${String(editEvent.start.getDate()).padStart(2,'0')}` : ''}
                  onChange={e => setEditEvent(ev => ({...ev, dateEdit: e.target.value}))} />
              </div>
              <div>
                <div className="mono text-[11px] uppercase tracking-wider mb-1.5" style={{color:'var(--ink-3)'}}>시간</div>
                <input type="time" className="w-full outline-none px-3 py-2.5 rounded-xl text-[13px]"
                  style={{border:'1px solid var(--line)'}}
                  value={editEvent.timeEdit}
                  onChange={e => setEditEvent(ev => ({...ev, timeEdit: e.target.value}))} />
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <div className="flex-1"/>
              <Btn variant="ghost" onClick={() => setEditOpen(false)}>취소</Btn>
              <Btn variant="primary" icon="save" onClick={() => {
                const newTitle = editEvent.titleEdit;
                const newTime = editEvent.timeEdit;
                const newDateStr = editEvent.dateEdit;
                setEvents(prev => prev.map(e => e.id === editEvent.id
                  ? { ...e, title: newTitle, time: newTime, ...(newDateStr ? { start: new Date(newDateStr) } : {}) }
                  : e
                ));
                setModalEvent(null);
                setEditOpen(false);
                showMsg('일정이 수정되었습니다.');
              }}>저장</Btn>
            </div>
          </div>
        )}
      </Modal>

      {/* 알림 설정 모달 */}
      <Modal open={alarmOpen} onClose={() => setAlarmOpen(false)} title="알림 설정" width={400}>
        {alarmEvent && (
          <div className="p-6 space-y-4">
            <div className="p-3 rounded-xl" style={{background:'#FBFBF7', border:'1px solid var(--line-2)'}}>
              <div className="text-[13.5px] font-semibold">{alarmEvent.title}</div>
              <div className="mono text-[11px] mt-0.5" style={{color:'var(--ink-3)'}}>{fmtDate(alarmEvent.start)} {alarmEvent.time}</div>
            </div>
            <div>
              <div className="mono text-[11px] uppercase tracking-wider mb-2" style={{color:'var(--ink-3)'}}>알림 시간</div>
              <div className="flex gap-2 flex-wrap">
                {['5','10','15','30','60'].map(m => (
                  <button key={m} onClick={() => setAlarmMin(m)}
                    className="px-3 py-1.5 rounded-lg text-[12.5px] font-semibold"
                    style={{background: alarmMin===m ? 'var(--primary)' : 'var(--line-2)', color: alarmMin===m ? '#fff' : 'var(--ink-2)'}}>
                    {m}분 전
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <div className="flex-1"/>
              <Btn variant="ghost" onClick={() => setAlarmOpen(false)}>취소</Btn>
              <Btn variant="primary" icon="bell" onClick={() => {
                setAlarmOpen(false);
                showMsg(`"${alarmEvent.title}" 알림이 ${alarmMin}분 전으로 설정되었습니다.`);
              }}>설정 완료</Btn>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}


export default CalendarScreen;
