// Dashboard — 캘린더 중심 레이아웃 + subPage 사이드바
function Dashboard({ me, go, subPage = 'overview' }) {
  const [prompt, setPrompt] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [calCursor, setCalCursor] = useState({ y: 2026, m: 4 });
  const [calSelected, setCalSelected] = useState(TODAY);
  const [showAI, setShowAI] = useState(true);

  const myTasks = TASKS.filter(t => t.assignee === 'u_me');
  const pendingApprovals = APPROVALS.filter(a => a.status === 'pending').length;
  const unreadMails = MAILS.filter(m => m.unread).length;

  // ── 캘린더 계산 ──
  const monthStart = new Date(calCursor.y, calCursor.m - 1, 1);
  const monthEnd   = new Date(calCursor.y, calCursor.m, 0);
  const firstDow   = monthStart.getDay();
  const daysInMonth = monthEnd.getDate();
  const calCells = [];
  for (let i = 0; i < firstDow; i++) calCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) calCells.push(new Date(calCursor.y, calCursor.m - 1, d));
  while (calCells.length < 42) calCells.push(null);

  const eventsFor = (dt) => EVENTS.filter(e => dt && e.start.toDateString() === dt.toDateString());
  const selEvents = eventsFor(calSelected);

  const navCal = (delta) => {
    let m = calCursor.m + delta, y = calCursor.y;
    if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; }
    setCalCursor({ y, m });
  };

  // ── AI 응답 ──
  const AI_RESPONSES = {
    '행사지원 신청서 초안 작성해줘': { suggest: '행사지원 신청서 초안이 2024년 김명자님 작성본을 기반으로 준비되었습니다.', next: 'ai_docs' },
    '이번 주 내 업무 요약': { suggest: `진행 중 ${myTasks.filter(t => t.col === 'doing').length}건: ${myTasks.filter(t => t.col === 'doing').map(t => t.title).join(', ')}.`, next: null },
    '다음 달 반복 일정 알려줘': { suggest: 'AI 분석: 행사지원 마감(5/22), 외부강사 계약 갱신(6/15) 등 반복 패턴이 감지되었습니다.', next: 'calendar' },
    '2024 결산 보고서 요약': { suggest: '2024 결산: 예산 집행률 94.2%, 수강생 수 전년 대비 11% 증가, 행사지원금 2건 초과.', next: 'files' },
  };
  const quickChips = Object.keys(AI_RESPONSES);

  const runAI = (p) => {
    const q = p || prompt;
    if (!q.trim()) return;
    setPrompt(q);
    setRunning(true);
    setResult(null);
    setTimeout(() => {
      setRunning(false);
      setResult(AI_RESPONSES[q] || { suggest: `"${q}" 관련 문서를 검색했습니다. AI 문서에서 초안을 확인하세요.`, next: 'ai_docs' });
    }, 1200);
  };

  // ── 빠른 메모 상태 (조건부 호출 금지 — 최상단에 위치) ──
  const [memo, setMemo] = useState('');
  const [memoSaved, setMemoSaved] = useState(false);
  const saveMemo = () => { setMemoSaved(true); setTimeout(() => setMemoSaved(false), 1800); };

  // ── 요일 색상 ──
  const dowColor = (i) => i === 0 ? 'var(--danger)' : i === 6 ? 'var(--primary-600)' : 'var(--ink-2)';

  // ── 할 일 칸반 ──
  const [localTasks, setLocalTasks] = useState(TASKS.filter(t => t.assignee === 'u_me'));
  const [taskModal, setTaskModal] = useState(null);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [newTask, setNewTask] = useState({ title:'', tag:'신청서', due:'', priority:'normal' });
  const [taskToast, setTaskToast] = useState(null);

  const showTaskMsg = (m) => { setTaskToast(m); setTimeout(() => setTaskToast(null), 2200); };

  const moveTask = (id, col) => {
    setLocalTasks(prev => prev.map(t => t.id === id ? { ...t, col } : t));
    setTaskModal(null);
    const labels = { todo:'예정', doing:'진행 중', done:'완료' };
    showTaskMsg(`"${(localTasks.find(t=>t.id===id)||{}).title}" → ${labels[col]}`);
  };

  const deleteTask = (id) => {
    const t = localTasks.find(t => t.id === id);
    setLocalTasks(prev => prev.filter(t => t.id !== id));
    setTaskModal(null);
    showTaskMsg(`"${t?.title}" 삭제되었습니다.`);
  };

  const addTask = () => {
    if (!newTask.title.trim()) return;
    const t = {
      id: 'task_' + Date.now(),
      title: newTask.title,
      tag: newTask.tag,
      due: newTask.due || fmtDate(TODAY),
      priority: newTask.priority,
      col: 'todo',
      assignee: me.id,
    };
    setLocalTasks(prev => [t, ...prev]);
    setNewTaskOpen(false);
    setNewTask({ title:'', tag:'신청서', due:'', priority:'normal' });
    showTaskMsg(`"${t.title}" 업무가 추가되었습니다.`);
  };

  if (subPage === 'tasks') {
    const cols = [
      { id:'todo',  label:'예정', color:'var(--ink-3)', bg:'var(--line-3)' },
      { id:'doing', label:'진행 중', color:'var(--primary)', bg:'var(--primary-50)' },
      { id:'done',  label:'완료', color:'var(--good)', bg:'#D1FAE5' },
    ];
    const tagColors = { '신청서':'var(--primary-100)', '공문':'var(--accent-100)', '설문':'oklch(0.92 0.06 145)', '운영':'var(--line-2)', '예산':'#FEF3C7' };
    return (
      <div className="fadein" style={{ padding:'24px 32px 60px', maxWidth:1360, margin:'0 auto' }}>
        {taskToast && (
          <div style={{
            position:'fixed', bottom:28, left:'50%', transform:'translateX(-50%)',
            background:'var(--ink)', color:'#fff', padding:'10px 22px', borderRadius:12,
            fontSize:13, fontWeight:600, zIndex:9999, boxShadow:'0 4px 20px rgba(0,0,0,0.18)',
            pointerEvents:'none',
          }}>{taskToast}</div>
        )}
        <div className="flex items-end justify-between mb-5">
          <div>
            <div className="mono text-[11px] uppercase tracking-[0.18em] mb-1" style={{color:'var(--ink-4)'}}>Dashboard · Tasks</div>
            <h1 style={{fontSize:24,fontWeight:800,letterSpacing:'-0.02em'}}>할 일 목록</h1>
          </div>
          <Btn variant="primary" icon="plus" onClick={() => { setNewTask({title:'',tag:'신청서',due:'',priority:'normal'}); setNewTaskOpen(true); }}>새 업무 추가</Btn>
        </div>
        <div className="grid gap-4" style={{gridTemplateColumns:'1fr 1fr 1fr'}}>
          {cols.map(col => {
            const items = localTasks.filter(t => t.col === col.id);
            return (
              <div key={col.id}>
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div style={{width:10, height:10, borderRadius:'50%', background:col.color, flexShrink:0}}/>
                  <span style={{fontSize:13, fontWeight:800, color:'var(--ink)'}}>{col.label}</span>
                  <span className="mono" style={{fontSize:11, color:'var(--ink-4)', marginLeft:4}}>{items.length}</span>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {items.map(t => (
                    <div key={t.id} onClick={() => setTaskModal(t)} style={{
                      background:'#fff', border:'1.5px solid var(--line-2)', borderRadius:14,
                      padding:'12px 14px', cursor:'pointer',
                      borderLeft:`3px solid ${col.color}`,
                    }}
                    onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)'}
                    onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
                      <div style={{fontSize:13.5, fontWeight:600, color:'var(--ink)', marginBottom:6}}>{t.title}</div>
                      <div style={{display:'flex',alignItems:'center',gap:6}}>
                        <span style={{fontSize:11, padding:'2px 7px', borderRadius:6, background: tagColors[t.tag]||'var(--line-2)', color:'var(--ink-2)', fontWeight:700}}>{t.tag}</span>
                        <span className="mono" style={{fontSize:10.5, color:'var(--ink-4)', marginLeft:'auto'}}>~ {t.due}</span>
                        {t.priority==='high' && <span style={{fontSize:10, padding:'1px 5px', borderRadius:4, background:'#FEE2E2', color:'var(--danger)', fontWeight:800}}>긴급</span>}
                      </div>
                    </div>
                  ))}
                  {items.length===0 && (
                    <div style={{padding:'24px 16px',textAlign:'center',color:'var(--ink-4)',fontSize:13,border:'1.5px dashed var(--line-2)',borderRadius:14}}>없음</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* 업무 상세 모달 */}
        <Modal open={!!taskModal} onClose={() => setTaskModal(null)} title="업무 상세" width={480}>
          {taskModal && (() => {
            const colInfo = cols.find(c => c.id === taskModal.col);
            return (
              <div className="p-6">
                <div className="flex items-center gap-2 mb-3">
                  <span style={{
                    padding:'3px 10px', borderRadius:999, fontSize:11.5, fontWeight:700,
                    background: colInfo?.bg, color: colInfo?.color,
                    border: '1px solid ' + colInfo?.color + '40',
                  }}>{colInfo?.label}</span>
                  {taskModal.priority === 'high' && <Pill tone="danger">긴급</Pill>}
                </div>
                <div style={{fontSize:18, fontWeight:800, marginBottom:14}}>{taskModal.title}</div>
                <div className="grid gap-2 p-3 rounded-xl mb-5" style={{background:'#FBFBF7', border:'1px solid var(--line-2)', gridTemplateColumns:'72px 1fr', fontSize:12.5}}>
                  <span className="mono" style={{color:'var(--ink-3)'}}>태그</span><span>{taskModal.tag}</span>
                  <span className="mono" style={{color:'var(--ink-3)'}}>마감일</span><span>{taskModal.due}</span>
                  <span className="mono" style={{color:'var(--ink-3)'}}>담당자</span>
                  <span className="flex items-center gap-1.5"><Avatar user={me} size={16} />{me.name}</span>
                </div>
                <div className="flex items-center gap-2 pt-4" style={{borderTop:'1px solid var(--line-2)'}}>
                  {taskModal.col !== 'todo' && (
                    <Btn variant="outline" size="sm" icon="arrow-left" onClick={() => moveTask(taskModal.id, taskModal.col === 'done' ? 'doing' : 'todo')}>이전 단계</Btn>
                  )}
                  {taskModal.col !== 'done' && (
                    <Btn variant="primary" size="sm" icon="arrow-right" onClick={() => moveTask(taskModal.id, taskModal.col === 'todo' ? 'doing' : 'done')}>
                      {taskModal.col === 'todo' ? '시작하기' : '완료 처리'}
                    </Btn>
                  )}
                  <div className="flex-1"/>
                  <Btn variant="danger" size="sm" icon="trash-2" onClick={() => deleteTask(taskModal.id)}>삭제</Btn>
                  <Btn variant="ghost" size="sm" icon="x" onClick={() => setTaskModal(null)}>닫기</Btn>
                </div>
              </div>
            );
          })()}
        </Modal>

        {/* 새 업무 추가 모달 */}
        <Modal open={newTaskOpen} onClose={() => setNewTaskOpen(false)} title="새 업무 추가" width={460}>
          <div className="p-6 space-y-4">
            <div>
              <div className="mono text-[11px] uppercase tracking-wider mb-1.5" style={{color:'var(--ink-3)'}}>업무 제목</div>
              <input className="w-full outline-none px-3 py-2.5 rounded-xl text-[13.5px]"
                style={{border:'1px solid var(--line)'}}
                placeholder="업무 제목을 입력하세요"
                value={newTask.title}
                onChange={e => setNewTask({...newTask, title: e.target.value})}
                autoFocus
              />
            </div>
            <div>
              <div className="mono text-[11px] uppercase tracking-wider mb-1.5" style={{color:'var(--ink-3)'}}>태그</div>
              <div className="flex gap-2 flex-wrap">
                {['신청서','공문','설문','운영','예산','보고서'].map(tg => (
                  <button key={tg} onClick={() => setNewTask({...newTask, tag: tg})}
                    className="px-3 py-1 rounded-lg text-[12px] font-semibold"
                    style={{
                      background: newTask.tag === tg ? 'var(--ink)' : 'var(--line-2)',
                      color: newTask.tag === tg ? '#fff' : 'var(--ink-2)',
                      border:'none', cursor:'pointer',
                    }}>{tg}</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="mono text-[11px] uppercase tracking-wider mb-1.5" style={{color:'var(--ink-3)'}}>마감일</div>
                <input type="date" className="w-full outline-none px-3 py-2.5 rounded-xl text-[13px]"
                  style={{border:'1px solid var(--line)'}}
                  value={newTask.due}
                  onChange={e => setNewTask({...newTask, due: e.target.value})}
                />
              </div>
              <div>
                <div className="mono text-[11px] uppercase tracking-wider mb-1.5" style={{color:'var(--ink-3)'}}>우선순위</div>
                <div className="flex gap-2">
                  {[['normal','보통'],['high','긴급']].map(([v,l]) => (
                    <button key={v} onClick={() => setNewTask({...newTask, priority: v})}
                      className="flex-1 py-2 rounded-xl text-[12px] font-semibold"
                      style={{
                        background: newTask.priority === v ? (v === 'high' ? '#FEE2E2' : 'var(--primary-50)') : 'var(--line-2)',
                        color: newTask.priority === v ? (v === 'high' ? 'var(--danger)' : 'var(--primary)') : 'var(--ink-3)',
                        border: '1.5px solid ' + (newTask.priority === v ? (v === 'high' ? 'var(--danger)' : 'var(--primary)') : 'transparent'),
                        cursor:'pointer',
                      }}>{l}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <div className="flex-1"/>
              <Btn variant="ghost" onClick={() => setNewTaskOpen(false)}>취소</Btn>
              <Btn variant="primary" icon="plus" disabled={!newTask.title.trim()} onClick={addTask}>추가</Btn>
            </div>
          </div>
        </Modal>
      </div>
    );
  }

  // ── 내 일정 (풀 캘린더) ──
  if (subPage === 'calendar') {
    return (
      <div className="fadein" style={{ padding:'24px 32px 60px', maxWidth:1360, margin:'0 auto' }}>
        <div className="flex items-end justify-between mb-5">
          <div>
            <div className="mono text-[11px] uppercase tracking-[0.18em] mb-1" style={{color:'var(--ink-4)'}}>Dashboard · Calendar</div>
            <h1 style={{fontSize:24,fontWeight:800,letterSpacing:'-0.02em'}}>내 일정</h1>
          </div>
          <Btn variant="primary" icon="calendar-plus" onClick={()=>go('calendar')}>캘린더 전체보기 →</Btn>
        </div>
        <Card pad={false} style={{overflow:'hidden'}}>
          <div className="flex items-center justify-between px-5 py-3.5" style={{borderBottom:'1.5px solid var(--line-2)',background:'#FAFAF7'}}>
            <div className="flex items-center gap-2">
              <button onClick={()=>navCal(-1)} className="w-8 h-8 flex items-center justify-center rounded-lg" style={{color:'var(--ink-3)'}} onMouseEnter={e=>e.currentTarget.style.background='var(--line-2)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}><Icon name="chevron-left" size={18}/></button>
              <div className="mono font-bold" style={{fontSize:18,color:'var(--ink)'}}>{calCursor.y}년 {calCursor.m}월</div>
              <button onClick={()=>navCal(1)} className="w-8 h-8 flex items-center justify-center rounded-lg" style={{color:'var(--ink-3)'}} onMouseEnter={e=>e.currentTarget.style.background='var(--line-2)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}><Icon name="chevron-right" size={18}/></button>
            </div>
          </div>
          <div className="grid grid-cols-7" style={{background:'#F7F7F2',borderBottom:'1.5px solid var(--line-2)'}}>
            {['일','월','화','수','목','금','토'].map((d,i)=>(
              <div key={i} className="mono text-center py-2.5" style={{fontSize:12,fontWeight:800,color:dowColor(i),borderRight:i<6?'1px solid var(--line-2)':'none'}}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7" style={{gridAutoRows:'minmax(100px,auto)'}}>
            {calCells.map((dt,i)=>{
              const isToday=dt&&dt.toDateString()===TODAY.toDateString();
              const isSel=dt&&calSelected&&dt.toDateString()===calSelected.toDateString();
              const evts=eventsFor(dt);
              const dow=i%7; const row=Math.floor(i/7);
              return (
                <div key={i} onClick={()=>dt&&setCalSelected(dt)} className={`cal-day-cell${isSel?' selected':''}`}
                  style={{borderRight:dow<6?'1px solid var(--line-2)':'none',borderBottom:row<5?'1px solid var(--line-2)':'none',background:isSel?'var(--primary-50)':'#fff'}}>
                  {dt&&(<>
                    <span className={`cal-day-num${isToday?' today':dow===0?' sun':''}`} style={{color:!isToday?dowColor(dow):undefined}}>{dt.getDate()}</span>
                    <div style={{display:'flex',flexDirection:'column',gap:2,marginTop:2}}>
                      {evts.slice(0,3).map(e=>(
                        <div key={e.id} className="cal-event-chip" style={{background:e.ai?'var(--accent-100)':e.shared?'var(--primary-100)':'var(--line-2)',color:e.ai?'oklch(0.34 0.18 60)':e.shared?'var(--primary-700)':'var(--ink-2)'}}>
                          {e.title}
                        </div>
                      ))}
                    </div>
                  </>)}
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    );
  }

  // ── 공지사항 ──
  if (subPage === 'notices') {
    return (
      <div className="fadein" style={{ padding:'24px 32px 60px', maxWidth:1360, margin:'0 auto' }}>
        <div className="flex items-end justify-between mb-5">
          <div>
            <div className="mono text-[11px] uppercase tracking-[0.18em] mb-1" style={{color:'var(--ink-4)'}}>Dashboard · Notices</div>
            <h1 style={{fontSize:24,fontWeight:800,letterSpacing:'-0.02em'}}>공지사항</h1>
          </div>
          <Btn variant="outline" icon="layout-grid" onClick={()=>go('boards')}>게시판 전체 →</Btn>
        </div>
        <Card pad={false}>
          {BOARDS.notice.map((n,i)=>(
            <div key={n.id} className="flex items-start gap-3 px-6 py-4 cursor-pointer" style={{borderBottom:i<BOARDS.notice.length-1?'1px solid var(--line-2)':'none'}}
              onClick={()=>go('boards')}
              onMouseEnter={e=>e.currentTarget.style.background='var(--line-3)'}
              onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
              {n.pinned && <div className="shrink-0 mt-0.5"><Icon name="pin" size={14} style={{color:'var(--danger)'}}/></div>}
              <div className="flex-1 min-w-0">
                <div style={{fontSize:14.5, fontWeight:n.pinned?700:500, color:'var(--ink)'}}>{n.title}</div>
                <div className="mono" style={{fontSize:11.5, color:'var(--ink-4)', marginTop:4}}>
                  {userById(n.author).name} · {n.date} · 조회 {n.views}
                </div>
              </div>
              <Icon name="chevron-right" size={16} style={{color:'var(--ink-4)',flexShrink:0,marginTop:2}}/>
            </div>
          ))}
          {BOARDS.free.map((n,i)=>(
            <div key={n.id} className="flex items-start gap-3 px-6 py-4 cursor-pointer" style={{borderBottom:i<BOARDS.free.length-1?'1px solid var(--line-2)':'none'}}
              onClick={()=>go('boards')}
              onMouseEnter={e=>e.currentTarget.style.background='var(--line-3)'}
              onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
              <div style={{width:6,height:6,borderRadius:'50%',background:'var(--line)',flexShrink:0,marginTop:6}}/>
              <div className="flex-1 min-w-0">
                <div style={{fontSize:14.5, fontWeight:500, color:'var(--ink)'}}>{n.title}</div>
                <div className="mono" style={{fontSize:11.5, color:'var(--ink-4)', marginTop:4}}>
                  {userById(n.author).name} · {n.date} · 댓글 {n.comments||0}
                </div>
              </div>
              <Icon name="chevron-right" size={16} style={{color:'var(--ink-4)',flexShrink:0,marginTop:2}}/>
            </div>
          ))}
        </Card>
      </div>
    );
  }

  // ── 빠른 메모 ──
  if (subPage === 'quickmemo') {
    return (
      <div className="fadein" style={{ padding:'24px 32px 60px', maxWidth:860, margin:'0 auto' }}>
        <div className="flex items-end justify-between mb-5">
          <div>
            <div className="mono text-[11px] uppercase tracking-[0.18em] mb-1" style={{color:'var(--ink-4)'}}>Dashboard · Quick Memo</div>
            <h1 style={{fontSize:24,fontWeight:800,letterSpacing:'-0.02em'}}>빠른 메모</h1>
            <p style={{fontSize:13,color:'var(--ink-3)',marginTop:4}}>간단한 업무 메모를 남기세요. 로컬에 임시 저장됩니다.</p>
          </div>
          <Btn variant={memoSaved?'outline':'primary'} icon={memoSaved?'check':'save'} onClick={saveMemo}>{memoSaved?'저장됨':'저장'}</Btn>
        </div>
        <Card>
          <textarea value={memo} onChange={e=>setMemo(e.target.value)}
            placeholder="메모를 입력하세요...&#10;&#10;예) 오늘 할 일, 아이디어, 메모 등"
            rows={22}
            style={{
              width:'100%', padding:'14px 16px',
              border:'1.5px solid var(--line)', borderRadius:12,
              fontSize:14.5, lineHeight:1.85, outline:'none',
              color:'var(--ink)', resize:'none', fontFamily:'inherit',
              background:'#FAFAF9',
            }}
            onFocus={e=>e.target.style.borderColor='var(--primary)'}
            onBlur={e=>e.target.style.borderColor='var(--line)'}
          />
          <div className="mono" style={{fontSize:10.5, color:'var(--ink-4)', marginTop:8, textAlign:'right'}}>
            {memo.length}자 입력 중
          </div>
        </Card>
      </div>
    );
  }

  // ── 기본 overview ──
  return (
    <div className="fadein" style={{ maxWidth: 1480, margin: '0 auto', padding: '24px 36px 60px' }}>

      {/* ── 인사말 + 퀵액션 ── */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="mono text-[11.5px] font-bold uppercase tracking-[0.18em] mb-1" style={{ color: 'var(--ink-4)' }}>
            {fmtDate(TODAY)} · 월요일
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.025em', color: 'var(--ink)' }}>
            안녕하세요, <span style={{ color: 'var(--primary)' }}>{me.name}</span>님
          </h1>
          <p style={{ fontSize: 14, color: 'var(--ink-3)', marginTop: 4 }}>
            {me.dept} · {me.rank} — 오늘도 좋은 하루 되세요.
          </p>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <Btn variant="subtle" icon="file-check-2" onClick={() => go('approval')}>결재</Btn>
          <Btn variant="subtle" icon="mail" onClick={() => go('mail')}>메일</Btn>
          <Btn variant="primary" icon="sparkles" onClick={() => go('ai_docs')}>AI 문서</Btn>
        </div>
      </div>

      {/* ── AI 비서 바 ── */}
      <div className="mb-5 rounded-2xl overflow-hidden"
        style={{ background: 'linear-gradient(135deg, var(--accent-50) 0%, #fff 70%)', border: '1.5px solid var(--accent-100)', boxShadow: '0 4px 16px -4px rgba(11,15,14,0.08)' }}>
        <div className="px-5 pt-4 pb-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent-100)' }}>
            <Icon name="sparkles" size={18} style={{ color: 'oklch(0.38 0.18 60)' }} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--ink)' }}>ANG 비서</div>
            <div className="mono" style={{ fontSize: 11, color: 'oklch(0.40 0.13 60)', letterSpacing: '0.1em' }}>
              Local LLM · Ollama · 조직 문서 {DOCS.length}건 학습
            </div>
          </div>
        </div>
        <div className="px-5 pb-4">
          <div className="flex items-center gap-2 rounded-xl px-2 py-1.5" style={{ background: '#fff', border: '1.5px solid var(--line)' }}>
            <input
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && runAI()}
              placeholder="무엇을 도와드릴까요? (예: 행사지원 신청서 초안 작성)"
              className="flex-1 bg-transparent outline-none px-2 py-2"
              style={{ fontSize: 14, color: 'var(--ink)' }}
            />
            <Btn variant="teal" icon={running ? 'loader' : 'arrow-right'} onClick={() => runAI()} disabled={running || !prompt.trim()}>
              {running ? '생성 중' : '실행'}
            </Btn>
          </div>
          <div className="flex items-center gap-2 mt-2.5 flex-wrap">
            {quickChips.map((c, i) => (
              <button key={i} onClick={() => runAI(c)}
                className="mono px-2.5 py-1 rounded-lg transition-all"
                style={{ fontSize: 11.5, fontWeight: 600, color: 'oklch(0.38 0.18 60)', border: '1.5px solid oklch(0.84 0.07 60)', background: 'transparent' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-50)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >{c}</button>
            ))}
          </div>
          {running && (
            <div className="mt-3 flex items-center gap-2 mono" style={{ fontSize: 12, color: 'var(--ink-3)' }}>
              <span className="pulse-dot">●</span> 조직 문서 벡터 검색 중…
            </div>
          )}
          {result && (
            <div className="mt-3 p-3.5 rounded-xl flex items-start gap-3 slide-up" style={{ background: '#fff', border: '1.5px solid var(--line)' }}>
              <Icon name="check-circle-2" size={18} style={{ color: 'var(--good)', flexShrink: 0 }} />
              <div className="flex-1">
                <div style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 500 }}>{result.suggest}</div>
                <div className="flex items-center gap-2 mt-2">
                  {result.next && <Btn size="sm" variant="primary" icon="arrow-right" onClick={() => go(result.next)}>이동</Btn>}
                  <Btn size="sm" variant="ghost" onClick={() => setResult(null)}>닫기</Btn>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 메인 그리드: 캘린더(좌) + 정보패널(우) ── */}
      <div className="grid gap-5" style={{ gridTemplateColumns: '1fr 360px' }}>

        {/* ── 왼쪽: 캘린더 대형 위젯 ── */}
        <div className="flex flex-col gap-5">
          <Card pad={false} style={{ overflow: 'hidden' }}>
            {/* 캘린더 헤더 */}
            <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1.5px solid var(--line-2)', background: '#FAFAF7' }}>
              <div className="flex items-center gap-2">
                <button onClick={() => navCal(-1)} className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
                  style={{ color: 'var(--ink-3)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--line-2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <Icon name="chevron-left" size={18} />
                </button>
                <div className="mono font-bold" style={{ fontSize: 18, color: 'var(--ink)', letterSpacing: '-0.02em' }}>
                  {calCursor.y}년 {calCursor.m}월
                </div>
                <button onClick={() => navCal(1)} className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
                  style={{ color: 'var(--ink-3)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--line-2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <Icon name="chevron-right" size={18} />
                </button>
                <button onClick={() => { setCalCursor({ y: 2026, m: 4 }); setCalSelected(TODAY); }}
                  className="px-3 py-1 rounded-lg mono text-[12px] font-semibold transition-all"
                  style={{ background: 'var(--primary-100)', color: 'var(--primary-700)' }}
                  onMouseEnter={e => e.currentTarget.style.filter = 'brightness(0.96)'}
                  onMouseLeave={e => e.currentTarget.style.filter = 'none'}>
                  오늘
                </button>
              </div>
              <div className="flex items-center gap-4 mono" style={{ fontSize: 12 }}>
                <label className="flex items-center gap-1.5 cursor-pointer" style={{ color: 'var(--ink-3)' }}>
                  <input type="checkbox" checked={showAI} onChange={e => setShowAI(e.target.checked)} />
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--accent)' }} />
                  <span style={{ fontWeight: 600 }}>AI 추천</span>
                </label>
                <Btn variant="primary" size="sm" icon="plus" onClick={() => go('calendar')}>일정 추가</Btn>
              </div>
            </div>

            {/* 요일 헤더 */}
            <div className="grid grid-cols-7" style={{ background: '#F7F7F2', borderBottom: '1.5px solid var(--line-2)' }}>
              {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
                <div key={i} className="mono text-center py-2.5"
                  style={{ fontSize: 12, fontWeight: 800, color: dowColor(i), borderRight: i < 6 ? '1px solid var(--line-2)' : 'none' }}>
                  {d}
                </div>
              ))}
            </div>

            {/* 날짜 셀 */}
            <div className="grid grid-cols-7" style={{ gridAutoRows: 'minmax(88px, auto)' }}>
              {calCells.map((dt, i) => {
                const isSel = dt && calSelected && dt.toDateString() === calSelected.toDateString();
                const isToday = dt && dt.toDateString() === TODAY.toDateString();
                const evts = eventsFor(dt).filter(e => showAI || !e.ai);
                const dow = i % 7;
                const row = Math.floor(i / 7);
                return (
                  <div key={i} onClick={() => dt && setCalSelected(dt)}
                    className={`cal-day-cell${isSel ? ' selected' : ''}`}
                    style={{
                      borderRight: dow < 6 ? '1px solid var(--line-2)' : 'none',
                      borderBottom: row < 5 ? '1px solid var(--line-2)' : 'none',
                      background: isSel ? 'var(--primary-50)' : '#fff',
                    }}>
                    {dt && (
                      <>
                        <div className="flex items-center justify-between mb-1">
                          <span className={`cal-day-num${isToday ? ' today' : dow === 0 ? ' sun' : ''}`}
                            style={{ color: !isToday ? dowColor(dow) : undefined }}>
                            {dt.getDate()}
                          </span>
                          {evts.length > 2 && (
                            <span className="mono" style={{ fontSize: 9, color: 'var(--ink-4)', fontWeight: 700 }}>+{evts.length - 2}</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {evts.slice(0, 2).map(e => (
                            <div key={e.id} className="cal-event-chip"
                              style={{
                                background: e.ai ? 'var(--accent-100)' : e.shared ? 'var(--primary-100)' : 'var(--line-2)',
                                color: e.ai ? 'oklch(0.34 0.18 60)' : e.shared ? 'var(--primary-700)' : 'var(--ink-2)',
                                display: 'flex', alignItems: 'center', gap: 3,
                              }}>
                              {e.ai && <Icon name="sparkle" size={8} strokeWidth={2.5} style={{ flexShrink: 0 }} />}
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* 선택일 일정 상세 */}
          <Card>
            <SectionLabel
              right={<Btn size="sm" variant="outline" icon="calendar" onClick={() => go('calendar')}>캘린더 전체 →</Btn>}>
              {calSelected ? fmtDate(calSelected) + ' 일정' : '날짜를 선택하세요'}
            </SectionLabel>
            {selEvents.length === 0 ? (
              <div className="flex items-center gap-3 py-4 px-2" style={{ color: 'var(--ink-4)' }}>
                <Icon name="calendar-off" size={18} />
                <span style={{ fontSize: 14 }}>이 날 등록된 일정이 없습니다.</span>
              </div>
            ) : (
              <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
                {selEvents.map(e => (
                  <div key={e.id} className="flex items-start gap-3 p-3.5 rounded-xl"
                    style={{ background: '#FAFAF7', border: '1.5px solid var(--line-2)' }}>
                    <div style={{ width: 4, height: 38, background: e.color, borderRadius: 3, flexShrink: 0 }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="mono font-bold" style={{ fontSize: 12, color: 'var(--ink-2)' }}>{e.time}</span>
                        {e.ai && <AIBadge inline />}
                        {e.shared && <Pill tone="primary">공유</Pill>}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3 }}>{e.title}</div>
                      {e.desc && <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 3 }}>{e.desc}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* ── 오른쪽: 정보 패널 ── */}
        <div className="flex flex-col gap-4">

          {/* 업무 현황 + 결재 통합 카드 */}
          <Card>
            <SectionLabel right={<span className="link mono" style={{ fontSize: 11 }} onClick={() => go('approval')}>결재 전체 →</span>}>
              업무 현황
            </SectionLabel>

            {/* 4 stat 가로 행 */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              {[
                { l: '진행 중',     v: myTasks.filter(t => t.col === 'doing').length, ic: 'loader',        tone: 'var(--primary)',   dest: null },
                { l: '결재 대기',   v: pendingApprovals,                              ic: 'file-check-2',  tone: 'var(--warn)',      dest: 'approval' },
                { l: '미확인 메일', v: unreadMails,                                   ic: 'mail',          tone: 'var(--primary-600)', dest: 'mail' },
                { l: '완료 업무',   v: myTasks.filter(t => t.col === 'done').length,  ic: 'check-circle-2',tone: 'var(--good)',      dest: null },
              ].map((s, i) => (
                <div key={i} onClick={() => s.dest && go(s.dest)}
                  className={`flex flex-col items-center justify-center py-3 rounded-xl ${s.dest ? 'cursor-pointer' : ''}`}
                  style={{ background: '#FAFAF7', border: '1.5px solid var(--line-2)' }}
                  onMouseEnter={e => { if (s.dest) e.currentTarget.style.background = 'var(--primary-50)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#FAFAF7'; }}>
                  <Icon name={s.ic} size={14} style={{ color: s.v > 0 ? s.tone : 'var(--ink-4)', marginBottom: 5 }} />
                  <div className="mono font-black" style={{ fontSize: 22, color: s.v > 0 ? s.tone : 'var(--ink-4)', lineHeight: 1 }}>{s.v}</div>
                  <div className="mono" style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-4)', letterSpacing: '0.07em', textTransform: 'uppercase', marginTop: 4 }}>{s.l}</div>
                </div>
              ))}
            </div>

            {/* 구분선 */}
            <div style={{ borderTop: '1.5px solid var(--line-2)', margin: '0 -22px 12px' }} />

            {/* 결재 목록 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {APPROVALS.slice(0, 3).map(a => (
                <div key={a.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer"
                  style={{ border: '1.5px solid var(--line-2)', background: '#FAFAF7' }}
                  onClick={() => go('approval')}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-50)'}
                  onMouseLeave={e => e.currentTarget.style.background = '#FAFAF7'}>
                  <Avatar user={userById(a.requester)} size={26} />
                  <div className="flex-1 min-w-0">
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }} className="truncate">{a.title}</div>
                    <div className="mono" style={{ fontSize: 10.5, color: 'var(--ink-4)' }}>{a.created} · {a.amount}</div>
                  </div>
                  <Pill tone={a.status === 'pending' ? 'warn' : a.status === 'approved' ? 'good' : 'danger'}>
                    {a.status === 'pending' ? '대기' : a.status === 'approved' ? '승인' : '반려'}
                  </Pill>
                </div>
              ))}
            </div>
          </Card>

          {/* AI 반복 업무 제안 */}
          <Card style={{ background: 'linear-gradient(160deg, var(--accent-50) 0%, #fff 55%)' }}>
            <div className="flex items-center gap-2 mb-3">
              <Icon name="sparkles" size={14} style={{ color: 'oklch(0.40 0.18 60)' }} />
              <span className="mono font-black uppercase" style={{ fontSize: 11, letterSpacing: '0.14em', color: 'oklch(0.38 0.18 60)' }}>
                Organization Memory
              </span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 12 }}>
              과거 패턴 분석 기반 <strong style={{ color: 'var(--ink)' }}>반복 업무 알림</strong>입니다.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { t: '결산 보고서 준비 착수', d: '10.28', src: '2022–2025 패턴' },
                { t: '외부강사 계약 갱신', d: '06.15', src: '2023–2025 패턴' },
                { t: '수강생 설문조사 발송', d: '11.10', src: '2022–2025 패턴' },
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                  style={{ background: '#fff', border: '1.5px solid var(--line)' }}>
                  <div className="mono font-black text-center" style={{ fontSize: 11.5, color: 'oklch(0.40 0.18 60)', minWidth: 36 }}>{s.d}</div>
                  <div className="flex-1 min-w-0">
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{s.t}</div>
                    <div className="mono" style={{ fontSize: 10.5, color: 'var(--ink-4)' }}>{s.src}</div>
                  </div>
                  <Btn size="sm" variant="ai" icon="calendar-plus" onClick={() => go('calendar')}>추가</Btn>
                </div>
              ))}
            </div>
          </Card>

          {/* 공지사항 */}
          <Card>
            <SectionLabel right={<span className="link mono" style={{ fontSize: 11 }} onClick={() => go('boards')}>전체 →</span>}>
              공지사항
            </SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {BOARDS.notice.slice(0, 4).map(n => (
                <div key={n.id} className="flex items-start gap-2 py-1.5 cursor-pointer" onClick={() => go('boards')}>
                  {n.pinned && <Icon name="pin" size={12} style={{ color: 'var(--danger)', marginTop: 3, flexShrink: 0 }} />}
                  <div className="flex-1 min-w-0">
                    <div style={{ fontSize: 13.5, fontWeight: n.pinned ? 700 : 500, color: 'var(--ink)' }} className="truncate">{n.title}</div>
                    <div className="mono" style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 2 }}>{userById(n.author).name} · {n.date}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

window.Dashboard = Dashboard;
