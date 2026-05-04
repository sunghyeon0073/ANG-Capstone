// Main app shell — top nav + context sidebar
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { DEPTS, USERS, DOCS, MAILS, NOTIFICATIONS } from './data';
import { Icon, Avatar } from './ui';
import Dashboard from './pages/dashboard';
import AIDocs from './pages/ai_docs';
import CalendarScreen from './pages/calendar';
import Approval from './pages/approval';
import Files from './pages/files';
import Boards from './pages/boards';
import Mail from './pages/mail';
import Chat from './pages/chat';
import Org from './pages/org';
import { MyPage, Admin } from './pages/admin';
import LoginPage from './pages/login';
import SignupPage from './pages/signup';

// ─ 페이지별 사이드바 서브메뉴 ──────────────────────────────────────────────
const SIDEBAR_SUBS = {
  dashboard: [
    { id: 'overview',  label: '업무 현황',  icon: 'layout-dashboard' },
    { id: 'tasks',     label: '할 일',      icon: 'check-square' },
    { id: 'calendar',  label: '내 일정',    icon: 'calendar' },
    { id: 'notices',   label: '공지사항',   icon: 'megaphone' },
    { id: 'quickmemo', label: '빠른 메모',  icon: 'pencil' },
  ],
  ai_docs: [
    { id: 'ai',      label: 'AI 문서작성',   icon: 'sparkles' },
    { id: 'manual',  label: '문서작성',      icon: 'file-edit' },
    { id: 'preview', label: '문서 미리보기', icon: 'eye' },
  ],
  approval: [
    { id: 'pending',  label: '결재 대기', icon: 'clock' },
    { id: 'approved', label: '승인 완료', icon: 'check-circle-2' },
    { id: 'rejected', label: '반려',      icon: 'x-circle' },
    { id: 'mine',     label: '내가 요청', icon: 'user' },
  ],
  files: [
    { id: 'shared',   label: '공유 파일함', icon: 'folder-open' },
    { id: 'personal', label: '개인 파일함', icon: 'user' },
  ],
  boards: [
    { id: 'notice', label: '공지사항',   icon: 'pin' },
    { id: 'free',   label: '자유게시판', icon: 'message-circle' },
  ],
  mail: [
    { id: 'inbox',   label: '받은메일함', icon: 'inbox' },
    { id: 'sent',    label: '보낸메일함', icon: 'send' },
    { id: 'starred', label: '중요',       icon: 'star' },
    { id: 'trash',   label: '휴지통',     icon: 'trash-2' },
  ],
  chat: [
    { id: 'group',    label: '단체채팅',  icon: 'users' },
    { id: 'personal', label: '개인채팅',  icon: 'message-circle' },
  ],
  org: DEPTS.map(d => ({
    id: d.id,
    label: d.name,
    icon: d.parent === null ? 'building-2' : 'users',
  })),
};

// ── Toast helper ────────────────────────────────────────────────────────────
function useToast() {
  const [toast, setToast] = useState(null);
  const show = (msg, icon = 'check-circle-2') => {
    setToast({ msg, icon });
    setTimeout(() => setToast(null), 2400);
  };
  const el = toast ? (
    <div className="toast">
      <Icon name={toast.icon} size={16} style={{ color: 'var(--good)' }} />
      {toast.msg}
    </div>
  ) : null;
  return [show, el];
}

// ── Shell ───────────────────────────────────────────────────────────────────
function AuthWrapper() {
  const [authPage, setAuthPage] = useState(() => localStorage.getItem('ang_user') ? null : 'login');

  const handleLoginSuccess = (user) => {
    localStorage.setItem('ang_user', JSON.stringify(user));
    setAuthPage(null);
  };

  const handleLogout = () => {
    localStorage.removeItem('ang_user');
    localStorage.removeItem('ang_route');
    setAuthPage('login');
  };

  if (authPage === 'login') return <LoginPage onLoginSuccess={handleLoginSuccess} onGoToSignup={() => setAuthPage('signup')} />;
  if (authPage === 'signup') return <SignupPage onSignupSuccess={() => setAuthPage('login')} onGoToLogin={() => setAuthPage('login')} />;
  return <Shell onLogout={handleLogout} />;
}

