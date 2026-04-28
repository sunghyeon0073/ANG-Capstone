// Files — personal / shared, OCR upload
function Files({ me, go }) {
  const [tab, setTab] = useState('shared');
  const [ocrOpen, setOcrOpen] = useState(false);
  const [ocrStep, setOcrStep] = useState(0);

  const files = tab === 'shared'
    ? DOCS
    : DOCS.filter(d => d.author === 'u_me' || d.id === 'doc_8');

  const runOCR = () => {
    setOcrStep(1);
    setTimeout(()=>setOcrStep(2), 900);
    setTimeout(()=>setOcrStep(3), 2000);
  };

  return (
    <div className="fadein" style={{maxWidth: 1360, margin:'0 auto', padding:'28px 40px 64px'}}>
      <div className="flex items-end justify-between mb-5">
        <div>
          <div className="mono text-[11px] uppercase tracking-[0.18em] mb-1" style={{color:'var(--ink-4)'}}>File-01 · Archive</div>
          <h1 className="text-[24px] font-bold tracking-tight">파일함</h1>
        </div>
        <div className="flex gap-2">
          <Btn variant="outline" icon="scan-text" onClick={()=>{setOcrOpen(true); setOcrStep(0);}}>OCR 변환</Btn>
          <Btn variant="outline" icon="download">내보내기</Btn>
          <Btn variant="primary" icon="upload">파일 업로드</Btn>
        </div>
      </div>

      <Card pad={false}>
        <div className="flex items-center justify-between px-5 pt-4">
          <div className="flex gap-1">
            {[['shared','부서 공유 파일함', 'folder-open'], ['personal','개인 파일함','user']].map(([k,l,ic])=>(
              <button key={k} onClick={()=>setTab(k)}
                className="flex items-center gap-2 px-3 py-2 rounded-md text-[12.5px] font-semibold"
                style={{
                  background: tab===k ? 'var(--ink)' : 'transparent',
                  color: tab===k ? '#fff' : 'var(--ink-3)',
                }}>
                <Icon name={ic} size={13} />{l}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Input icon="search" placeholder="파일 검색" style={{width:220}} />
            <select className="text-[12px] outline-none" style={{padding:'7px 10px', border:'1px solid var(--line)', borderRadius:8, background:'#fff'}}>
              <option>최근 순</option><option>이름 순</option><option>크기 순</option>
            </select>
          </div>
        </div>
        <div className="px-5 pt-3 pb-4 mono text-[11px]" style={{color:'var(--ink-3)'}}>
          {files.length}개 항목 · {tab==='shared' ? '같은 부서 전원 접근 가능' : '본인만 접근 가능'}
        </div>
        <div style={{borderTop:'1px solid var(--line-2)'}}>
          <div className="grid px-5 py-2.5 mono text-[10.5px] uppercase tracking-wider" style={{
            gridTemplateColumns:'40px 1fr 120px 100px 120px 80px 40px',
            color:'var(--ink-3)', borderBottom:'1px solid var(--line-2)', background:'#FBFBF7'
          }}>
            <div></div><div>이름</div><div>유형</div><div>작성자</div><div>수정일</div><div className="text-right">크기</div><div></div>
          </div>
          {files.map(f => (
            <div key={f.id} className="grid items-center px-5 py-3 hover:bg-[--line-2] cursor-pointer" style={{
              gridTemplateColumns:'40px 1fr 120px 100px 120px 80px 40px',
              borderBottom:'1px solid var(--line-2)'
            }}>
              <FileTypeIcon ext={f.ext} size={18} />
              <div>
                <div className="text-[13.5px] font-medium truncate">{f.title}</div>
                <div className="flex gap-1 mt-1">{f.tags.map(t=><Pill key={t}>{t}</Pill>)}</div>
              </div>
              <Pill tone="primary">{f.type}</Pill>
              <div className="flex items-center gap-1.5">
                <Avatar user={userById(f.author)} size={18} />
                <span className="text-[12px]">{userById(f.author).name}</span>
              </div>
              <div className="mono text-[11.5px]" style={{color:'var(--ink-3)'}}>{f.updated}</div>
              <div className="mono text-[11.5px] text-right" style={{color:'var(--ink-3)'}}>{f.size}</div>
              <button style={{color:'var(--ink-4)'}}><Icon name="more-horizontal" size={16}/></button>
            </div>
          ))}
        </div>
      </Card>

      <Modal open={ocrOpen} onClose={()=>setOcrOpen(false)} title="OCR 변환" width={640}>
        <div className="p-6">
          {ocrStep===0 && (
            <div>
              <div className="text-[13.5px] leading-relaxed mb-4" style={{color:'var(--ink-2)'}}>
                스캔 문서나 수기 신청서를 업로드하세요. 로컬 AI가 자동으로 텍스트를 추출합니다.
              </div>
              <div className="rounded-xl flex flex-col items-center justify-center py-12"
                style={{border:'2px dashed var(--line)', background:'#FBFBF7'}}>
                <Icon name="image-plus" size={32} style={{color:'var(--ink-4)'}} />
                <div className="mt-3 text-[13px] font-medium">PDF, PNG, JPG 파일을 끌어놓으세요</div>
                <Btn variant="outline" icon="upload" className="mt-4" onClick={runOCR}>파일 선택</Btn>
              </div>
            </div>
          )}
          {ocrStep>0 && (
            <div className="slide-up">
              <div className="flex items-center gap-3 mb-4 p-3 rounded-lg" style={{background:'#FBFBF7', border:'1px solid var(--line-2)'}}>
                <FileTypeIcon ext="png" size={22} />
                <div className="flex-1">
                  <div className="text-[13px] font-medium">수기_출석부_04월.png</div>
                  <div className="mono text-[11px]" style={{color:'var(--ink-3)'}}>2.4 MB · 업로드 완료</div>
                </div>
                {ocrStep===3 && <Pill tone="good">완료</Pill>}
              </div>
              <div className="mono text-[11px] space-y-1 mb-4" style={{color:'var(--ink-3)'}}>
                <div>{ocrStep>=1?'✓':'●'} 이미지 전처리 · 이진화 및 노이즈 제거</div>
                <div>{ocrStep>=2?'✓':'●'} Tesseract OCR 텍스트 추출</div>
                <div>{ocrStep>=3?'✓':'●'} 구조 분석 및 표 복원</div>
              </div>
              {ocrStep===3 && (
                <div className="p-4 rounded-lg" style={{background:'#fff', border:'1px solid var(--line)'}}>
                  <div className="mono text-[10.5px] uppercase tracking-wider mb-2" style={{color:'var(--ink-3)'}}>추출된 텍스트 (검토 후 저장)</div>
                  <div className="text-[12.5px] leading-relaxed space-y-1" style={{color:'var(--ink)'}}>
                    <div>[학사운영팀 출석부 - 2026년 4월]</div>
                    <div>이상열 · 출근 09:02 / 퇴근 18:11</div>
                    <div>김명자 · 출근 08:55 / 퇴근 18:20</div>
                    <div>박서진 · 출근 09:10 / 퇴근 18:05</div>
                  </div>
                </div>
              )}
              <div className="flex gap-2 mt-5">
                <Btn variant="ghost" onClick={()=>setOcrOpen(false)}>취소</Btn>
                <div className="flex-1" />
                {ocrStep<3 && <Btn variant="outline" disabled icon="loader">처리 중...</Btn>}
                {ocrStep===3 && <><Btn variant="outline" icon="edit-3">수정</Btn><Btn variant="primary" icon="save">저장</Btn></>}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

window.Files = Files;
