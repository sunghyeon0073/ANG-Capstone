// Dashboard — home screen with AI command bar, today, tasks, memory sidebar
function Dashboard({ me, go, notify }) {
  const [prompt, setPrompt] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);

  const todays = EVENTS.filter(e => e.start.toDateString() === TODAY.toDateString());
  const myTasks = TASKS.filter(t => t.assignee === 'u_me');
  const pendingApprovals = APPROVALS.filter(a => a.status === 'pending').length;

  const runAI = () => {
    if (!prompt.trim()) return;
    setRunning(true);
    setResult(null);
    setTimeout(() => {
      setRunning(false);
      setResult({
        suggest: '행사지원 신청서 초안이 2024년 김명자님 작성본을 기반으로 준비되었습니다.',
        next: 'ai_docs',
      });
    }, 1400);
  };

  const quickChips = [
    '행사지원 신청서 초안 작성해줘',
    '이번 주 내 업무 요약',
    '다음 달 반복 일정 알려줘',
    '2024 결산 보고서 요약',
  ];

  return (
    <div className="fadein" style={{maxWidth: 1360, margin:'0 auto', padding:'28px 40px 64px'}}>
      {/* Greeting */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <div className="mono text-[11px] uppercase tracking-[0.18em] mb-1" style={{color:'var(--ink-4)'}}>
            {fmtDate(TODAY)} · 월요일
          </div>
          <h1 className="text-[28px] font-bold tracking-tight" style={{letterSpacing:'-0.025em'}}>
            안녕하세요, <span style={{color:'var(--primary-700)'}}>{me.name}</span>님
          </h1>
          <p className="text-[13.5px] mt-1" style={{color:'var(--ink-3)'}}>
            오늘 진행 중 업무 {myTasks.filter(t=>t.col==='doing').length}건, 결재 대기 {pendingApprovals}건이 있습니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Btn variant="outline" icon="calendar" onClick={()=>go('calendar')}>캘린더</Btn>
          <Btn variant="outline" icon="inbox" onClick={()=>go('mail')}>메일함</Btn>
          <Btn variant="primary" icon="plus" onClick={()=>go('ai_docs')}>새 문서</Btn>
        </div>
      </div>

      {/* AI command bar */}
      <Card pad={false} style={{ padding:0, overflow:'hidden', borderColor:'var(--accent-100)', background:'linear-gradient(180deg, var(--accent-50) 0%, #fff 60%)' }}>
        <div className="px-6 pt-5 pb-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{background:'var(--accent-100)'}}>
            <Icon name="sparkles" size={16} style={{color:'oklch(0.45 0.14 75)'}} />
          </div>
          <div>
            <div className="font-bold text-[15px] tracking-tight">ANG 비서</div>
            <div className="mono text-[10.5px] uppercase tracking-[0.14em]" style={{color:'oklch(0.48 0.10 75)'}}>
              Local LLM · Ollama 3 · 조직 문서 {DOCS.length}건 학습됨
            </div>
          </div>
        </div>
        <div className="px-6 pb-5">
          <div className="flex items-center gap-3 rounded-xl p-1.5"
            style={{background:'#fff', border:'1px solid var(--line)'}}>
            <input
              value={prompt}
              onChange={e=>setPrompt(e.target.value)}
              onKeyDown={e => e.key==='Enter' && runAI()}
              placeholder="무엇을 도와드릴까요? (예: 5월 평생교육 페스티벌 행사지원 신청서 초안 작성)"
              className="flex-1 bg-transparent outline-none px-3 py-2.5"
              style={{fontSize:14}}
            />
            <Btn variant="teal" icon={running ? 'loader' : 'arrow-right'} onClick={runAI} disabled={running || !prompt.trim()}>
              {running ? '생성 중' : '실행'}
            </Btn>
          </div>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {quickChips.map((c,i)=> (
              <button key={i} onClick={()=> { setPrompt(c); }}
                className="mono text-[11px] font-medium px-2.5 py-1 rounded-md hover:bg-white"
                style={{color:'oklch(0.45 0.10 75)', border:'1px solid oklch(0.88 0.05 75)'}}
              >{c}</button>
            ))}
          </div>
          {running && (
            <div className="mt-4 flex items-center gap-2 mono text-[11.5px]" style={{color:'var(--ink-3)'}}>
              <span className="pulse-dot">●</span>
              조직 문서 벡터 검색 중 · ChromaDB 쿼리...
            </div>
          )}
          {result && (
            <div className="mt-4 p-4 rounded-lg flex items-start gap-3 slide-up" style={{background:'#fff', border:'1px solid var(--line)'}}>
              <Icon name="check-circle-2" size={18} style={{color:'var(--good)'}} />
              <div className="flex-1">
                <div className="text-[13.5px] font-medium">{result.suggest}</div>
                <div className="mt-2 flex items-center gap-2">
                  <Btn size="sm" variant="primary" icon="arrow-right" onClick={()=>go(result.next)}>문서 편집으로 이동</Btn>
                  <Btn size="sm" variant="ghost" onClick={()=>setResult(null)}>닫기</Btn>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Three-col layout */}
      <div className="grid gap-5 mt-5" style={{gridTemplateColumns:'1.4fr 1fr 0.9fr'}}>
        {/* Today column */}
        <Card>
          <SectionLabel right={<span className="link mono text-[11px]" onClick={()=>go('calendar')}>전체 →</span>}>
            오늘 · Today
          </SectionLabel>
          <div className="space-y-2">
            {todays.length === 0 && <Empty icon="calendar" title="오늘 일정이 없습니다" sub="여유로운 하루예요." />}
            {todays.map(e => (
              <div key={e.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[--line-2]"
                style={{background:'#FBFBF7', border:'1px solid var(--line-2)'}}>
                <div style={{width:3, height:34, background: e.color, borderRadius:2}} />
                <div className="mono text-[12px] font-semibold" style={{color:'var(--ink-2)', minWidth:46}}>{e.time}</div>
                <div className="flex-1 text-[13.5px] font-medium">{e.title}</div>
                {e.ai && <AIBadge inline />}
                {e.shared && <Pill tone="primary">공유</Pill>}
              </div>
            ))}
          </div>
          <div className="mt-5 pt-5" style={{borderTop:'1px solid var(--line-2)'}}>
            <SectionLabel>내 업무 · Kanban 미리보기</SectionLabel>
            <div className="grid grid-cols-3 gap-2">
              {[['todo','대기'],['doing','진행중'],['done','완료']].map(([k,label]) => {
                const n = myTasks.filter(t=>t.col===k).length;
                const tone = k==='doing'?'primary':k==='done'?'good':'neutral';
                return (
                  <div key={k} className="rounded-lg p-3" style={{background:'#FBFBF7', border:'1px solid var(--line-2)'}}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="mono text-[10.5px] uppercase tracking-[0.12em]" style={{color:'var(--ink-3)'}}>{label}</span>
                      <Pill tone={tone}>{n}</Pill>
                    </div>
                    <div className="space-y-1.5">
                      {myTasks.filter(t=>t.col===k).slice(0,3).map(t=>(
                        <div key={t.id} className="text-[12px] truncate" style={{color:'var(--ink-2)'}}>· {t.title}</div>
                      ))}
                      {myTasks.filter(t=>t.col===k).length===0 && <div className="text-[11.5px] italic" style={{color:'var(--ink-4)'}}>—</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        {/* Middle — approvals + notices */}
        <div className="space-y-5">
          <Card>
            <SectionLabel right={<span className="link mono text-[11px]" onClick={()=>go('approval')}>전체 →</span>}>
              결재 · {pendingApprovals}건 대기
            </SectionLabel>
            <div className="space-y-2">
              {APPROVALS.slice(0,3).map(a => (
                <div key={a.id} className="p-3 rounded-lg" style={{border:'1px solid var(--line-2)', background:'#FBFBF7'}}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="text-[13px] font-medium leading-tight">{a.title}</div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Avatar user={userById(a.requester)} size={16} />
                        <span className="mono text-[10.5px]" style={{color:'var(--ink-3)'}}>
                          {userById(a.requester).name} · {a.created}
                        </span>
                      </div>
                    </div>
                    <Pill tone={a.status==='pending'?'warn':a.status==='approved'?'good':'danger'}>
                      {a.status==='pending'?'대기':a.status==='approved'?'승인':'반려'}
                    </Pill>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <SectionLabel right={<span className="link mono text-[11px]" onClick={()=>go('boards')}>전체 →</span>}>
              공지사항
            </SectionLabel>
            <div className="space-y-2.5">
              {BOARDS.notice.slice(0,4).map(n => (
                <div key={n.id} className="flex items-start gap-2 py-1 cursor-pointer" onClick={()=>go('boards')}>
                  {n.pinned && <Icon name="pin" size={11} style={{color:'var(--danger)', marginTop:4}} />}
                  <div className="flex-1">
                    <div className="text-[13px] truncate" style={{color:'var(--ink)', fontWeight: n.pinned ? 600 : 500}}>{n.title}</div>
                    <div className="mono text-[10.5px] mt-0.5" style={{color:'var(--ink-4)'}}>
                      {userById(n.author).name} · {n.date}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right — Org Memory (the differentiator) */}
        <Card style={{background:'linear-gradient(180deg, var(--primary-50) 0%, #fff 45%)'}}>
          <div className="flex items-center gap-2 mb-3">
            <Icon name="layers" size={14} style={{color:'var(--primary-700)'}} />
            <span className="mono text-[11px] font-semibold uppercase tracking-[0.14em]" style={{color:'var(--primary-700)'}}>
              Organization Memory
            </span>
          </div>
          <div className="text-[13px] leading-relaxed mb-4" style={{color:'var(--ink-2)'}}>
            지금 하시는 일과 <span style={{fontWeight:600}}>관련된 과거 흐름</span>입니다.
          </div>
          <div className="space-y-3">
            <div className="p-3 rounded-lg" style={{background:'#fff', border:'1px solid var(--line)'}}>
              <div className="flex items-center gap-2 mb-1.5">
                <Icon name="repeat" size={12} style={{color:'var(--primary-700)'}} />
                <span className="mono text-[10.5px] uppercase tracking-[0.12em]" style={{color:'var(--primary-700)'}}>반복 업무 감지</span>
              </div>
              <div className="text-[12.5px]" style={{color:'var(--ink)'}}>
                <span style={{fontWeight:600}}>결산 보고서</span>가 매년 11월 초에 제출되고 있습니다.
              </div>
              <div className="mono text-[10.5px] mt-1.5" style={{color:'var(--ink-4)'}}>
                2022 · 2023 · 2024 패턴 일치
              </div>
              <Btn size="sm" variant="ai" icon="calendar-plus" className="mt-2" onClick={()=>go('calendar')}>
                10/28 착수 알림 추가
              </Btn>
            </div>

            <div className="p-3 rounded-lg" style={{background:'#fff', border:'1px solid var(--line)'}}>
              <div className="flex items-center gap-2 mb-1.5">
                <Icon name="file-search" size={12} style={{color:'var(--primary-700)'}} />
                <span className="mono text-[10.5px] uppercase tracking-[0.12em]" style={{color:'var(--primary-700)'}}>관련 과거 문서</span>
              </div>
              {DOCS.slice(0,3).map(doc => (
                <div key={doc.id} className="flex items-center gap-2 py-1.5 cursor-pointer" onClick={()=>go('ai_docs')}>
                  <FileTypeIcon ext={doc.ext} size={14} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] truncate">{doc.title}</div>
                    <div className="mono text-[10px]" style={{color:'var(--ink-4)'}}>
                      {userById(doc.author).name} · {doc.updated}
                    </div>
                  </div>
                  <span className="mono text-[10px] font-semibold" style={{color:'var(--primary-700)'}}>
                    {Math.round(doc.score * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

window.Dashboard = Dashboard;
