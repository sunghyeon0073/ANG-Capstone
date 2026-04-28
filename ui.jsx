// Shared UI primitives
const { useState, useEffect, useMemo, useRef, useCallback } = React;

function Icon({ name, size=16, className='', style={}, strokeWidth=1.75 }) {
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

function Avatar({ user, size=28, ring=false }) {
  if (!user) return null;
  return (
    <div
      className={`inline-flex items-center justify-center rounded-full font-semibold text-white ${ring ? 'ring-2 ring-white' : ''}`}
      style={{
        width:size, height:size,
        background: user.color,
        fontSize: size * 0.38,
        letterSpacing: '-0.02em',
        fontFamily: "'JetBrains Mono', monospace",
      }}
      title={user.name}
    >
      {user.avatar}
    </div>
  );
}

function Pill({ children, tone='neutral', style={}, className='' }) {
  const tones = {
    neutral: { bg:'#F3F3EE', color:'#4A4F4E', border:'#E9E9E4' },
    primary: { bg:'var(--primary-50)', color:'var(--primary-700)', border:'var(--primary-100)' },
    accent:  { bg:'var(--accent-50)',  color:'oklch(0.45 0.13 75)', border:'var(--accent-100)' },
    good:    { bg:'oklch(0.96 0.03 155)', color:'oklch(0.42 0.11 155)', border:'oklch(0.9 0.05 155)' },
    warn:    { bg:'oklch(0.97 0.04 65)',  color:'oklch(0.45 0.12 55)',  border:'oklch(0.9 0.06 65)' },
    danger:  { bg:'oklch(0.97 0.03 25)',  color:'oklch(0.45 0.14 25)',  border:'oklch(0.9 0.05 25)' },
  };
  const t = tones[tone] || tones.neutral;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-[3px] rounded-md text-[11px] font-semibold mono ${className}`}
      style={{ background:t.bg, color:t.color, border:`1px solid ${t.border}`, ...style }}
    >{children}</span>
  );
}

function Btn({ children, variant='ghost', size='md', icon, onClick, style={}, disabled=false, className='', type='button' }) {
  const sizes = {
    sm: { p:'6px 10px', fs:12, gap:6, ih:14 },
    md: { p:'9px 14px', fs:13, gap:8, ih:16 },
    lg: { p:'12px 20px', fs:14, gap:10, ih:18 },
  };
  const s = sizes[size];
  const variants = {
    primary: { bg:'var(--ink)', color:'#fff', border:'1px solid var(--ink)' },
    teal:    { bg:'var(--primary)', color:'#fff', border:'1px solid var(--primary)' },
    outline: { bg:'transparent', color:'var(--ink)', border:'1px solid var(--line)' },
    ghost:   { bg:'transparent', color:'var(--ink-2)', border:'1px solid transparent' },
    subtle:  { bg:'#F3F3EE', color:'var(--ink)', border:'1px solid transparent' },
    ai:      { bg:'oklch(0.96 0.04 75)', color:'oklch(0.40 0.13 75)', border:'1px solid oklch(0.88 0.06 75)' },
    danger:  { bg:'#fff', color:'oklch(0.45 0.14 25)', border:'1px solid oklch(0.9 0.05 25)' },
  };
  const v = variants[variant] || variants.ghost;
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center font-semibold rounded-lg transition-all active:scale-[0.97] ${className}`}
      style={{
        padding: s.p, fontSize: s.fs, gap: s.gap,
        background: v.bg, color: v.color, border: v.border,
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        letterSpacing:'-0.01em',
        ...style,
      }}
      onMouseEnter={e=> { if(!disabled) e.currentTarget.style.filter='brightness(0.96)' }}
      onMouseLeave={e=> { e.currentTarget.style.filter='none' }}
    >
      {icon && <Icon name={icon} size={s.ih} />}
      {children}
    </button>
  );
}

function Card({ children, className='', style={}, pad=true }) {
  return (
    <div className={className} style={{
      background:'var(--card)', border:'1px solid var(--line)',
      borderRadius:14, padding: pad ? 20 : 0,
      ...style
    }}>{children}</div>
  );
}

function SectionLabel({ children, right }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="mono text-[11px] font-semibold uppercase tracking-[0.14em]" style={{color:'var(--ink-3)'}}>{children}</div>
      {right}
    </div>
  );
}

function Input({ icon, placeholder, value, onChange, type='text', style={} , className=''}) {
  return (
    <div className={`flex items-center gap-2 rounded-lg ring-focus ${className}`}
      style={{ background:'#fff', border:'1px solid var(--line)', padding:'8px 12px', ...style }}>
      {icon && <Icon name={icon} size={14} style={{color:'var(--ink-4)'}} />}
      <input type={type} value={value} onChange={e=>onChange && onChange(e.target.value)} placeholder={placeholder}
        className="flex-1 outline-none bg-transparent"
        style={{ fontSize:13, color:'var(--ink)' }}
      />
    </div>
  );
}

// AI badge — shows provenance/memory citation
function AIBadge({ source, inline=false }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 ${inline ? '' : 'mt-2'}`}
      style={{ background:'var(--accent-50)', border:'1px dashed oklch(0.82 0.1 75)', fontSize:11 }}>
      <Icon name="sparkle" size={11} style={{color:'oklch(0.55 0.13 75)'}} strokeWidth={2} />
      <span className="mono" style={{color:'oklch(0.38 0.13 75)', fontWeight:600}}>AI 추천</span>
      {source && <span style={{color:'oklch(0.45 0.08 75)'}}>· {source}</span>}
    </span>
  );
}

// Modal
function Modal({ open, onClose, children, width=560, title }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center fadein" style={{ background:'rgba(17,20,19,0.35)', backdropFilter:'blur(4px)' }} onClick={onClose}>
      <div className="slide-up" style={{ width, maxWidth:'92vw', maxHeight:'88vh', background:'#fff', borderRadius:16, border:'1px solid var(--line)', overflow:'hidden', boxShadow:'0 30px 80px rgba(0,0,0,0.18)' }}
        onClick={e=>e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b" style={{borderColor:'var(--line-2)'}}>
            <div className="font-bold text-[15px] tracking-tight">{title}</div>
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

// Empty state
function Empty({ icon='inbox', title, sub, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-4" style={{background:'#F3F3EE'}}>
        <Icon name={icon} size={22} style={{color:'var(--ink-4)'}} />
      </div>
      <div className="font-bold text-[15px] mb-1" style={{color:'var(--ink)'}}>{title}</div>
      {sub && <div className="text-[12.5px] max-w-xs" style={{color:'var(--ink-3)'}}>{sub}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// File extension icon
function FileTypeIcon({ ext, size=20 }) {
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

Object.assign(window, { Icon, Avatar, Pill, Btn, Card, SectionLabel, Input, AIBadge, Modal, Empty, FileTypeIcon });
