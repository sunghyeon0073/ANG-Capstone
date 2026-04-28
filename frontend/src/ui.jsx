// Shared UI primitives
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { userById } from './data';

export function Icon({ name, size=16, className='', style={}, strokeWidth=1.75 }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && window.lucide) {
      ref.current.innerHTML = '';
      const el = document.createElement('i');
      el.setAttribute('data-lucide', name);
      el.style.width = size + 'px';
      el.style.height = size + 'px';
      el.style.strokeWidth = strokeWidth;
      ref.current.appendChild(el);
      window.lucide.createIcons({ attrs: { 'stroke-width': strokeWidth } });
    }
  }, [name, size, strokeWidth]);
  return <span ref={ref} className={`inline-flex items-center justify-center ${className}`} style={{ width:size, height:size, ...style }} />;
}

export function Avatar({ user, size=28, ring=false }) {
  if (!user) return null;
  return (
    <div
      className={`inline-flex items-center justify-center rounded-full font-black text-white`}
      style={{
        width:size, height:size,
        background: user.color,
        fontSize: size * 0.4,
        letterSpacing: '-0.02em',
        border: ring ? '2px solid #fff' : 'none',
        boxShadow: ring ? '0 0 0 1px var(--line)' : 'none',
      }}
      title={user.name}
    >
      {user.avatar}
    </div>
  );
}

export function Pill({ children, tone='neutral', style={}, className='' }) {
  const tones = {
    neutral: { bg:'var(--line-2)',     color:'var(--ink-2)',            border:'var(--line)' },
    primary: { bg:'var(--primary-100)', color:'var(--primary-700)',      border:'var(--primary-100)' },
    accent:  { bg:'var(--accent-100)', color:'oklch(0.36 0.18 60)',     border:'var(--accent-100)' },
    good:    { bg:'#D1FAE5',           color:'#065F46',                 border:'#6EE7B7' },
    warn:    { bg:'#FEF3C7',           color:'#78350F',                 border:'#FCD34D' },
    danger:  { bg:'#FEE2E2',           color:'#7F1D1D',                 border:'#FCA5A5' },
  };
  const t = tones[tone] || tones.neutral;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide ${className}`}
      style={{ background:t.bg, color:t.color, border:`1.5px solid ${t.border}`, ...style }}
    >{children}</span>
  );
}

export function Btn({ children, variant='ghost', size='md', icon, onClick, style={}, disabled=false, className='', type='button' }) {
  const sizes = {
    sm: { p:'6px 10px', fs:12, gap:6, ih:14 },
    md: { p:'9px 14px', fs:13, gap:8, ih:16 },
    lg: { p:'12px 20px', fs:14, gap:10, ih:18 },
  };
  const s = sizes[size];
  const variants = {
    primary: { bg:'var(--primary)',     color:'#fff',               border:'2px solid var(--primary)',     shadow:'0 5px 14px -3px rgba(0,100,150,.35)' },
    teal:    { bg:'var(--primary)',     color:'#fff',               border:'2px solid var(--primary)',     shadow:'0 5px 14px -3px rgba(0,100,150,.35)' },
    outline: { bg:'#fff',              color:'var(--primary-600)', border:'2px solid var(--primary)' },
    ghost:   { bg:'transparent',       color:'var(--ink-3)',       border:'2px solid transparent' },
    subtle:  { bg:'var(--line-2)',     color:'var(--ink)',         border:'1.5px solid var(--line)' },
    dark:    { bg:'var(--ink)',        color:'#fff',               border:'2px solid var(--ink)' },
    ai:      { bg:'oklch(0.94 0.06 60)', color:'oklch(0.34 0.18 60)', border:'1.5px solid oklch(0.86 0.09 60)' },
    danger:  { bg:'#FEE2E2',          color:'var(--danger)',      border:'1.5px solid #FCA5A5' },
  };
  const v = variants[variant] || variants.ghost;
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center font-black rounded-xl transition-all active:scale-[0.97] ${className}`}
      style={{
        padding: s.p, fontSize: s.fs, gap: s.gap,
        background: v.bg, color: v.color, border: v.border,
        boxShadow: v.shadow || 'none',
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        letterSpacing: variant==='primary' || variant==='teal' || variant==='dark' ? '0' : '-0.01em',
        ...style,
      }}
      onMouseEnter={e=> { if(!disabled) e.currentTarget.style.filter='brightness(1.06)' }}
      onMouseLeave={e=> { e.currentTarget.style.filter='none' }}
    >
      {icon && <Icon name={icon} size={s.ih} />}
      {children}
    </button>
  );
}

