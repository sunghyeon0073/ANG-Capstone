import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { USERS, DEPTS, DOCS, TASKS, APPROVALS, BOARDS, CHATS, CHAT_MESSAGES, MAILS, NOTIFICATIONS, TODAY, EVENTS, userById, fmtDate, d } from '../data';
import { Icon, Avatar, Pill, Btn, Card, SectionLabel, Input, AIBadge, Modal, Empty, FileTypeIcon, DocPreviewModal, DocPreviewContent } from '../ui';
import { askAI } from '../api';

// 문서작성 — 3패널: [앱 사이드바 sub-nav] | [문서 목록] | [에디터/뷰어]

// ── 문서 목록 패널 ──────────────────────────────────────────────────────────
function DocListPanel({ docs, selectedDoc, onSelect, onPreview, searchQ, onSearch, filter, onFilter }) {
  const types = ['all', '신청서', '보고서', '계획안', '공문', '양식'];
  return (
    <div style={{ width: 272, borderRight: '1.5px solid var(--line-2)', display: 'flex', flexDirection: 'column', background: '#fff', flexShrink: 0, overflow: 'hidden' }}>
      {/* 헤더 */}
      <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid var(--line-2)', flexShrink: 0 }}>
        <div style={{ fontSize: 10.5, fontWeight: 900, color: 'var(--ink-4)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 8 }}>
          문서 목록 · {docs.length}건
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', background: 'var(--line-3)', border: '1.5px solid var(--line-2)', borderRadius: 10 }}>
          <Icon name="search" size={13} style={{ color: 'var(--ink-4)', flexShrink: 0 }} />
          <input
            value={searchQ} onChange={e => onSearch(e.target.value)}
            placeholder="문서 검색..."
            style={{ flex: 1, outline: 'none', background: 'transparent', fontSize: 12.5, color: 'var(--ink)', fontWeight: 500 }}
          />
          {searchQ && (
            <button onClick={() => onSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-4)', padding: 0 }}>
              <Icon name="x" size={12} />
            </button>
          )}
        </div>
        {/* 유형 필터 */}
        <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
          {types.map(f => (
            <button key={f} onClick={() => onFilter(f)}
              style={{
                padding: '2px 7px', fontSize: 11, borderRadius: 5, fontWeight: 700,
                border: 'none', cursor: 'pointer', transition: 'all .12s',
                background: filter === f ? 'var(--primary)' : 'var(--line-2)',
                color: filter === f ? '#fff' : 'var(--ink-3)',
              }}>
              {f === 'all' ? '전체' : f}
            </button>
          ))}
        </div>
      </div>

      {/* 목록 */}
      <div style={{ flex: 1, overflowY: 'auto' }} className="col-scroll">
        {docs.length === 0 && (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
            <Icon name="search" size={24} style={{ display: 'block', margin: '0 auto 8px', color: 'var(--line)' }} />
            검색 결과 없음
          </div>
        )}
        {docs.map(doc => {
          const isSel = selectedDoc?.id === doc.id;
          return (
            <div key={doc.id}
              onClick={() => onSelect(doc)}
              style={{
                padding: '10px 14px', borderBottom: '1px solid var(--line-2)',
                cursor: 'pointer',
                background: isSel ? 'var(--primary-50)' : 'transparent',
                borderLeft: `3px solid ${isSel ? 'var(--primary)' : 'transparent'}`,
              }}
              onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = '#F7F7F2'; }}
              onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent'; }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <FileTypeIcon ext={doc.ext} size={16} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3 }} className="truncate">{doc.title}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--ink-4)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ display: 'inline-block', padding: '1px 5px', borderRadius: 4, fontSize: 10, background: 'var(--primary-100)', color: 'var(--primary-700)', fontWeight: 700 }}>{doc.type}</span>
                    {doc.updated}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 5, flexWrap: 'wrap' }}>
                {doc.tags.slice(0, 2).map(t => (
                  <span key={t} style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: 'var(--line-2)', color: 'var(--ink-3)', fontWeight: 600 }}>{t}</span>
                ))}
                <button onClick={e => { e.stopPropagation(); onPreview(doc); }}
                  style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--ink-4)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 5px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 3 }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--primary)'; e.currentTarget.style.background = 'var(--primary-50)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--ink-4)'; e.currentTarget.style.background = 'transparent'; }}>
                  <Icon name="eye" size={11} /> 보기
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 하단 */}
      <div style={{ padding: '10px 14px', borderTop: '1px solid var(--line-2)', flexShrink: 0, background: '#FAFAF7' }}>
        <div style={{ fontSize: 10.5, color: 'var(--ink-4)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Icon name="database" size={11} />
          <span>조직 문서 {DOCS.length}건 · RAG 인덱스됨</span>
        </div>
      </div>
    </div>
  );
}

