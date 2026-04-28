// Main app shell
const { useState: uS, useEffect: uE } = React;

function Shell() {
  const [route, setRoute] = uS(() => localStorage.getItem('ang_route') || 'dashboard');
  const [notifOpen, setNotifOpen] = uS(false);
  const [profileOpen, setProfileOpen] = uS(false);
  const [tweakOpen, setTweakOpen] = uS(false);
  const [tweaksEnabled, setTweaksEnabled] = uS(false);
  const [tweaks, setTweaks] = uS(window.ANG_TWEAKS || {});
  const [roleId, setRoleId] = uS(tweaks.role || 'member');

  uE(() => {
    localStorage.setItem('ang_route', route);
    if (window.lucide) window.lucide.createIcons();
  }, [route]);

  uE(() => {
    // Tweak mode protocol
    const handler = (e) => {
      if (e.data?.type === '__activate_edit_mode') setTweaksEnabled(true);
      if (e.data?.type === '__deactivate_edit_mode') setTweaksEnabled(false);
    };
    window.addEventListener('message', handler);
    window.parent.postMessage({type:'__edit_mode_available'}, '*');
    return () => window.removeEventListener('message', handler);
  }, []);

  uE(() => {
    document.documentElement.style.setProperty('--primary-h', tweaks.primaryHue);
    document.body.dataset.density = tweaks.density || 'comfortable';
  }, [tweaks]);

  const me = roleId === 'lead' ? USERS[1] : roleId === 'admin' ? USERS[6] : USERS[0];

  const menu = [
    { id:'dashboard', l:'대시보드',   ic:'layout-dashboard' },
    { id:'ai_docs',   l:'AI 문서',     ic:'sparkles' },
    { id:'calendar',  l:'캘린더',      ic:'calendar' },
    { id:'approval',  l:'전자결재',    ic:'file-check-2' },
    { id:'files',     l:'파일함',      ic:'folder-open' },
    { id:'boards',    l:'게시판',      ic:'layout-grid' },
    { id:'mail',      l:'메일',        ic:'mail' },
    { id:'chat',      l:'채팅',        ic:'message-square' },
    { id:'org',       l:'조직도',      ic:'network' },
  ];

  const setT = (patch) => {
    const next = {...tweaks, ...patch};
    setTweaks(next);
    if (patch.role) setRoleId(patch.role);
    window.parent.postMessage({type:'__edit_mode_set_keys', edits: patch}, '*');
  };

  const go = (id) => setRoute(id);

  const Screen = {
    dashboard: Dashboard, ai_docs: AIDocs, calendar: CalendarScreen,
    approval: Approval, files: Files, boards: Boards, mail: Mail, chat: Chat, org: Org,
    mypage: MyPage, admin: Admin,
  }[route] || Dashboard;

  const notifCount = NOTIFICATIONS.filter(n=>n.unread).length;

  return (
    <div className="min-h-screen flex" style={{background:'var(--bg)'}}>
      {/* Rail */}
      <aside className="sticky top-0 h-screen flex flex-col items-center py-4 z-40" style={{width:72, background:'#fff', borderRight:'1px solid var(--line)'}}>
        <div className="mono font-black text-[15px] tracking-tight mb-1" style={{color:'var(--primary-700)', letterSpacing:'-0.04em'}}>ANG</div>
        <div className="mono text-[8px] uppercase tracking-[0.15em] mb-6" style={{color:'var(--ink-4)'}}>v0.1</div>
        <nav className="flex flex-col gap-1 flex-1 w-full px-2">
          {menu.map(m => {
            const active = route === m.id;
            return (
              <button key={m.id} onClick={()=>go(m.id)}
                className="flex flex-col items-center gap-1 py-2.5 rounded-lg transition"
                style={{
                  background: active ? 'var(--primary-50)' : 'transparent',
                  color: active ? 'var(--primary-700)' : 'var(--ink-3)',
                }}
                onMouseEnter={e=>{if(!active)e.currentTarget.style.background='#F3F3EE'}}
                onMouseLeave={e=>{if(!active)e.currentTarget.style.background='transparent'}}
              >
                <Icon name={m.ic} size={18} strokeWidth={active?2:1.7}/>
                <span className="text-[10px] font-semibold" style={{letterSpacing:'-0.01em'}}>{m.l}</span>
              </button>
            );
          })}
        </nav>
        <div className="flex flex-col gap-1 w-full px-2">
          {(me.role==='팀장' || me.role==='최고관리자') && (
            <button onClick={()=>go('admin')} className="flex flex-col items-center gap-1 py-2.5 rounded-lg"
              style={{background: route==='admin' ? 'var(--primary-50)' : 'transparent', color: route==='admin' ? 'var(--primary-700)' : 'var(--ink-3)'}}>
              <Icon name="shield" size={18}/>
              <span className="text-[10px] font-semibold">관리자</span>
            </button>
          )}
          <button onClick={()=>go('mypage')} className="flex items-center justify-center py-2 rounded-lg">
            <Avatar user={me} size={30}/>
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex items-center gap-4 px-8 h-14" style={{background:'rgba(250,250,247,0.88)', backdropFilter:'blur(8px)', borderBottom:'1px solid var(--line)'}}>
          <div className="flex items-center gap-2 mono text-[11px]" style={{color:'var(--ink-3)'}}>
            <span style={{color:'var(--ink-4)'}}>{tweaks.orgName || '평생교육원 학사팀'}</span>
            <Icon name="chevron-right" size={10}/>
            <span className="font-semibold" style={{color:'var(--ink)'}}>{menu.find(m=>m.id===route)?.l || (route==='mypage'?'마이페이지':route==='admin'?'관리자':'대시보드')}</span>
          </div>
          <div className="flex-1 flex justify-center">
            <div className="flex items-center gap-2 rounded-lg px-3 py-1.5" style={{width:420, border:'1px solid var(--line)', background:'#fff'}}>
              <Icon name="search" size={13} style={{color:'var(--ink-4)'}}/>
              <input placeholder="통합 검색 — 문서, 사람, 업무, 공지..." className="flex-1 outline-none text-[12.5px] bg-transparent"/>
              <span className="kbd">⌘ K</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={()=>setNotifOpen(!notifOpen)} className="relative p-2 rounded-lg hover:bg-[--line-2]">
              <Icon name="bell" size={16} style={{color:'var(--ink-2)'}}/>
              {notifCount>0 && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full" style={{background:'var(--danger)'}}/>}
            </button>
            <button onClick={()=>go('chat')} className="p-2 rounded-lg hover:bg-[--line-2]"><Icon name="message-circle" size={16} style={{color:'var(--ink-2)'}}/></button>
            <button onClick={()=>go('mail')} className="p-2 rounded-lg hover:bg-[--line-2]"><Icon name="mail" size={16} style={{color:'var(--ink-2)'}}/></button>
            <div style={{width:1, height:20, background:'var(--line)', margin:'0 6px'}}/>
            <button onClick={()=>setProfileOpen(!profileOpen)} className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-[--line-2]">
              <Avatar user={me} size={24}/>
              <div className="text-left">
                <div className="text-[12px] font-semibold leading-tight">{me.name}</div>
                <div className="mono text-[9.5px]" style={{color:'var(--ink-3)'}}>{me.rank}</div>
              </div>
              <Icon name="chevron-down" size={11} style={{color:'var(--ink-4)'}}/>
            </button>
          </div>
        </header>

        {/* Notification dropdown */}
        {notifOpen && (
          <div className="absolute right-6 top-14 z-50 w-[380px] rounded-xl slide-up" style={{background:'#fff', border:'1px solid var(--line)', boxShadow:'0 20px 60px rgba(0,0,0,0.08)'}}>
            <div className="flex items-center justify-between p-4" style={{borderBottom:'1px solid var(--line-2)'}}>
              <span className="font-bold text-[13px]">알림</span>
              <span className="mono text-[11px] link">모두 읽음 처리</span>
            </div>
            <div className="max-h-[400px] overflow-y-auto col-scroll">
              {NOTIFICATIONS.map(n=>(
                <div key={n.id} className="flex items-start gap-3 p-3" style={{borderBottom:'1px solid var(--line-2)', background: n.unread?'var(--primary-50)':'transparent'}}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{
                    background: n.type==='ai'?'var(--accent-50)':n.type==='approval'?'var(--primary-50)':'#F3F3EE',
                    color: n.type==='ai'?'oklch(0.48 0.13 75)':n.type==='approval'?'var(--primary-700)':'var(--ink-3)'
                  }}>
                    <Icon name={n.type==='ai'?'sparkles':n.type==='approval'?'file-check-2':n.type==='chat'?'message-square':'mail'} size={13}/>
                  </div>
                  <div className="flex-1">
                    <div className="text-[12.5px]">{n.text}</div>
                    <div className="mono text-[10px] mt-0.5" style={{color:'var(--ink-4)'}}>{n.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Content */}
        <main className="flex-1 col-scroll" style={{overflowY:'auto'}} onClick={()=>{if(notifOpen)setNotifOpen(false);}}>
          <Screen key={route+'_'+roleId} me={me} go={go} />
        </main>
      </div>

      {/* Tweaks panel */}
      {tweaksEnabled && (
        <div className="fixed bottom-6 right-6 z-50 w-[300px] rounded-xl slide-up" style={{background:'#fff', border:'1px solid var(--line)', boxShadow:'0 20px 60px rgba(0,0,0,0.12)'}}>
          <div className="flex items-center justify-between p-4" style={{borderBottom:'1px solid var(--line-2)'}}>
            <div className="flex items-center gap-2">
              <Icon name="sliders-horizontal" size={14}/>
              <span className="font-bold text-[13px]">Tweaks</span>
            </div>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <div className="mono text-[10.5px] uppercase tracking-wider mb-2" style={{color:'var(--ink-3)'}}>테마 (Primary Hue)</div>
              <input type="range" min="0" max="360" value={tweaks.primaryHue} onChange={e=>setT({primaryHue: +e.target.value})} className="w-full"/>
              <div className="flex gap-1 mt-2">
                {[195, 145, 30, 265, 320].map(h=>(
                  <button key={h} onClick={()=>setT({primaryHue:h})}
                    className="w-7 h-7 rounded-md" style={{background:`oklch(0.62 0.09 ${h})`, border: tweaks.primaryHue===h?'2px solid var(--ink)':'1px solid var(--line)'}}/>
                ))}
              </div>
            </div>
            <div>
              <div className="mono text-[10.5px] uppercase tracking-wider mb-2" style={{color:'var(--ink-3)'}}>밀도</div>
              <div className="flex gap-1">
                {['compact','comfortable'].map(d=>(
                  <button key={d} onClick={()=>setT({density:d})}
                    className="flex-1 py-1.5 text-[11.5px] font-semibold rounded-md"
                    style={{background: tweaks.density===d?'var(--ink)':'#F3F3EE', color: tweaks.density===d?'#fff':'var(--ink-2)'}}>
                    {d==='compact'?'Compact':'Comfortable'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="mono text-[10.5px] uppercase tracking-wider mb-2" style={{color:'var(--ink-3)'}}>로그인 역할 전환</div>
              <div className="flex gap-1">
                {[['member','일반'],['lead','팀장'],['admin','원장']].map(([v,l])=>(
                  <button key={v} onClick={()=>setT({role:v})}
                    className="flex-1 py-1.5 text-[11.5px] font-semibold rounded-md"
                    style={{background: tweaks.role===v?'var(--primary)':'#F3F3EE', color: tweaks.role===v?'#fff':'var(--ink-2)'}}>
                    {l}
                  </button>
                ))}
              </div>
              <div className="mono text-[10px] mt-2" style={{color:'var(--ink-4)'}}>
                권한별로 결재 버튼, 관리자 메뉴가 다르게 표시됩니다.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('app'));
root.render(<Shell />);
