// Chat — 1:1 + group (fullHeight, 2-panel)
function Chat({ me, go, subPage = 'group' }) {
  const [activeId, setActiveId] = useState(null);
  const [text, setText] = useState('');
  const [messages, setMessages] = useState([]);
  const [chatList, setChatList] = useState(CHATS);
  const [chatSearch, setChatSearch] = useState('');
  const [toast, setToast] = useState(null);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newChatName, setNewChatName] = useState('');
  const [newChatMembers, setNewChatMembers] = useState([]);
  const [searchMsgQ, setSearchMsgQ] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const scrollRef = useRef(null);

  const showMsg = (m) => { setToast(m); setTimeout(() => setToast(null), 2200); };

  // Filter chat rooms by subPage tab
  const filteredChats = chatList
    .filter(c => subPage === 'group' ? c.group : !c.group)
    .filter(c => !chatSearch || c.name.includes(chatSearch));

  // Auto-select first chat when subPage changes
  useEffect(() => {
    const first = chatList.find(c => subPage === 'group' ? c.group : !c.group);
    setActiveId(first ? first.id : null);
    setChatSearch('');
    setShowSearch(false);
  }, [subPage]);

  const active = chatList.find(c => c.id === activeId);

  // Load messages when active chat changes
  useEffect(() => {
    if (!activeId) { setMessages([]); return; }
    const base = CHAT_MESSAGES[activeId] || [
      { from: 'u_lead', text: '안녕하세요!', time: '10:00' },
      { from: 'u_me', text: '네, 확인했습니다.', time: '10:02' },
    ];
    setMessages(base);
    setChatList(prev => prev.map(c => c.id === activeId ? { ...c, unread: 0 } : c));
    setShowSearch(false);
  }, [activeId]);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const send = () => {
    if (!text.trim() || !activeId) return;
    const now = new Date().toTimeString().slice(0, 5);
    const newMsg = { from: 'u_me', text, time: now };
    setMessages(prev => [...prev, newMsg]);
    setChatList(prev => prev.map(c => c.id === activeId ? { ...c, last: text, time: now } : c));
    setText('');
  };

  const createChat = () => {
    if (!newChatName.trim()) return;
    const newChat = {
      id: 'c_' + Date.now(),
      name: newChatName,
      group: subPage === 'group',
      members: ['u_me', ...newChatMembers],
      last: '채팅방이 생성되었습니다.',
      time: new Date().toTimeString().slice(0, 5),
      unread: 0,
    };
    setChatList(prev => [newChat, ...prev]);
    setActiveId(newChat.id);
    setMessages([{ from: 'u_me', text: '안녕하세요!', time: new Date().toTimeString().slice(0, 5) }]);
    setNewChatOpen(false);
    setNewChatName('');
    setNewChatMembers([]);
    showMsg('채팅방이 생성되었습니다.');
  };

  const visibleMessages = showSearch && searchMsgQ
    ? messages.filter(m => m.text.includes(searchMsgQ))
    : messages;

  return (
    <div style={{ height: '100%', display: 'flex', overflow: 'hidden' }}>
      {toast && (
        <div style={{
          position:'fixed', bottom:28, left:'50%', transform:'translateX(-50%)',
          background:'var(--ink)', color:'#fff', padding:'10px 22px', borderRadius:12,
          fontSize:13, fontWeight:600, zIndex:9999, boxShadow:'0 4px 20px rgba(0,0,0,0.18)',
          pointerEvents:'none',
        }}>{toast}</div>
      )}

      {/* ── 채팅방 목록 패널 ── */}
      <div style={{
        width: 288,
        borderRight: '1px solid var(--line-2)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: '#fff',
        flexShrink: 0,
      }}>
        {/* 패널 헤더 */}
        <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--line-2)', flexShrink: 0 }}>
          <div className="mono text-[11px] uppercase tracking-wider mb-2" style={{ color: 'var(--ink-4)' }}>
            {subPage === 'group' ? '단체 채팅방' : '개인 채팅방'}
            <span style={{ color: 'var(--ink-3)', marginLeft: 6 }}>· {filteredChats.length}</span>
          </div>
          <Input icon="search" placeholder="채팅방 검색" value={chatSearch} onChange={setChatSearch} />
        </div>

        {/* 채팅방 목록 */}
        <div className="col-scroll" style={{ flex: 1, overflowY: 'auto' }}>
          {filteredChats.length === 0 && (
            <Empty icon={subPage === 'group' ? 'users' : 'message-circle'} title="채팅방이 없습니다" />
          )}
          {filteredChats.map(c => {
            const otherMemberId = !c.group && c.members.find(m => m !== 'u_me');
            const otherUser = otherMemberId ? userById(otherMemberId) : null;
            const isActive = activeId === c.id;
            return (
              <div key={c.id} onClick={() => setActiveId(c.id)}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                style={{
                  background: isActive ? 'var(--primary-50)' : 'transparent',
                  borderBottom: '1px solid var(--line-2)',
                  borderLeft: isActive ? '3px solid var(--primary)' : '3px solid transparent',
                }}>
                {/* 아바타 */}
                {c.group ? (
                  <div style={{
                    width: 40, height: 40, borderRadius: 12,
                    background: 'var(--line-2)', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon name="users" size={18} style={{ color: 'var(--ink-3)' }} />
                  </div>
                ) : (
                  <Avatar user={otherUser} size={40} />
                )}
                {/* 정보 */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }} className="truncate">{c.name}</span>
                    <span className="mono" style={{ fontSize: 10, color: 'var(--ink-4)', flexShrink: 0, marginLeft: 6 }}>{c.time}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: 'var(--ink-3)' }} className="truncate">{c.last}</span>
                    {c.unread > 0 && (
                      <span className="mono" style={{
                        fontSize: 10, fontWeight: 800, borderRadius: 999,
                        padding: '1px 6px', background: 'var(--danger)', color: '#fff',
                        flexShrink: 0, marginLeft: 6,
                      }}>{c.unread}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 새 채팅 버튼 */}
        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--line-2)', flexShrink: 0 }}>
          <Btn variant="primary" icon="plus" style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => { setNewChatName(''); setNewChatMembers([]); setNewChatOpen(true); }}>
            {subPage === 'group' ? '단체 채팅 만들기' : '새 대화 시작'}
          </Btn>
        </div>
      </div>

      {/* ── 채팅 영역 ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#FBFBF7' }}>

        {!active ? (
          <Empty icon="message-square" title="채팅방을 선택하세요" sub="왼쪽 목록에서 채팅방을 선택하면 대화가 표시됩니다." />
        ) : (
          <>
            {/* 채팅방 헤더 */}
            <div style={{
              padding: '12px 20px', background: '#fff',
              borderBottom: '1px solid var(--line-2)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {active.group ? (
                  <div style={{
                    width: 38, height: 38, borderRadius: 10,
                    background: 'var(--primary-50)', border: '1.5px solid var(--primary-100)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon name="users" size={18} style={{ color: 'var(--primary)' }} />
                  </div>
                ) : (
                  <Avatar user={userById(active.members.find(m => m !== 'u_me'))} size={38} />
                )}
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>{active.name}</div>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                    {active.group ? `${active.members.length}명 참여 중` : '개인 대화'}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button className="p-2 rounded-lg" style={{ color: 'var(--ink-3)' }}
                  title="음성 통화"
                  onClick={() => showMsg('음성 통화 기능은 준비 중입니다.')}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--line-2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <Icon name="phone" size={16} />
                </button>
                <button className="p-2 rounded-lg" style={{ color: 'var(--ink-3)' }}
                  title="화상 통화"
                  onClick={() => showMsg('화상 회의 기능은 준비 중입니다.')}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--line-2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <Icon name="video" size={16} />
                </button>
                <button className="p-2 rounded-lg" style={{ color: showSearch ? 'var(--primary)' : 'var(--ink-3)', background: showSearch ? 'var(--primary-50)' : 'transparent' }}
                  title="메시지 검색"
                  onClick={() => { setShowSearch(s => !s); setSearchMsgQ(''); }}
                  onMouseEnter={e => { if (!showSearch) e.currentTarget.style.background = 'var(--line-2)'; }}
                  onMouseLeave={e => { if (!showSearch) e.currentTarget.style.background = 'transparent'; }}>
                  <Icon name="search" size={16} />
                </button>
                <button className="p-2 rounded-lg" style={{ color: 'var(--ink-3)' }}
                  title="더보기"
                  onClick={() => showMsg('채팅방 설정 기능은 준비 중입니다.')}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--line-2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <Icon name="more-vertical" size={16} />
                </button>
              </div>
            </div>

            {/* 메시지 내 검색 바 */}
            {showSearch && (
              <div style={{ padding:'8px 16px', background:'#fff', borderBottom:'1px solid var(--line-2)', display:'flex', alignItems:'center', gap:8 }}>
                <Icon name="search" size={14} style={{ color:'var(--ink-4)' }} />
                <input
                  autoFocus
                  value={searchMsgQ}
                  onChange={e => setSearchMsgQ(e.target.value)}
                  placeholder="메시지 검색…"
                  style={{ flex:1, outline:'none', fontSize:13, color:'var(--ink)', background:'transparent' }}
                />
                {searchMsgQ && (
                  <span className="mono" style={{ fontSize:11, color:'var(--ink-3)' }}>
                    {messages.filter(m => m.text.includes(searchMsgQ)).length}건
                  </span>
                )}
                <button onClick={() => { setShowSearch(false); setSearchMsgQ(''); }} style={{ color:'var(--ink-4)', background:'none', border:'none', cursor:'pointer', padding:4 }}>
                  <Icon name="x" size={14} />
                </button>
              </div>
            )}

            {/* 메시지 영역 */}
            <div ref={scrollRef} className="col-scroll"
              style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* 날짜 구분선 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '8px 0' }}>
                <div style={{ flex: 1, height: 1, background: 'var(--line-2)' }} />
                <span className="mono" style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 600 }}>오늘</span>
                <div style={{ flex: 1, height: 1, background: 'var(--line-2)' }} />
              </div>

              {visibleMessages.length === 0 && searchMsgQ && (
                <div style={{ textAlign:'center', color:'var(--ink-4)', fontSize:13, padding:'24px 0' }}>
                  "{searchMsgQ}" 검색 결과 없음
                </div>
              )}

              {visibleMessages.map((m, i) => {
                const mine = m.from === 'u_me';
                const u = userById(m.from);
                const prevFrom = i > 0 ? visibleMessages[i - 1].from : null;
                const showAvatar = !mine && m.from !== prevFrom;
                return (
                  <div key={i} style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: 8,
                    justifyContent: mine ? 'flex-end' : 'flex-start',
                  }}>
                    {!mine && (
                      <div style={{ width: 32, flexShrink: 0, alignSelf: 'flex-end', marginBottom: 2 }}>
                        {showAvatar ? <Avatar user={u} size={32} /> : null}
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start', maxWidth: '68%' }}>
                      {showAvatar && !mine && (
                        <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 3, marginLeft: 4 }}>{u.name}</span>
                      )}
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, flexDirection: mine ? 'row-reverse' : 'row' }}>
                        <div className="bubble" style={{
                          background: mine ? 'var(--primary)' : '#fff',
                          color: mine ? '#fff' : 'var(--ink)',
                          border: mine ? 'none' : '1px solid var(--line)',
                          fontSize: 14,
                          padding: '9px 14px',
                          borderRadius: mine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                          lineHeight: 1.5,
                          maxWidth: '100%',
                          wordBreak: 'break-word',
                        }}>{m.text}</div>
                        <span className="mono" style={{ fontSize: 10, color: 'var(--ink-4)', flexShrink: 0, marginBottom: 3 }}>{m.time}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 메시지 입력 */}
            <div style={{
              padding: '12px 16px',
              background: '#fff',
              borderTop: '1px solid var(--line-2)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexShrink: 0,
            }}>
              <button style={{ padding: 8, borderRadius: 8, color: 'var(--ink-3)' }}
                title="이모지"
                onClick={() => showMsg('이모지 기능은 준비 중입니다.')}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--line-2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <Icon name="plus-circle" size={20} />
              </button>
              <button style={{ padding: 8, borderRadius: 8, color: 'var(--ink-3)' }}
                title="파일 첨부"
                onClick={() => showMsg('파일 첨부 기능은 준비 중입니다.')}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--line-2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <Icon name="paperclip" size={20} />
              </button>
              <input
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
                placeholder="메시지를 입력하세요…"
                style={{
                  flex: 1, outline: 'none', fontSize: 14,
                  padding: '10px 14px', borderRadius: 12,
                  border: '1.5px solid var(--line)', background: '#FAFAF7',
                  color: 'var(--ink)',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                onBlur={e => e.target.style.borderColor = 'var(--line)'}
              />
              <Btn variant="teal" icon="send" onClick={send} disabled={!text.trim()}>전송</Btn>
            </div>
          </>
        )}
      </div>

      {/* 새 채팅방 모달 */}
      <Modal open={newChatOpen} onClose={()=>setNewChatOpen(false)}
        title={subPage === 'group' ? '단체 채팅 만들기' : '새 대화 시작'} width={480}>
        <div className="p-6 space-y-4">
          <div>
            <div className="mono text-[11px] uppercase tracking-wider mb-1.5" style={{color:'var(--ink-3)'}}>
              {subPage === 'group' ? '채팅방 이름' : '대화 상대 이름'}
            </div>
            <input
              className="w-full outline-none px-3 py-2.5 rounded-xl text-[13.5px]"
              style={{border:'1px solid var(--line)'}}
              placeholder={subPage === 'group' ? '예: 행사준비팀' : '채팅방 이름을 입력하세요'}
              value={newChatName}
              onChange={e => setNewChatName(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <div className="mono text-[11px] uppercase tracking-wider mb-1.5" style={{color:'var(--ink-3)'}}>
              {subPage === 'group' ? '참여자 선택' : '대화 상대 선택'}
            </div>
            <div style={{display:'flex', flexDirection:'column', gap:6}}>
              {USERS.filter(u => u.id !== me.id).map(u => (
                <div key={u.id}
                  onClick={() => {
                    if (subPage !== 'group') {
                      setNewChatMembers([u.id]);
                      setNewChatName(u.name);
                    } else {
                      setNewChatMembers(prev =>
                        prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id]
                      );
                    }
                  }}
                  className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer"
                  style={{
                    border: '1.5px solid ' + (newChatMembers.includes(u.id) ? 'var(--primary)' : 'var(--line-2)'),
                    background: newChatMembers.includes(u.id) ? 'var(--primary-50)' : '#fff',
                  }}>
                  <Avatar user={u} size={30} />
                  <div className="flex-1">
                    <div style={{fontSize:13, fontWeight:700}}>{u.name}</div>
                    <div className="mono" style={{fontSize:11, color:'var(--ink-3)'}}>{u.dept} · {u.rank}</div>
                  </div>
                  {newChatMembers.includes(u.id) && <Icon name="check-circle-2" size={16} style={{color:'var(--primary)'}} />}
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <div className="flex-1"/>
            <Btn variant="ghost" onClick={()=>setNewChatOpen(false)}>취소</Btn>
            <Btn variant="primary" icon="message-square"
              disabled={!newChatName.trim() || newChatMembers.length === 0}
              onClick={createChat}>
              {subPage === 'group' ? '채팅방 만들기' : '대화 시작'}
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

window.Chat = Chat;
