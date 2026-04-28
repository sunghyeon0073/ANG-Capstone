// Chat — 1:1 + group
function Chat({ me, go }) {
  const [activeId, setActiveId] = useState('c1');
  const [text, setText] = useState('');
  const [messages, setMessages] = useState(CHAT_MESSAGES.c1 || []);
  const active = CHATS.find(c=>c.id===activeId);

  useEffect(() => {
    setMessages(CHAT_MESSAGES[activeId] || [
      { from: activeId==='c2'?'u_kim':activeId==='c3'?'u_park':'u_lead', text:'안녕하세요!', time:'10:00' },
      { from:'u_me', text:'네, 확인했습니다.', time:'10:02' },
    ]);
  }, [activeId]);

  const send = () => {
    if (!text.trim()) return;
    setMessages([...messages, { from:'u_me', text, time: new Date().toTimeString().slice(0,5) }]);
    setText('');
  };

  return (
    <div className="fadein" style={{maxWidth: 1360, margin:'0 auto', padding:'28px 40px 64px'}}>
      <div className="mb-5">
        <div className="mono text-[11px] uppercase tracking-[0.18em] mb-1" style={{color:'var(--ink-4)'}}>Chat-01 · Messenger</div>
        <h1 className="text-[24px] font-bold tracking-tight">채팅</h1>
      </div>
      <Card pad={false} style={{height: 640, overflow:'hidden'}}>
        <div className="grid h-full" style={{gridTemplateColumns:'300px 1fr'}}>
          <div className="col-scroll" style={{borderRight:'1px solid var(--line-2)', overflowY:'auto'}}>
            <div className="p-3" style={{borderBottom:'1px solid var(--line-2)'}}>
              <Input icon="search" placeholder="채팅방 검색" />
            </div>
            {CHATS.map(c=>(
              <div key={c.id} onClick={()=>setActiveId(c.id)}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                style={{background: activeId===c.id ? 'var(--primary-50)' : 'transparent', borderBottom:'1px solid var(--line-2)'}}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{background:c.group?'#F3F3EE':userById(c.members.find(m=>m!=='u_me')).color, color: c.group?'var(--ink-3)':'#fff'}}>
                  <Icon name={c.group?'users':'user'} size={16}/>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-semibold truncate">{c.name}</span>
                    <span className="mono text-[10px]" style={{color:'var(--ink-4)'}}>{c.time}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11.5px] truncate" style={{color:'var(--ink-3)', maxWidth:180}}>{c.last}</span>
                    {c.unread>0 && <span className="mono text-[10px] font-bold rounded-full px-1.5" style={{background:'var(--danger)', color:'#fff'}}>{c.unread}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-col h-full" style={{background:'#FBFBF7'}}>
            <div className="flex items-center justify-between px-5 py-3" style={{background:'#fff', borderBottom:'1px solid var(--line-2)'}}>
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-semibold">{active.name}</span>
                <span className="mono text-[11px]" style={{color:'var(--ink-3)'}}>{active.members.length}명</span>
              </div>
              <div className="flex items-center gap-1">
                <button className="p-1.5 rounded hover:bg-[--line-2]"><Icon name="phone" size={14}/></button>
                <button className="p-1.5 rounded hover:bg-[--line-2]"><Icon name="search" size={14}/></button>
                <button className="p-1.5 rounded hover:bg-[--line-2]"><Icon name="more-vertical" size={14}/></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-3 col-scroll">
              {messages.map((m,i)=>{
                const mine = m.from==='u_me';
                const u = userById(m.from);
                return (
                  <div key={i} className={`flex items-end gap-2 ${mine?'justify-end':'justify-start'}`}>
                    {!mine && <Avatar user={u} size={26}/>}
                    <div className={mine?'items-end':'items-start'} style={{display:'flex', flexDirection:'column'}}>
                      {!mine && <span className="mono text-[10.5px] mb-0.5" style={{color:'var(--ink-3)'}}>{u.name}</span>}
                      <div className="bubble" style={{
                        background: mine ? 'var(--primary)' : '#fff',
                        color: mine ? '#fff' : 'var(--ink)',
                        border: mine ? 'none' : '1px solid var(--line)',
                      }}>{m.text}</div>
                      <span className="mono text-[10px] mt-0.5" style={{color:'var(--ink-4)'}}>{m.time}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="p-3 flex items-center gap-2" style={{background:'#fff', borderTop:'1px solid var(--line-2)'}}>
              <button className="p-2 rounded hover:bg-[--line-2]" style={{color:'var(--ink-3)'}}><Icon name="paperclip" size={16}/></button>
              <input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()}
                placeholder="메시지를 입력하세요" className="flex-1 outline-none text-[13.5px] px-2"/>
              <Btn variant="teal" icon="send" onClick={send}>전송</Btn>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

window.Chat = Chat;
