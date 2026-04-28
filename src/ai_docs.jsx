// AI Documents — the killer feature: search → find similar past docs → preview → generate draft
function AIDocs({ me, go }) {
  const [step, setStep] = useState(1); // 1 search, 2 picked, 3 drafting, 4 draft ready
  const [query, setQuery] = useState('2026년 상반기 행사지원 신청서');
  const [docType, setDocType] = useState('신청서');
  const [selected, setSelected] = useState(null);
  const [generating, setGenerating] = useState(false);

  const matches = useMemo(() => {
    if (!query.trim()) return [];
    return DOCS
      .map(d => ({ ...d, score: d.title.toLowerCase().includes('행사지원') ? Math.min(1, d.score + 0.05) : d.score * 0.6 }))
      .sort((a,b) => b.score - a.score);
  }, [query]);

  const generate = () => {
    setGenerating(true);
    setStep(3);
    setTimeout(() => { setGenerating(false); setStep(4); }, 1800);
  };

  return (
    <div className="fadein" style={{maxWidth: 1360, margin:'0 auto', padding:'28px 40px 64px'}}>
      <div className="flex items-end justify-between mb-5">
        <div>
          <div className="mono text-[11px] uppercase tracking-[0.18em] mb-1" style={{color:'var(--ink-4)'}}>AI-01 · Document Assistant</div>
          <h1 className="text-[24px] font-bold tracking-tight" style={{letterSpacing:'-0.02em'}}>AI 문서 작성</h1>
          <p className="text-[13px] mt-1" style={{color:'var(--ink-3)'}}>과거 조직 문서를 재활용해 새 문서 초안을 만듭니다.</p>
        </div>
        <div className="flex items-center gap-1 mono text-[11px]" style={{color:'var(--ink-3)'}}>
          {['검색','선택','생성','편집'].map((s,i)=>(
            <React.Fragment key={i}>
              <span className={`px-2 py-1 rounded-md ${step>=i+1 ? '' : 'opacity-40'}`}
                style={{background: step===i+1 ? 'var(--primary-50)' : 'transparent', color: step===i+1 ? 'var(--primary-700)':'var(--ink-3)', fontWeight: step===i+1?600:500}}>
                {String(i+1).padStart(2,'0')} {s}
              </span>
              {i<3 && <span style={{color:'var(--ink-4)'}}>—</span>}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="grid gap-5" style={{gridTemplateColumns: step===4 ? '1fr 340px' : '1fr 380px'}}>
        {/* Left: main work area */}
        <div>
          {step <= 2 && (
            <Card>
              <SectionLabel>문서 정보 입력</SectionLabel>
              <div className="grid grid-cols-[160px_1fr] gap-4 items-center mb-3">
                <label className="mono text-[11px] uppercase tracking-wider" style={{color:'var(--ink-3)'}}>문서 유형</label>
                <div className="flex gap-1">
                  {['신청서','보고서','공문','계획안','품의서'].map(t=>(
                    <button key={t} onClick={()=>setDocType(t)}
                      className="px-3 py-1.5 rounded-md text-[12px] font-medium transition"
                      style={{
                        background: docType===t ? 'var(--ink)' : '#fff',
                        color: docType===t ? '#fff' : 'var(--ink-2)',
                        border: '1px solid ' + (docType===t ? 'var(--ink)' : 'var(--line)')
                      }}
                    >{t}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-[160px_1fr] gap-4 items-center">
                <label className="mono text-[11px] uppercase tracking-wider" style={{color:'var(--ink-3)'}}>문서 제목</label>
                <Input icon="search" value={query} onChange={setQuery} placeholder="새 문서의 제목을 입력하세요" />
              </div>

              <div className="mt-6 pt-5" style={{borderTop:'1px dashed var(--line)'}}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Icon name="sparkles" size={14} style={{color:'oklch(0.50 0.13 75)'}} />
                    <span className="mono text-[11px] font-semibold uppercase tracking-[0.14em]" style={{color:'oklch(0.45 0.13 75)'}}>
                      RAG 유사 문서 자동 검색
                    </span>
                  </div>
                  <span className="mono text-[11px]" style={{color:'var(--ink-3)'}}>{matches.length}건 발견</span>
                </div>
                <div className="space-y-2">
                  {matches.slice(0,6).map(doc => {
                    const picked = selected?.id === doc.id;
                    return (
                      <div key={doc.id} onClick={()=>{setSelected(doc); setStep(2);}}
                        className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition"
                        style={{
                          background: picked ? 'var(--primary-50)' : '#FBFBF7',
                          border: '1px solid ' + (picked ? 'var(--primary)' : 'var(--line-2)')
                        }}
                      >
                        <FileTypeIcon ext={doc.ext} size={18} />
                        <div className="flex-1 min-w-0">
                          <div className="text-[13.5px] font-medium truncate">{doc.title}</div>
                          <div className="flex items-center gap-2 mt-0.5 mono text-[10.5px]" style={{color:'var(--ink-3)'}}>
                            <span>{userById(doc.author).name}</span>
                            <span>·</span>
                            <span>{doc.updated}</span>
                            <span>·</span>
                            <span>{doc.size}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {doc.tags.slice(0,2).map(t => <Pill key={t}>{t}</Pill>)}
                          <div className="flex items-center gap-1 mono text-[11px] font-semibold" style={{color: doc.score > 0.7 ? 'var(--good)' : 'var(--ink-3)'}}>
                            <Icon name="activity" size={11} />
                            {Math.round(doc.score*100)}%
                          </div>
                          {picked ? <Icon name="check-circle-2" size={18} style={{color:'var(--primary)'}} /> :
                            <Icon name="chevron-right" size={16} style={{color:'var(--ink-4)'}} />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {selected && (
                <div className="mt-6 p-4 rounded-lg slide-up" style={{background:'var(--primary-50)', border:'1px solid var(--primary-100)'}}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="mono text-[11px] uppercase tracking-wider mb-1" style={{color:'var(--primary-700)'}}>선택한 기준 문서</div>
                      <div className="text-[14px] font-semibold">{selected.title}</div>
                      <div className="mono text-[11px] mt-1" style={{color:'var(--ink-3)'}}>
                        이 문서를 기반으로 날짜·담당자만 수정해 초안이 생성됩니다.
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Btn variant="outline" icon="eye">미리보기</Btn>
                      <Btn variant="teal" icon="sparkles" onClick={generate}>AI 초안 생성</Btn>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          )}

          {step === 3 && (
            <Card style={{minHeight: 420}}>
              <div className="flex flex-col items-center justify-center h-full py-16">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-5" style={{background:'var(--accent-100)'}}>
                  <Icon name="sparkles" size={22} style={{color:'oklch(0.45 0.14 75)'}} />
                </div>
                <div className="font-bold text-[16px] mb-2">AI가 초안을 작성하고 있습니다</div>
                <div className="mono text-[11.5px] space-y-1 text-center" style={{color:'var(--ink-3)'}}>
                  <div>✓ 기준 문서 로드: {selected?.title}</div>
                  <div>✓ 벡터 검색 · ChromaDB 쿼리 완료</div>
                  <div className="pulse-dot">● 로컬 LLM 초안 생성 중...</div>
                </div>
                <div className="mt-6 w-64 h-1.5 rounded-full overflow-hidden" style={{background:'var(--line-2)'}}>
                  <div className="h-full shimmer" style={{width:'65%'}} />
                </div>
              </div>
            </Card>
          )}

          {step === 4 && (
            <Card>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Pill tone="accent"><Icon name="sparkle" size={10} /> AI 초안</Pill>
                  <span className="text-[13px]" style={{color:'var(--ink-3)'}}>검토 후 저장하세요.</span>
                </div>
                <div className="flex gap-2">
                  <Btn variant="ghost" icon="refresh-cw" size="sm" onClick={generate}>재생성</Btn>
                  <Btn variant="outline" icon="download" size="sm">내보내기</Btn>
                  <Btn variant="primary" icon="save" size="sm">저장</Btn>
                </div>
              </div>
              <div className="rounded-lg p-6" style={{background:'#fff', border:'1px solid var(--line)', minHeight: 420}}>
                <input defaultValue="2026년 상반기 평생교육원 행사지원 신청서"
                  className="w-full text-[22px] font-bold tracking-tight outline-none mb-1"
                  style={{letterSpacing:'-0.02em'}} />
                <div className="mono text-[10.5px] uppercase tracking-wider mb-4" style={{color:'var(--ink-4)'}}>
                  작성자 {me.name} · {fmtDate(TODAY)} · 기준: {selected?.title}
                </div>
                <div className="space-y-3 text-[13.5px] leading-relaxed" style={{color:'var(--ink-2)'}}>
                  <div>
                    <span className="mono text-[11px] uppercase tracking-wider block mb-1" style={{color:'var(--ink-3)'}}>1. 행사 개요</span>
                    <div contentEditable suppressContentEditableWarning className="outline-none p-2 -mx-2 rounded" style={{}}>
                      2026년 상반기 평생교육원에서 수강생 및 지역주민 대상 교육 페스티벌을 개최하고자 하며,
                      이에 필요한 운영 지원금을 신청합니다.
                    </div>
                  </div>
                  <div>
                    <span className="mono text-[11px] uppercase tracking-wider block mb-1" style={{color:'var(--ink-3)'}}>2. 개최 일시 및 장소</span>
                    <div contentEditable suppressContentEditableWarning className="outline-none p-2 -mx-2 rounded">
                      2026년 5월 25일(월) 10:00 – 17:00 / 본원 1층 강당 및 202호
                    </div>
                  </div>
                  <div>
                    <span className="mono text-[11px] uppercase tracking-wider block mb-1" style={{color:'var(--ink-3)'}}>3. 예산 편성 (원)</span>
                    <table className="w-full text-[12.5px]" style={{borderCollapse:'collapse'}}>
                      <thead>
                        <tr style={{background:'#FBFBF7'}}>
                          <th className="text-left p-2 mono text-[11px]" style={{border:'1px solid var(--line)', color:'var(--ink-3)'}}>항목</th>
                          <th className="text-right p-2 mono text-[11px]" style={{border:'1px solid var(--line)', color:'var(--ink-3)'}}>금액</th>
                          <th className="text-left p-2 mono text-[11px]" style={{border:'1px solid var(--line)', color:'var(--ink-3)'}}>비고</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[['강사료','1,800,000','외부 3인'],['운영물품','1,200,000','배너·다과'],['홍보비','700,000','포스터 제작'],['예비비','500,000','—']].map((r,i)=>(
                          <tr key={i}><td className="p-2" style={{border:'1px solid var(--line)'}}>{r[0]}</td><td className="p-2 mono text-right" style={{border:'1px solid var(--line)'}}>{r[1]}</td><td className="p-2" style={{border:'1px solid var(--line)'}}>{r[2]}</td></tr>
                        ))}
                        <tr style={{background:'var(--primary-50)'}}>
                          <td className="p-2 font-bold" style={{border:'1px solid var(--primary-100)'}}>합계</td>
                          <td className="p-2 mono text-right font-bold" style={{border:'1px solid var(--primary-100)'}}>4,200,000</td>
                          <td className="p-2" style={{border:'1px solid var(--primary-100)'}}>—</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="mt-5 pt-4" style={{borderTop:'1px dashed var(--line)'}}>
                  <AIBadge source={`${selected?.title} · ${userById(selected?.author||'u_kim').name} 작성`} />
                  <span className="ml-2 mono text-[10.5px]" style={{color:'var(--ink-4)'}}>
                    ※ AI 생성 콘텐츠 — 검토 후 저장하세요
                  </span>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          <Card>
            <SectionLabel>진행 단계</SectionLabel>
            <ol className="space-y-3">
              {[
                { n:1, t:'제목 입력 및 유사 문서 검색' },
                { n:2, t:'기준 문서 선택 (과거 자료)' },
                { n:3, t:'AI 초안 생성 (RAG + LLM)' },
                { n:4, t:'검토 및 저장 · 전자결재 상신' },
              ].map(s => {
                const done = step > s.n;
                const curr = step === s.n;
                return (
                  <li key={s.n} className="flex items-start gap-3">
                    <div className="mono font-bold text-[10px] rounded-full flex items-center justify-center"
                      style={{
                        width:22, height:22,
                        background: done ? 'var(--ink)' : curr ? 'var(--primary)' : '#F3F3EE',
                        color: (done||curr) ? '#fff' : 'var(--ink-3)'
                      }}>
                      {done ? '✓' : s.n}
                    </div>
                    <div className="pt-0.5">
                      <div className="text-[12.5px] font-medium">{s.t}</div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>

          <Card style={{background:'linear-gradient(180deg, var(--primary-50) 0%, #fff 60%)'}}>
            <div className="flex items-center gap-2 mb-3">
              <Icon name="shield-check" size={14} style={{color:'var(--primary-700)'}} />
              <span className="mono text-[10.5px] font-semibold uppercase tracking-[0.14em]" style={{color:'var(--primary-700)'}}>
                Local-Only · 외부 전송 없음
              </span>
            </div>
            <div className="text-[12.5px] leading-relaxed" style={{color:'var(--ink-2)'}}>
              모든 문서 검색 및 생성은 <b>조직 내부 로컬 서버(Ollama)</b>에서 처리됩니다.
              외부 API에 데이터가 전송되지 않습니다.
            </div>
          </Card>

          {step===4 && (
            <Card>
              <SectionLabel>다음 단계</SectionLabel>
              <div className="space-y-2">
                <Btn variant="outline" icon="send" className="w-full justify-start">차무식 팀장에게 결재 상신</Btn>
                <Btn variant="outline" icon="users" className="w-full justify-start">학사운영팀 공유</Btn>
                <Btn variant="ghost" icon="copy" className="w-full justify-start">양식으로 저장</Btn>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

window.AIDocs = AIDocs;