function Shell({ onLogout }) {
  const [route,       setRoute]       = useState(() => localStorage.getItem('ang_route') || 'dashboard');
  const [subPages,    setSubPages]    = useState({});
  const [notifOpen,   setNotifOpen]   = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen,  setSearchOpen]  = useState(false);
  const [searchQ,     setSearchQ]     = useState('');
  const [notifs,      setNotifs]      = useState(NOTIFICATIONS);
  const [tweaksEnabled, setTweaksEnabled] = useState(false);
  const [tweaks,      setTweaks]      = useState(window.ANG_TWEAKS || {});
  const [roleId,      setRoleId]      = useState(tweaks.role || 'member');
  const searchRef = useRef(null);

  const subs   = SIDEBAR_SUBS[route] || [];
  const curSub = subPages[route] || subs[0]?.id || null;
  const setSub = (id) => setSubPages(prev => ({ ...prev, [route]: id }));

  const fullHeight = ['ai_docs', 'chat', 'org'].includes(route);

  useEffect(() => {
    localStorage.setItem('ang_route', route);
    if (window.lucide) window.lucide.createIcons();
  });

  useEffect(() => {
    const handler = (e) => {
      if (e.data?.type === '__activate_edit_mode')   setTweaksEnabled(true);
      if (e.data?.type === '__deactivate_edit_mode') setTweaksEnabled(false);
    };
    window.addEventListener('message', handler);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', handler);
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty('--primary-h', tweaks.primaryHue ?? 195);
    document.body.dataset.density = tweaks.density || 'comfortable';
  }, [tweaks]);

  const me = roleId === 'lead' ? USERS[1] : roleId === 'admin' ? USERS[6] : USERS[0];

  const menu = [
    { id: 'dashboard', l: '대시보드',  ic: 'home' },
    { id: 'ai_docs',   l: '문서작성',  ic: 'file-text' },
    { id: 'approval',  l: '전자결재',  ic: 'file-check-2' },
    { id: 'calendar',  l: '캘린더',    ic: 'calendar' },
    { id: 'files',     l: '파일함',    ic: 'folder-open' },
    { id: 'boards',    l: '게시판',    ic: 'layout-grid' },
    { id: 'mail',      l: '메일',      ic: 'mail' },
    { id: 'chat',      l: '채팅',      ic: 'message-square' },
    { id: 'org',       l: '조직도',    ic: 'network' },
  ];

  const setT = (patch) => {
    const next = { ...tweaks, ...patch };
    setTweaks(next);
    if (patch.role) setRoleId(patch.role);
    window.parent.postMessage({ type: '__edit_mode_set_keys', edits: patch }, '*');
  };

  const go = (id) => setRoute(id);

  const Screen = {
    dashboard: Dashboard, ai_docs: AIDocs, calendar: CalendarScreen,
    approval: Approval, files: Files, boards: Boards, mail: Mail,
    chat: Chat, org: Org, mypage: MyPage, admin: Admin,
  }[route] || Dashboard;

  const notifCount = notifs.filter(n => n.unread).length;

  const searchResults = useMemo(() => {
    if (!searchQ.trim()) return [];
    const q = searchQ.toLowerCase();
    const menuHits = menu.filter(m => m.l.includes(searchQ))
      .map(m => ({ type: 'menu', label: m.l, id: m.id, icon: m.ic }));
    const docHits = DOCS.filter(d => d.title.toLowerCase().includes(q))
      .slice(0, 4).map(d => ({ type: 'doc', label: d.title, ext: d.ext, id: 'ai_docs' }));
    const userHits = USERS.filter(u => u.name.includes(searchQ) || u.dept.includes(searchQ))
      .slice(0, 3).map(u => ({ type: 'user', label: u.name + ' ' + u.rank, id: 'org', avatar: u }));
    return [...menuHits, ...docHits, ...userHits].slice(0, 8);
  }, [searchQ]);

  const closeOverlays = () => {
    if (notifOpen) setNotifOpen(false);
    if (profileOpen) setProfileOpen(false);
    if (searchOpen) { setSearchOpen(false); setSearchQ(''); }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: 'var(--bg)' }}>

      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <header className="shrink-0 bg-white sticky top-0 z-50 flex items-center px-5 gap-0"
        style={{ height: 56, borderBottom: '2px solid var(--line)', boxShadow: '0 2px 12px rgba(11,15,14,0.07)' }}>

        {/* Logo */}
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 900, fontSize: 24, letterSpacing: '-0.04em', color: 'var(--primary)', flexShrink: 0, marginRight: 14 }}>
          ANG
        </div>
        <div style={{ width: 1, height: 26, background: 'var(--line-2)', marginRight: 10, flexShrink: 0 }} />

        {/* ── Horizontal nav ── */}
        <nav className="flex items-center gap-0.5 no-scrollbar overflow-x-auto" style={{ flex: '1 1 0', minWidth: 0 }}>
          {menu.map(m => {
            const active = route === m.id;
            const badge = m.id === 'approval' ? notifs.filter(n => n.type === 'approval' && n.unread).length
                        : m.id === 'mail'     ? MAILS.filter(ml => ml.unread).length : 0;
            return (
              <button key={m.id} onClick={() => go(m.id)}
                className="flex items-center gap-1.5 whitespace-nowrap transition-all relative"
                style={{
                  padding: '6px 11px', borderRadius: 8,
                  fontSize: 13, fontWeight: active ? 800 : 600,
                  background: active ? 'var(--primary)' : 'transparent',
                  color: active ? '#fff' : 'var(--ink-3)',
                  border: 'none', cursor: 'pointer',
                }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'var(--line-2)'; e.currentTarget.style.color = 'var(--ink)'; }}}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink-3)'; }}}>
                <Icon name={m.ic} size={14} />
                {m.l}
                {badge > 0 && (
                  <span style={{
                    position: 'absolute', top: 2, right: 2,
                    background: 'var(--danger)', color: '#fff', borderRadius: '50%',
                    width: 14, height: 14, fontSize: 9, fontWeight: 900,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '1.5px solid #fff',
                  }}>{badge}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div style={{ width: 1, height: 26, background: 'var(--line-2)', margin: '0 10px', flexShrink: 0 }} />

        {/* ── Search + actions ── */}
        <div className="flex items-center gap-2 shrink-0">

          {/* Search */}
          <div className="relative" ref={searchRef} style={{ width: 200 }}>
            <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--ink-4)', zIndex: 1 }}>
              <Icon name="search" size={14} />
            </span>
            <input type="text" placeholder="통합 검색"
              className="w-full rounded-xl outline-none transition-all"
              style={{
                fontSize: 13, fontWeight: 500, padding: '6px 10px 6px 30px',
                background: searchOpen ? '#fff' : 'var(--line-3)',
                border: '1.5px solid ' + (searchOpen ? 'var(--primary)' : 'var(--line-2)'),
                color: 'var(--ink)',
              }}
              value={searchQ}
              onChange={e => { setSearchQ(e.target.value); setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
            />
            {searchOpen && searchResults.length > 0 && (
              <div className="search-dropdown" style={{ top: 'calc(100% + 6px)' }}>
                {searchResults.map((r, i) => (
                  <div key={i} onClick={() => { go(r.id); setSearchOpen(false); setSearchQ(''); }}
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                    style={{ borderBottom: i < searchResults.length - 1 ? '1px solid var(--line-2)' : 'none' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--line-3)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--line-2)' }}>
                      {r.type === 'user' ? <Avatar user={r.avatar} size={24} /> :
                       r.type === 'doc'  ? <Icon name="file-text" size={14} style={{ color: 'var(--primary)' }} /> :
                       <Icon name={r.icon || 'search'} size={14} style={{ color: 'var(--primary)' }} />}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{r.label}</div>
                      <div className="mono" style={{ fontSize: 10, color: 'var(--ink-4)' }}>
                        {r.type === 'menu' ? '메뉴' : r.type === 'doc' ? '문서' : '사람'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {searchOpen && searchQ && searchResults.length === 0 && (
              <div className="search-dropdown" style={{ top: 'calc(100% + 6px)', padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>검색 결과 없음</div>
              </div>
            )}
          </div>

          {/* Bell */}
          <button onClick={() => setNotifOpen(!notifOpen)}
            className="relative w-9 h-9 flex items-center justify-center rounded-xl transition-all"
            style={{ color: 'var(--ink-3)', background: notifOpen ? 'var(--primary-50)' : 'transparent', border: '1.5px solid ' + (notifOpen ? 'var(--primary-100)' : 'transparent') }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--line-2)'}
            onMouseLeave={e => e.currentTarget.style.background = notifOpen ? 'var(--primary-50)' : 'transparent'}>
            <Icon name="bell" size={18} />
            {notifCount > 0 && (
              <span className="absolute top-1 right-1 w-3.5 h-3.5 flex items-center justify-center rounded-full mono text-[9px] font-bold"
                style={{ background: 'var(--danger)', color: '#fff', border: '2px solid #fff' }}>
                {notifCount}
              </span>
            )}
          </button>

          {/* Profile */}
          <button onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl transition-all"
            style={{ background: profileOpen ? 'var(--primary-50)' : 'var(--line-3)', border: '1.5px solid ' + (profileOpen ? 'var(--primary-100)' : 'var(--line-2)') }}>
            <Avatar user={me} size={26} ring />
            <div className="hidden md:flex flex-col items-start">
              <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.2 }}>{me.name}</span>
              <span className="mono" style={{ fontSize: 10, color: 'var(--ink-4)' }}>{me.rank}</span>
            </div>
            <Icon name="chevron-down" size={12} style={{ color: 'var(--ink-4)' }} />
          </button>
        </div>
      </header>

      {/* ─── Body ────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden" onClick={closeOverlays}>

        {/* Context sidebar */}
        {subs.length > 0 && (
          <aside className="shrink-0 flex flex-col"
            style={{ width: 168, background: 'var(--sidebar-bg)', padding: '14px 8px', boxShadow: '2px 0 14px rgba(11,15,14,0.15)', overflowY: 'auto' }}>

            <div style={{ fontSize: 10, fontWeight: 900, color: 'rgba(255,255,255,0.32)', letterSpacing: '0.18em', textTransform: 'uppercase', padding: '2px 10px 12px' }}>
              {menu.find(m => m.id === route)?.l || '메뉴'}
            </div>

            <div className="space-y-0.5">
              {subs.map(s => {
                const active = curSub === s.id;
                return (
                  <button key={s.id} onClick={e => { e.stopPropagation(); setSub(s.id); }}
                    className="w-full flex items-center rounded-xl transition-all"
                    style={{
                      padding: '9px 12px', gap: 10, fontSize: 13, fontWeight: active ? 800 : 600,
                      background: active ? 'rgba(255,255,255,0.92)' : 'transparent',
                      color: active ? 'var(--primary-700)' : 'rgba(255,255,255,0.72)',
                      border: 'none', cursor: 'pointer',
                      boxShadow: active ? '0 4px 14px -3px rgba(0,0,0,0.28)' : 'none',
                    }}
                    onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}}
                    onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.72)'; }}}>
                    <Icon name={s.icon} size={16} />
                    {s.label}
                  </button>
                );
              })}
            </div>

            {/* 관리자 버튼 (팀장 이상) */}
            {(me.role === '팀장' || me.role === '최고관리자') && (
              <div style={{ marginTop: 'auto', paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <button onClick={e => { e.stopPropagation(); go('admin'); }}
                  className="w-full flex items-center rounded-xl transition-all"
                  style={{
                    padding: '9px 12px', gap: 10, fontSize: 13, fontWeight: 700,
                    background: route === 'admin' ? 'rgba(255,255,255,0.92)' : 'transparent',
                    color: route === 'admin' ? 'var(--primary-700)' : 'rgba(255,255,255,0.42)',
                    border: 'none', cursor: 'pointer',
                  }}>
                  <Icon name="shield" size={16} />
                  관리자
                </button>
              </div>
            )}
          </aside>
        )}

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--bg)' }}>
          <div style={{ flex: 1, overflow: fullHeight ? 'hidden' : 'auto', display: 'flex', flexDirection: 'column' }}
            className={fullHeight ? '' : 'col-scroll'}>
            <Screen key={route + '_' + roleId} me={me} go={go} subPage={curSub} setSubPage={setSub} />
          </div>
        </div>
      </div>

      {/* ─── Notification dropdown ── */}
      {notifOpen && (
        <div className="fixed right-5 z-[60] w-[380px] rounded-2xl slide-up"
          style={{ top: 58, background: '#fff', border: '1px solid var(--line)', boxShadow: '0 25px 60px rgba(15,23,42,0.15)' }}
          onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--line-2)' }}>
            <span className="font-black text-[14px]">알림</span>
            <span className="text-[11px] font-black uppercase tracking-widest cursor-pointer" style={{ color: 'var(--primary)' }}
              onClick={() => setNotifs(notifs.map(n => ({ ...n, unread: false })))}>모두 읽음</span>
          </div>
          <div className="max-h-[440px] overflow-y-auto col-scroll">
            {notifs.map(n => (
              <div key={n.id} onClick={() => setNotifs(notifs.map(x => x.id === n.id ? { ...x, unread: false } : x))}
                className="flex items-start gap-3 p-4 cursor-pointer"
                style={{ borderBottom: '1px solid var(--line-2)', background: n.unread ? 'var(--primary-50)' : 'transparent' }}
                onMouseEnter={e => e.currentTarget.style.background = n.unread ? 'var(--primary-100)' : 'var(--line-3)'}
                onMouseLeave={e => e.currentTarget.style.background = n.unread ? 'var(--primary-50)' : 'transparent'}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: n.type === 'ai' ? 'var(--accent-50)' : n.type === 'approval' ? 'var(--primary-50)' : 'var(--line-2)', color: n.type === 'ai' ? 'oklch(0.48 0.13 75)' : n.type === 'approval' ? 'var(--primary-700)' : 'var(--ink-3)' }}>
                  <Icon name={n.type === 'ai' ? 'sparkles' : n.type === 'approval' ? 'file-check-2' : n.type === 'chat' ? 'message-square' : 'mail'} size={15} />
                </div>
                <div className="flex-1">
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{n.text}</div>
                  <div className="mono" style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-4)', marginTop: 2 }}>{n.time}</div>
                </div>
                {n.unread && <span className="w-2 h-2 rounded-full shrink-0 mt-1" style={{ background: 'var(--primary)' }} />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Profile dropdown ── */}
      {profileOpen && (
        <div className="fixed right-5 z-[60] w-[280px] rounded-2xl slide-up"
          style={{ top: 58, background: '#fff', border: '1px solid var(--line)', boxShadow: '0 25px 60px rgba(15,23,42,0.15)' }}
          onClick={e => e.stopPropagation()}>
          <div className="flex flex-col items-center px-5 py-6" style={{ borderBottom: '1px solid var(--line-2)' }}>
            <Avatar user={me} size={64} ring />
            <div className="font-black text-[15px] mt-3">{me.name}</div>
            <div className="mono text-[11px] mt-1" style={{ color: 'var(--ink-3)' }}>{me.dept} · {me.rank}</div>
            <div className="mono text-[11px] mt-0.5" style={{ color: 'var(--ink-4)' }}>{me.name.toLowerCase().replace(/\s/g, '')}@ang.lab</div>
          </div>
          <div className="p-2">
            {[['user', '마이페이지', 'mypage'], ['settings', '환경 설정', 'mypage'], ['log-out', '로그아웃', null]].map(([ic, label, dest], i) => (
              <button key={i} onClick={() => { if (label === '로그아웃') { onLogout(); return; } if (dest) go(dest); setProfileOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium text-left"
                style={{ color: label === '로그아웃' ? 'var(--danger)' : 'var(--ink-2)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--line-2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <Icon name={ic} size={15} style={{ color: label === '로그아웃' ? 'var(--danger)' : 'var(--ink-3)' }} />
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── Tweaks panel ── */}
      {tweaksEnabled && (
        <div className="fixed bottom-6 right-6 z-[70] w-[320px] rounded-2xl slide-up"
          style={{ background: '#fff', border: '1px solid var(--line)', boxShadow: '0 25px 60px rgba(15,23,42,0.18)' }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--line-2)' }}>
            <div className="flex items-center gap-2">
              <Icon name="sliders-horizontal" size={15} style={{ color: 'var(--primary)' }} />
              <span className="font-black text-[14px] tracking-tight">Tweaks</span>
            </div>
          </div>
          <div className="p-5 space-y-5">
            <div>
              <div className="label-xs mb-2">테마 (Primary Hue)</div>
              <input type="range" min="0" max="360" value={tweaks.primaryHue ?? 195}
                onChange={e => setT({ primaryHue: +e.target.value })} className="w-full" />
              <div className="flex gap-1.5 mt-2">
                {[195, 210, 258, 145, 30, 320].map(h => (
                  <button key={h} onClick={() => setT({ primaryHue: h })}
                    className="w-8 h-8 rounded-lg transition-all"
                    style={{ background: `oklch(0.62 0.09 ${h})`, border: tweaks.primaryHue === h ? '2px solid var(--ink)' : '1px solid var(--line)', transform: tweaks.primaryHue === h ? 'scale(1.1)' : 'scale(1)' }} />
                ))}
              </div>
            </div>
            <div>
              <div className="label-xs mb-2">밀도</div>
              <div className="flex gap-1.5">
                {['compact', 'comfortable'].map(d => (
                  <button key={d} onClick={() => setT({ density: d })}
                    className="flex-1 py-2 text-[11px] font-black uppercase tracking-widest rounded-lg"
                    style={{ background: tweaks.density === d ? 'var(--ink)' : 'var(--line-2)', color: tweaks.density === d ? '#fff' : 'var(--ink-2)' }}>
                    {d === 'compact' ? 'Compact' : 'Comfort'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="label-xs mb-2">로그인 역할</div>
              <div className="flex gap-1.5">
                {[['member', '일반'], ['lead', '팀장'], ['admin', '원장']].map(([v, l]) => (
                  <button key={v} onClick={() => setT({ role: v })}
                    className="flex-1 py-2 text-[11px] font-black rounded-lg"
                    style={{ background: tweaks.role === v ? 'var(--primary)' : 'var(--line-2)', color: tweaks.role === v ? '#fff' : 'var(--ink-2)' }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AuthWrapper;