export function Card({ children, className='', style={}, pad=true }) {
  return (
    <div className={className} style={{
      background:'var(--card)', border:'1.5px solid var(--line)',
      borderRadius:20, padding: pad ? 22 : 0,
      boxShadow:'0 4px 20px -6px rgba(11,15,14,0.10)',
      ...style
    }}>{children}</div>
  );
}

export function SectionLabel({ children, right }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="text-[11.5px] font-black uppercase tracking-[0.16em]" style={{color:'var(--ink-3)'}}>{children}</div>
      {right}
    </div>
  );
}

export function Input({ icon, placeholder, value, onChange, type='text', style={} , className=''}) {
  return (
    <div className={`flex items-center gap-2 rounded-xl ${className}`}
      style={{ background:'var(--line-3)', border:'2px solid var(--line-2)', padding:'10px 14px', transition:'all .15s', ...style }}>
      {icon && <Icon name={icon} size={15} style={{color:'var(--ink-4)'}} />}
      <input type={type} value={value} onChange={e=>onChange && onChange(e.target.value)} placeholder={placeholder}
        className="flex-1 outline-none bg-transparent"
        style={{ fontSize:13, color:'var(--ink)', fontWeight:500 }}
      />
    </div>
  );
}

export function AIBadge({ source, inline=false }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${inline ? '' : 'mt-2'}`}
      style={{ background:'var(--accent-50)', border:'1px dashed oklch(0.82 0.1 75)', fontSize:10.5 }}>
      <Icon name="sparkles" size={11} style={{color:'oklch(0.55 0.13 75)'}} strokeWidth={2.2} />
      <span style={{color:'oklch(0.38 0.13 75)', fontWeight:900, letterSpacing:'0.12em', textTransform:'uppercase'}}>AI 추천</span>
      {source && <span style={{color:'oklch(0.45 0.08 75)', fontWeight:500}}>· {source}</span>}
    </span>
  );
}

export function Modal({ open, onClose, children, width=560, title }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center fadein" style={{ background:'rgba(17,20,19,0.35)', backdropFilter:'blur(4px)' }} onClick={onClose}>
      <div className="slide-up" style={{ width, maxWidth:'92vw', maxHeight:'88vh', background:'#fff', borderRadius:24, border:'1px solid var(--line)', overflow:'hidden', boxShadow:'0 30px 80px rgba(15,23,42,0.22)' }}
        onClick={e=>e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between px-7 py-5 border-b" style={{borderColor:'var(--line-2)'}}>
            <div className="font-black text-[16px] tracking-tight">{title}</div>
            <button onClick={onClose} style={{color:'var(--ink-3)'}}><Icon name="x" size={18} /></button>
          </div>
        )}
        <div className="col-scroll" style={{maxHeight:'calc(88vh - 60px)', overflowY:'auto'}}>
          {children}
        </div>
      </div>
    </div>
  );
}

export function Empty({ icon='inbox', title, sub, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-20 px-6">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5" style={{background:'var(--line-2)'}}>
        <Icon name={icon} size={26} style={{color:'var(--ink-4)'}} />
      </div>
      <div className="font-black text-[16px] mb-1.5 tracking-tight" style={{color:'var(--ink)'}}>{title}</div>
      {sub && <div className="text-[12.5px] max-w-xs font-medium" style={{color:'var(--ink-3)'}}>{sub}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function FileTypeIcon({ ext, size=20 }) {
  const colors = {
    hwp:  { bg:'oklch(0.93 0.08 250)', fg:'oklch(0.40 0.14 250)', label:'HWP' },
    pdf:  { bg:'oklch(0.93 0.08 25)',  fg:'oklch(0.40 0.14 25)',  label:'PDF' },
    docx: { bg:'oklch(0.92 0.07 220)', fg:'oklch(0.38 0.13 220)', label:'DOC' },
    xlsx: { bg:'oklch(0.92 0.08 150)', fg:'oklch(0.38 0.13 150)', label:'XLS' },
    png:  { bg:'oklch(0.93 0.07 300)', fg:'oklch(0.40 0.13 300)', label:'IMG' },
    jpg:  { bg:'oklch(0.93 0.07 300)', fg:'oklch(0.40 0.13 300)', label:'IMG' },
  };
  const c = colors[ext] || { bg:'#F3F3EE', fg:'#4A4F4E', label: (ext||'').toUpperCase().slice(0,3) };
  return (
    <div className="inline-flex items-center justify-center rounded-md mono font-bold"
      style={{ width: size+14, height: size, background: c.bg, color: c.fg, fontSize: size*0.48, letterSpacing: '0.02em' }}>
      {c.label}
    </div>
  );
}

const sH3 = { fontSize:13, fontWeight:800, color:'var(--ink-3)', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:8, paddingBottom:4, borderBottom:'1px solid var(--line-2)' };
const sP  = { fontSize:14, color:'var(--ink-2)', lineHeight:1.75 };
const sUl = { paddingLeft:20, fontSize:14, color:'var(--ink-2)', lineHeight:2, margin:0 };
const sTbl = { width:'100%', borderCollapse:'collapse', fontSize:13 };
const sTh  = { padding:'8px 12px', textAlign:'left', fontWeight:700, fontSize:11.5, color:'var(--ink-3)', border:'1px solid var(--line-2)', letterSpacing:'0.06em', textTransform:'uppercase' };
const sTd  = { padding:'9px 12px', border:'1px solid var(--line-2)', color:'var(--ink)', verticalAlign:'middle' };

export function DocPreviewContent({ doc }) {
  if (!doc) return null;
  const author = userById(doc.author);

  const body = (() => {
    if (doc.type === '신청서') {
      const year  = doc.year || 2024;
      const rows  = [
        ['강사료',   year===2023?'1,600,000':year===2025?'1,900,000':'1,800,000', '외부 3인'],
        ['운영물품', year===2023?'900,000':'1,200,000', '배너·다과·현수막'],
        ['홍보비',   year===2023?'500,000':'700,000',   '포스터 인쇄'],
        ['예비비',   '500,000', '—'],
      ];
      const total = rows.reduce((s,r)=>s+parseInt(r[1].replace(/,/g,'')),0).toLocaleString();
      return (
        <div className="space-y-6">
          <section>
            <h3 style={sH3}>1. 행사 개요</h3>
            <p style={sP}>{year}년 상반기 평생교육원에서 수강생 및 지역주민을 대상으로 교육 페스티벌을 개최하고자 하며, 이에 필요한 운영 지원금을 신청합니다.</p>
          </section>
          <section>
            <h3 style={sH3}>2. 개최 일시 및 장소</h3>
            <p style={sP}>{year}년 5월 {year===2023?22:year===2025?20:25}일(월) 10:00 – 17:00 / 본원 1층 강당 및 202호</p>
          </section>
          <section>
            <h3 style={sH3}>3. 예산 편성</h3>
            <table style={sTbl}>
              <thead><tr style={{background:'var(--line-3)'}}>
                {['항목','금액 (원)','비고'].map(h=><th key={h} style={sTh}>{h}</th>)}
              </tr></thead>
              <tbody>
                {rows.map((r,i)=><tr key={i}>{r.map((c,j)=><td key={j} style={{...sTd, textAlign:j===1?'right':'left'}}>{c}</td>)}</tr>)}
                <tr style={{background:'var(--primary-50)'}}>
                  <td style={{...sTd,fontWeight:700}}>합계</td>
                  <td style={{...sTd,textAlign:'right',fontWeight:700}}>{total}</td>
                  <td style={sTd}>—</td>
                </tr>
              </tbody>
            </table>
          </section>
          <section>
            <h3 style={sH3}>4. 신청인</h3>
            <p style={sP}>{author.dept} {author.name} ({author.rank}) · 사번 {author.emp}</p>
          </section>
        </div>
      );
    }

    if (doc.type === '보고서' && doc.title.includes('결산')) {
      return (
        <div className="space-y-6">
          <section>
            <h3 style={sH3}>1. 개요</h3>
            <p style={sP}>2024년 하반기 평생교육원 운영 예산 집행 결과를 보고합니다. 총 예산 대비 집행률 94.2%로 전년 동기(91.7%) 대비 2.5%p 증가했습니다.</p>
          </section>
          <section>
            <h3 style={sH3}>2. 예산 집행 현황</h3>
            <table style={sTbl}>
              <thead><tr style={{background:'var(--line-3)'}}>
                {['구분','예산(원)','집행(원)','집행률'].map(h=><th key={h} style={sTh}>{h}</th>)}
              </tr></thead>
              <tbody>
                {[
                  ['강사비','12,000,000','11,400,000','95.0%'],
                  ['운영비', '4,500,000', '4,120,000','91.6%'],
                  ['홍보비', '2,000,000', '1,880,000','94.0%'],
                  ['시설비', '3,200,000', '2,950,000','92.2%'],
                  ['기타',   '800,000',   '710,000',  '88.8%'],
                ].map((r,i)=><tr key={i}>{r.map((c,j)=><td key={j} style={{...sTd,textAlign:j>0?'right':'left'}}>{c}</td>)}</tr>)}
                <tr style={{background:'var(--primary-50)'}}>
                  {['합계','22,500,000','21,060,000','93.6%'].map((c,j)=>(
                    <td key={j} style={{...sTd,fontWeight:700,textAlign:j>0?'right':'left'}}>{c}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </section>
          <section>
            <h3 style={sH3}>3. 주요 성과</h3>
            <ul style={sUl}>
              <li>수강생 총 847명 (전년 대비 11% 증가)</li>
              <li>강좌 만족도 4.3 / 5.0</li>
              <li>신규 강좌 3개 개설 · 폐강 0건</li>
            </ul>
          </section>
        </div>
      );
    }

    if (doc.type === '보고서' && doc.title.includes('설문')) {
      return (
        <div className="space-y-6">
          <section>
            <h3 style={sH3}>1. 조사 개요</h3>
            <div style={{...sP, display:'grid', gridTemplateColumns:'120px 1fr', gap:'4px 0', rowGap:6}}>
              {[['조사 기간','2024.11.01 ~ 11.15'],['응답 인원','214명'],['조사 방법','온라인 설문 (Google Forms)'],['대상','2024 하반기 수강생 전원']].map(([k,v])=>(
                <React.Fragment key={k}>
                  <span style={{fontWeight:600,color:'var(--ink-3)',fontSize:13}}>{k}</span>
                  <span style={{fontSize:13,color:'var(--ink)'}}>{v}</span>
                </React.Fragment>
              ))}
            </div>
          </section>
          <section>
            <h3 style={sH3}>2. 만족도 결과</h3>
            <div className="space-y-3">
              {[['전반적 만족도',86],['강사 전문성',91],['강의 내용 충실도',83],['시설·환경',78],['수강 신청 편의성',74]].map(([l,v])=>(
                <div key={l}>
                  <div className="flex justify-between mb-1" style={{fontSize:13}}>
                    <span style={{fontWeight:500,color:'var(--ink-2)'}}>{l}</span>
                    <span className="mono" style={{fontWeight:700,color:'var(--primary)'}}>{v}%</span>
                  </div>
                  <div style={{height:8,background:'var(--line-2)',borderRadius:4,overflow:'hidden'}}>
                    <div style={{height:'100%',width:`${v}%`,background:'var(--primary)',borderRadius:4,transition:'width .4s'}}/>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section>
            <h3 style={sH3}>3. 주요 의견</h3>
            <ul style={sUl}>
              <li>"야간 강좌 확대를 희망합니다" (38건)</li>
              <li>"주차 공간이 부족합니다" (24건)</li>
              <li>"강사님이 매우 열정적이었습니다" (19건)</li>
            </ul>
          </section>
        </div>
      );
    }

    if (doc.type === '계획안') {
      return (
        <div className="space-y-6">
          <section>
            <h3 style={sH3}>1. 행사 목적</h3>
            <p style={sP}>교직원 간 소통 강화 및 업무 역량 향상을 위한 연간 워크숍을 개최합니다.</p>
          </section>
          <section>
            <h3 style={sH3}>2. 일정 및 장소</h3>
            <p style={sP}>2024년 10월 18일(금) 09:00 – 18:00 / 강원도 평창 리조트</p>
          </section>
          <section>
            <h3 style={sH3}>3. 프로그램</h3>
            <table style={sTbl}>
              <thead><tr style={{background:'var(--line-3)'}}>
                {['시간','프로그램','담당'].map(h=><th key={h} style={sTh}>{h}</th>)}
              </tr></thead>
              <tbody>
                {[
                  ['09:00–10:00','이동 및 체크인','전원'],
                  ['10:00–12:00','팀빌딩 워크숍','외부 퍼실리테이터'],
                  ['12:00–13:30','점심식사','—'],
                  ['13:30–15:30','2025 사업계획 공유','팀장'],
                  ['15:30–17:00','분임토의 및 발표','각 팀'],
                  ['17:00–18:00','정리 및 귀환','전원'],
                ].map((r,i)=><tr key={i}>{r.map((c,j)=><td key={j} style={sTd}>{c}</td>)}</tr>)}
              </tbody>
            </table>
          </section>
        </div>
      );
    }

    if (doc.type === '공문') {
      return (
        <div className="space-y-6">
          <div style={{textAlign:'center',marginBottom:24}}>
            <div style={{fontSize:11,color:'var(--ink-4)',fontWeight:600,letterSpacing:'0.1em',marginBottom:4}}>평생교육원 학사운영팀</div>
            <div style={{fontSize:11,color:'var(--ink-4)'}}>수신 : 외부강사 홍길동 외 2인</div>
            <div style={{fontSize:11,color:'var(--ink-4)'}}>참조 : 학사운영팀장</div>
            <div style={{fontSize:11,color:'var(--ink-4)'}}>제목 : 외부강사 초빙에 관한 건</div>
          </div>
          <section>
            <p style={sP}>귀 강사님의 건승을 기원합니다.</p>
            <p style={{...sP,marginTop:12}}>본원에서는 2025년도 상반기 강좌 운영과 관련하여 아래와 같이 외부강사를 초빙하고자 하오니 협조하여 주시기 바랍니다.</p>
          </section>
          <section>
            <h3 style={sH3}>— 아 래 —</h3>
            <table style={sTbl}>
              <tbody>
                {[['강좌명','생활공예 기초 · 영어 회화 · 요가'],['강의 기간','2025.03.01 ~ 2025.07.31'],['강의 요일','매주 화·목 10:00–12:00'],['강사료','시간당 ₩80,000 (원천징수 후 지급)'],['제출 서류','이력서, 사진, 통장사본, 신분증 사본']].map(([k,v])=>(
                  <tr key={k}><td style={{...sTd,fontWeight:600,color:'var(--ink-3)',width:120}}>{k}</td><td style={sTd}>{v}</td></tr>
                ))}
              </tbody>
            </table>
          </section>
          <p style={{...sP,marginTop:16}}>문의사항은 학사운영팀(☎ 내선 203)으로 연락 주시기 바랍니다.<br/>감사합니다.</p>
        </div>
      );
    }

    if (doc.type === '양식') {
      return (
        <div className="space-y-6">
          <div style={{padding:'16px 20px',border:'2px solid var(--ink-2)',borderRadius:8,textAlign:'center',marginBottom:8}}>
            <div style={{fontSize:18,fontWeight:800,letterSpacing:'-0.02em'}}>강의실 예약 신청서</div>
            <div style={{fontSize:11,color:'var(--ink-3)',marginTop:4}}>평생교육원 학사운영팀</div>
          </div>
          <table style={sTbl}>
            <tbody>
              {[['신청일','           년    월    일'],['신청자','성명:                 부서:              직위:     '],['강의실','□ 101호  □ 102호  □ 201호  □ 202호  □ 강당'],['사용 일시','   년   월   일(   ) __:__ ~ __:__'],['사용 목적',''],['예상 인원','       명'],['필요 기자재','□ 빔프로젝터  □ 마이크  □ 화이트보드  □ 기타(       )']].map(([k,v])=>(
                <tr key={k}><td style={{...sTd,fontWeight:600,color:'var(--ink-3)',width:120,verticalAlign:'top'}}>{k}</td><td style={{...sTd,minHeight:36}}>{v||<span style={{color:'var(--line)'}}>—</span>}</td></tr>
              ))}
            </tbody>
          </table>
          <div style={{textAlign:'right',marginTop:24,fontSize:13,color:'var(--ink-3)'}}>
            신청인 서명 : _______________ (인)
          </div>
        </div>
      );
    }

    return <p style={sP}>문서 내용을 불러올 수 없습니다.</p>;
  })();

  return body;
}

export function DocPreviewModal({ doc, open, onClose, onUseAsTemplate }) {
  if (!doc) return null;
  const author = userById(doc.author);
  return (
    <Modal open={open} onClose={onClose} width={760} title="">
      <div style={{ display:'flex', flexDirection:'column', maxHeight:'85vh' }}>
        <div style={{ padding:'20px 28px 16px', borderBottom:'1.5px solid var(--line-2)', background:'#FAFAF9' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
            <FileTypeIcon ext={doc.ext} size={20} />
            <Pill tone="primary">{doc.type}</Pill>
            {doc.tags?.map(t => <Pill key={t}>{t}</Pill>)}
          </div>
          <div style={{ fontSize:20, fontWeight:800, color:'var(--ink)', letterSpacing:'-0.02em', lineHeight:1.3 }}>{doc.title}</div>
          <div style={{ display:'flex', alignItems:'center', gap:16, marginTop:10 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <Avatar user={author} size={20} />
              <span style={{ fontSize:12.5, color:'var(--ink-3)', fontWeight:600 }}>{author.name} {author.rank}</span>
            </div>
            <span className="mono" style={{ fontSize:11, color:'var(--ink-4)' }}>{doc.updated} · {doc.size}</span>
          </div>
        </div>

        <div className="col-scroll" style={{ flex:1, overflowY:'auto', padding:'28px 32px' }}>
          <div style={{
            background:'#fff', border:'1px solid var(--line-2)',
            borderRadius:12, padding:'36px 40px',
            boxShadow:'0 2px 12px rgba(11,15,14,0.06)',
            minHeight:400,
          }}>
            <div style={{ textAlign:'center', marginBottom:32 }}>
              <div style={{ fontSize:20, fontWeight:900, letterSpacing:'-0.02em', color:'var(--ink)' }}>{doc.title}</div>
              <div style={{ fontSize:12, color:'var(--ink-4)', marginTop:6 }}>
                {author.dept} · 작성자: {author.name} ({author.rank}) · {doc.updated}
              </div>
              <div style={{ width:60, height:3, background:'var(--primary)', margin:'12px auto 0', borderRadius:2 }} />
            </div>
            <DocPreviewContent doc={doc} />
          </div>
        </div>

        <div style={{ padding:'14px 28px', borderTop:'1.5px solid var(--line-2)', display:'flex', alignItems:'center', gap:8, background:'#FAFAF9' }}>
          <Btn variant="outline" icon="download" size="sm">다운로드</Btn>
          <Btn variant="outline" icon="printer" size="sm">인쇄</Btn>
          {onUseAsTemplate && (
            <Btn variant="ai" icon="copy" size="sm" onClick={onUseAsTemplate}>이 문서로 초안 생성</Btn>
          )}
          <div style={{ flex:1 }} />
          <Btn variant="ghost" size="sm" onClick={onClose}>닫기</Btn>
        </div>
      </div>
    </Modal>
  );
}