// ── AI 문서작성 영역 ─────────────────────────────────────────────────────────
function AIDocArea({ me, go, baseDoc, onSelectDoc }) {
  const [step,      setStep]      = useState(baseDoc ? 2 : 1);
  const [selected,  setSelected]  = useState(baseDoc || null);
  const [query,     setQuery]     = useState('2026년 상반기 행사지원 신청서');
  const [docType,   setDocType]   = useState('신청서');
  const [toast,     setToast]     = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [aiAnswer,  setAiAnswer]  = useState('');

  const showMsg = (m) => { setToast(m); setTimeout(() => setToast(null), 2200); };

  // 외부에서 baseDoc이 바뀌면 자동 선택
  useEffect(() => {
    if (baseDoc) { setSelected(baseDoc); setStep(2); }
  }, [baseDoc?.id]);

  const generate = async () => {
    setStep(3);

    const prompt = [
      '다음 조건에 맞춰 업무용 문서 초안을 한국어로 작성해줘.',
      `문서 종류: ${docType}`,
      `문서 제목: ${query}`,
      selected ? `참고 문서 제목: ${selected.title}` : '',
      selected ? `참고 문서 유형: ${selected.type}` : '',
      '제목, 개요, 세부 내용, 예산 또는 추진 일정, 기대 효과가 보이도록 작성해줘.',
      '실제 문서에 바로 붙여넣을 수 있게 본문 중심으로 작성해줘.',
    ].filter(Boolean).join('\n');

    try {
      const answer = await askAI(prompt);
      setAiAnswer(answer || 'AI가 빈 응답을 반환했습니다.');
      setStep(4);
    } catch (err) {
      console.error(err);
      showMsg('AI 생성 중 오류가 발생했습니다.');
      setStep(selected ? 2 : 1);
    }
  };

  const reset = () => {
    setStep(1); setSelected(null);
    setQuery('2026년 상반기 행사지원 신청서');
    setDocType('신청서');
    setAiAnswer('');
    if (onSelectDoc) onSelectDoc(null);
  };

  return (
    <div style={{ padding: '24px 32px 48px', maxWidth: 860 }}>
      {toast && (
        <div style={{
          position:'fixed', bottom:28, left:'50%', transform:'translateX(-50%)',
          background:'var(--ink)', color:'#fff', padding:'10px 22px', borderRadius:12,
          fontSize:13, fontWeight:600, zIndex:9999, boxShadow:'0 4px 20px rgba(0,0,0,0.18)',
          pointerEvents:'none',
        }}>{toast}</div>
      )}
      {/* 내보내기 선택 모달 */}
      {exportOpen && (
        <div style={{
          position:'fixed', inset:0, zIndex:9998, display:'flex', alignItems:'center', justifyContent:'center',
          background:'rgba(0,0,0,0.35)',
        }} onClick={() => setExportOpen(false)}>
          <div style={{background:'#fff', borderRadius:16, padding:'24px', width:320, boxShadow:'0 8px 40px rgba(0,0,0,0.18)'}}
            onClick={e => e.stopPropagation()}>
            <div style={{fontSize:15, fontWeight:800, marginBottom:16}}>내보내기 형식 선택</div>
            {[['file-text','HWP 문서 (.hwp)'],['file-type','Word 문서 (.docx)'],['file-type-2','PDF 문서 (.pdf)'],['file-code','텍스트 (.txt)']].map(([ic,l]) => (
              <button key={l}
                onClick={() => { setExportOpen(false); showMsg(`${l.split(' ')[0]} 형식으로 내보내기 준비 중입니다.`); }}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-[13.5px] font-semibold"
                style={{border:'1.5px solid var(--line-2)', background:'#fff', cursor:'pointer', marginBottom:8, color:'var(--ink)'}}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-50)'}
                onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                <Icon name={ic} size={18} style={{color:'var(--primary)'}} />
                {l}
              </button>
            ))}
            <button onClick={() => setExportOpen(false)} style={{width:'100%', padding:'10px', borderRadius:10, background:'var(--line-2)', border:'none', cursor:'pointer', fontSize:13, fontWeight:600, color:'var(--ink-2)', marginTop:4}}>취소</button>
          </div>
        </div>
      )}
      {/* 헤더 */}
      <div style={{ marginBottom: 20 }}>
        <div className="mono" style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--ink-4)', marginBottom: 6 }}>AI-01 · Document Assistant</div>
        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--ink)' }}>AI 문서작성</h1>
        <p style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>과거 조직 문서를 재활용해 새 문서 초안을 만듭니다. 왼쪽 목록에서 기준 문서를 선택하거나 직접 검색하세요.</p>
        {/* 단계 표시 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 12 }}>
          {['검색', '선택', '생성', '편집'].map((s, i) => (
            <React.Fragment key={i}>
              <span className="mono" style={{
                padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: step >= i + 1 ? 700 : 500,
                background: step === i + 1 ? 'var(--primary-50)' : 'transparent',
                color: step === i + 1 ? 'var(--primary-700)' : step > i + 1 ? 'var(--good)' : 'var(--ink-4)',
              }}>
                {String(i + 1).padStart(2, '0')} {s}
              </span>
              {i < 3 && <span style={{ color: 'var(--line)', fontSize: 12 }}>—</span>}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Step 1–2: 입력 + 문서 선택 */}
      {step <= 2 && (
        <Card>
          <SectionLabel>문서 정보 입력</SectionLabel>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            {['신청서', '보고서', '공문', '계획안', '품의서'].map(t => (
              <button key={t} onClick={() => setDocType(t)}
                style={{ padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid ' + (docType === t ? 'var(--ink)' : 'var(--line)'), background: docType === t ? 'var(--ink)' : '#fff', color: docType === t ? '#fff' : 'var(--ink-2)' }}>
                {t}
              </button>
            ))}
          </div>
          <Input icon="search" value={query} onChange={setQuery} placeholder="새 문서의 제목을 입력하세요" />

          {/* RAG 검색 결과 */}
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px dashed var(--line)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Icon name="sparkles" size={13} style={{ color: 'oklch(0.50 0.13 75)' }} />
              <span className="mono" style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'oklch(0.45 0.13 75)' }}>
                RAG 유사 문서 자동 검색
              </span>
              <span className="mono" style={{ fontSize: 10.5, color: 'var(--ink-4)', marginLeft: 'auto' }}>{DOCS.length}건 발견</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {DOCS.slice(0, 5).map(doc => {
                const picked = selected?.id === doc.id;
                return (
                  <div key={doc.id}
                    onClick={() => { setSelected(doc); setStep(2); if (onSelectDoc) onSelectDoc(doc); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                      borderRadius: 12, cursor: 'pointer',
                      background: picked ? 'var(--primary-50)' : '#FAFAF7',
                      border: '1.5px solid ' + (picked ? 'var(--primary)' : 'var(--line-2)'),
                    }}>
                    <FileTypeIcon ext={doc.ext} size={18} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }} className="truncate">{doc.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{userById(doc.author).name} · {doc.updated} · {doc.size}</div>
                    </div>
                    <div className="mono" style={{ fontSize: 11, fontWeight: 700, color: doc.score > 0.7 ? 'var(--good)' : 'var(--ink-3)' }}>
                      {Math.round(doc.score * 100)}%
                    </div>
                    {picked
                      ? <Icon name="check-circle-2" size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                      : <Icon name="circle" size={16} style={{ color: 'var(--line)', flexShrink: 0 }} />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 선택 완료 액션 */}
          {selected && (
            <div style={{ marginTop: 16, padding: '14px 16px', background: 'var(--primary-50)', border: '1.5px solid var(--primary-100)', borderRadius: 12 }}
              className="slide-up">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div className="mono" style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--primary-700)', marginBottom: 4 }}>선택한 기준 문서</div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{selected.title}</div>
                </div>
                <Btn variant="primary" icon="sparkles" onClick={generate}>AI 초안 생성</Btn>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Step 3: 생성 중 */}
      {step === 3 && (
        <Card style={{ minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: 'var(--accent-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Icon name="sparkles" size={22} style={{ color: 'oklch(0.40 0.18 60)' }} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>AI가 초안을 작성하고 있습니다</div>
            <div className="mono" style={{ fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 2 }}>
              <div>✓ 기준 문서 로드: {selected?.title}</div>
              <div>✓ 벡터 검색 · ChromaDB 쿼리 완료</div>
              <div className="pulse-dot">● 로컬 LLM 초안 생성 중...</div>
            </div>
            <div style={{ marginTop: 16, width: 200, height: 6, background: 'var(--line-2)', borderRadius: 3, overflow: 'hidden', margin: '16px auto 0' }}>
              <div style={{ height: '100%', width: '65%', borderRadius: 3 }} className="shimmer" />
            </div>
          </div>
        </Card>
      )}

      {/* Step 4: 초안 완성 */}
      {step === 4 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Pill tone="accent"><Icon name="sparkle" size={10} /> AI 초안</Pill>
              <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>검토 후 저장하세요.</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <Btn variant="ghost" icon="plus" size="sm" onClick={reset}>새 문서</Btn>
              <Btn variant="ghost" icon="refresh-cw" size="sm" onClick={generate}>재생성</Btn>
              <Btn variant="outline" icon="download" size="sm" onClick={() => setExportOpen(true)}>내보내기</Btn>
              <Btn variant="primary" icon="save" size="sm" onClick={() => showMsg('문서가 저장되었습니다.')}>저장</Btn>
            </div>
          </div>
          <Card>
            <div style={{ padding: '16px 20px', background: '#fff', border: '1px solid var(--line)', borderRadius: 12, minHeight: 400 }}>
              <input defaultValue={query}
                style={{ width: '100%', fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', outline: 'none', border: 'none', marginBottom: 6, color: 'var(--ink)' }} />
              <div className="mono" style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-4)', marginBottom: 18 }}>
                작성자 {me.name} · {fmtDate(TODAY)} · 기준: {selected?.title}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: 13.5, lineHeight: 1.75, color: 'var(--ink-2)' }}>
                <div contentEditable suppressContentEditableWarning style={{ outline: 'none', padding: '12px', borderRadius: 6, background: '#FAFAF7', whiteSpace: 'pre-wrap', minHeight: 280 }}>
                  {aiAnswer}
                </div>
              </div>
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px dashed var(--line)' }}>
                <AIBadge source={`${selected?.title} · ${userById(selected?.author || 'u_kim').name} 작성`} />
              </div>
            </div>
          </Card>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <Btn variant="outline" icon="send" onClick={() => go('approval')}>결재 상신</Btn>
            <Btn variant="outline" icon="users" onClick={() => showMsg('팀원들에게 문서가 공유되었습니다.')}>팀 공유</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 직접 문서작성 영역 ───────────────────────────────────────────────────────
function ManualDocArea({ me, selectedDoc }) {
  const [title,   setTitle]   = useState('');
  const [content, setContent] = useState('');
  const [docType, setDocType] = useState('신청서');
  const [saved,   setSaved]   = useState(false);
  const [toast,   setToast]   = useState(null);
  const showMsg = (m) => { setToast(m); setTimeout(() => setToast(null), 2200); };

  useEffect(() => {
    if (selectedDoc) {
      setTitle(selectedDoc.title.replace(/20\d\d년\s/, '2026년 '));
      setDocType(selectedDoc.type);
    }
  }, [selectedDoc?.id]);

  const handleSave = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  return (
    <div style={{ padding: '24px 32px 48px', maxWidth: 860 }}>
      {toast && (
        <div style={{
          position:'fixed', bottom:28, left:'50%', transform:'translateX(-50%)',
          background:'var(--ink)', color:'#fff', padding:'10px 22px', borderRadius:12,
          fontSize:13, fontWeight:600, zIndex:9999, boxShadow:'0 4px 20px rgba(0,0,0,0.18)',
          pointerEvents:'none',
        }}>{toast}</div>
      )}
      <div style={{ marginBottom: 20 }}>
        <div className="mono" style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--ink-4)', marginBottom: 6 }}>Manual-01 · Document Editor</div>
        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--ink)' }}>문서작성</h1>
        <p style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>직접 문서를 작성합니다. 왼쪽 목록에서 참고 문서를 선택할 수 있습니다.</p>
      </div>

      <Card>
        {/* 유형 */}
        <SectionLabel>문서 유형</SectionLabel>
        <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
          {['신청서', '보고서', '공문', '계획안', '품의서', '기타'].map(t => (
            <button key={t} onClick={() => setDocType(t)}
              style={{ padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid ' + (docType === t ? 'var(--ink)' : 'var(--line)'), background: docType === t ? 'var(--ink)' : '#fff', color: docType === t ? '#fff' : 'var(--ink-2)' }}>
              {t}
            </button>
          ))}
        </div>

        {/* 제목 */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-3)', marginBottom: 6 }}>제목</div>
          <input value={title} onChange={e => setTitle(e.target.value)}
            placeholder="문서 제목을 입력하세요"
            style={{ width: '100%', padding: '10px 14px', border: '1.5px solid var(--line)', borderRadius: 10, fontSize: 15, fontWeight: 600, outline: 'none', color: 'var(--ink)', fontFamily: 'inherit' }}
            onFocus={e => e.target.style.borderColor = 'var(--primary)'}
            onBlur={e => e.target.style.borderColor = 'var(--line)'} />
        </div>

        {/* 내용 */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-3)', marginBottom: 6 }}>내용</div>
          <textarea value={content} onChange={e => setContent(e.target.value)}
            placeholder="문서 내용을 입력하세요..."
            rows={16}
            style={{ width: '100%', padding: '12px 14px', border: '1.5px solid var(--line)', borderRadius: 10, fontSize: 14, lineHeight: 1.75, outline: 'none', color: 'var(--ink)', resize: 'vertical', fontFamily: 'inherit' }}
            onFocus={e => e.target.style.borderColor = 'var(--primary)'}
            onBlur={e => e.target.style.borderColor = 'var(--line)'} />
        </div>

        {/* 액션 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--line-2)' }}>
          <Btn variant="outline" icon="paperclip" onClick={() => showMsg('파일 첨부 기능 준비 중입니다.')}>첨부파일</Btn>
          <div style={{ flex: 1 }} />
          <Btn variant="ghost" onClick={() => showMsg('임시 저장되었습니다.')}>임시저장</Btn>
          <Btn variant="primary" icon={saved ? 'check' : 'save'} disabled={!title.trim() || !content.trim()} onClick={handleSave}>
            {saved ? '저장됨' : '저장'}
          </Btn>
        </div>
      </Card>

      {/* 참고 문서 */}
      {selectedDoc && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-4)', marginBottom: 8 }}>참고 문서 (왼쪽 목록에서 선택)</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--line-2)', background: '#FAFAF7' }}>
            <FileTypeIcon ext={selectedDoc.ext} size={18} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{selectedDoc.title}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{selectedDoc.type} · {selectedDoc.updated} · {selectedDoc.size}</div>
            </div>
            <Pill tone="primary">{selectedDoc.type}</Pill>
          </div>
        </div>
      )}
    </div>
  );
}

// ── AIDocs (메인 컴포넌트) ───────────────────────────────────────────────────
function AIDocs({ me, go, subPage = 'ai' }) {
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [docSearch,   setDocSearch]   = useState('');
  const [docFilter,   setDocFilter]   = useState('all');
  const [previewDoc,  setPreviewDoc]  = useState(null);
  const [mainToast,   setMainToast]   = useState(null);
  const showMainMsg = (m) => { setMainToast(m); setTimeout(() => setMainToast(null), 2200); };

  const filteredDocs = useMemo(() => DOCS.filter(d => {
    if (docFilter !== 'all' && d.type !== docFilter) return false;
    if (docSearch && !d.title.toLowerCase().includes(docSearch.toLowerCase()) && !d.tags.some(t => t.includes(docSearch))) return false;
    return true;
  }), [docSearch, docFilter]);

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {mainToast && (
        <div style={{
          position:'fixed', bottom:28, left:'50%', transform:'translateX(-50%)',
          background:'var(--ink)', color:'#fff', padding:'10px 22px', borderRadius:12,
          fontSize:13, fontWeight:600, zIndex:9999, boxShadow:'0 4px 20px rgba(0,0,0,0.18)',
          pointerEvents:'none',
        }}>{mainToast}</div>
      )}
      {/* 패널 1: 문서 목록 */}
      <DocListPanel
        docs={filteredDocs}
        selectedDoc={selectedDoc}
        onSelect={setSelectedDoc}
        onPreview={setPreviewDoc}
        searchQ={docSearch}
        onSearch={setDocSearch}
        filter={docFilter}
        onFilter={setDocFilter}
      />

      {/* 패널 2: 에디터 / 뷰어 */}
      <div style={{ flex: 1, overflowY: 'auto' }} className="col-scroll">
        {subPage === 'manual' ? (
          <ManualDocArea me={me} selectedDoc={selectedDoc} />
        ) : subPage === 'preview' ? (
          <div style={{ padding: '24px 32px 48px' }}>
            <div style={{ marginBottom: 20 }}>
              <div className="mono" style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--ink-4)', marginBottom: 6 }}>Preview-01 · Document Viewer</div>
              <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--ink)' }}>문서 미리보기</h1>
              <p style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>왼쪽 목록에서 문서를 선택하면 미리보기가 표시됩니다.</p>
            </div>
            {!selectedDoc ? (
              <Empty icon="file-search" title="문서를 선택하세요" sub="왼쪽 목록에서 문서를 클릭하면 여기에 미리보기가 표시됩니다." />
            ) : (
              <div className="fadein">
                {/* 문서 메타 헤더 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FileTypeIcon ext={selectedDoc.ext} size={20} />
                    <Pill tone="primary">{selectedDoc.type}</Pill>
                    {selectedDoc.tags?.map(t => <Pill key={t}>{t}</Pill>)}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Btn variant="outline" icon="download" size="sm" onClick={() => showMainMsg('파일을 다운로드 중입니다…')}>다운로드</Btn>
                    <Btn variant="outline" icon="printer" size="sm" onClick={() => showMainMsg('인쇄 미리보기를 준비 중입니다.')}>인쇄</Btn>
                    <Btn variant="ai" icon="copy" size="sm" onClick={() => { setSelectedDoc(selectedDoc); showMainMsg('AI 문서 탭에서 초안을 생성할 수 있습니다.'); }}>이 문서로 초안 생성</Btn>
                  </div>
                </div>
                {/* 작성자 정보 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                  <Avatar user={userById(selectedDoc.author)} size={22} />
                  <span style={{ fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 600 }}>
                    {userById(selectedDoc.author).name} {userById(selectedDoc.author).rank}
                  </span>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--ink-4)' }}>
                    {selectedDoc.updated} · {selectedDoc.size}
                  </span>
                </div>
                {/* 문서 용지 */}
                <div style={{
                  background: '#fff', border: '1px solid var(--line-2)',
                  borderRadius: 12, padding: '40px 48px',
                  boxShadow: '0 2px 16px rgba(11,15,14,0.07)',
                  minHeight: 500,
                }}>
                  <div style={{ textAlign: 'center', marginBottom: 36 }}>
                    <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--ink)' }}>{selectedDoc.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 8 }}>
                      {userById(selectedDoc.author).dept} · 작성자: {userById(selectedDoc.author).name} ({userById(selectedDoc.author).rank}) · {selectedDoc.updated}
                    </div>
                    <div style={{ width: 60, height: 3, background: 'var(--primary)', margin: '14px auto 0', borderRadius: 2 }} />
                  </div>
                  <DocPreviewContent doc={selectedDoc} />
                </div>
              </div>
            )}
          </div>
        ) : (
          <AIDocArea me={me} go={go} baseDoc={selectedDoc} onSelectDoc={setSelectedDoc} />
        )}
      </div>

      {/* 문서 미리보기 모달 */}
      <DocPreviewModal
        doc={previewDoc}
        open={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        onUseAsTemplate={previewDoc ? () => { setSelectedDoc(previewDoc); setPreviewDoc(null); } : null}
      />
    </div>
  );
}


export default AIDocs;
