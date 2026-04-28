// Mail
function Mail({ me, go }) {
  const [folder, setFolder] = useState('inbox');
  const [openId, setOpenId] = useState(null);
  const [compose, setCompose] = useState(false);
  const open = MAILS.find(m=>m.id===openId);

  return (
    <div className="fadein" style={{maxWidth: 1360, margin:'0 auto', padding:'28px 40px 64px'}}>
      <div className="flex items-end justify-between mb-5">
        <div>
          <div className="mono text-[11px] uppercase tracking-[0.18em] mb-1" style={{color:'var(--ink-4)'}}>Mail-01 · Inbox</div>
          <h1 className="text-[24px] font-bold tracking-tight">메일함</h1>
        </div>
        <Btn variant="primary" icon="pen-square" onClick={()=>setCompose(true)}>메일 작성</Btn>
      </div>
      <Card pad={false} style={{height: 640, overflow:'hidden'}}>
        <div className="grid h-full" style={{gridTemplateColumns:'200px 360px 1fr'}}>
          <div className="p-3" style={{borderRight:'1px solid var(--line-2)'}}>
            {[['inbox','받은메일함','inbox', MAILS.filter(m=>m.unread).length],['sent','보낸메일함','send',null],['starred','중요','star', MAILS.filter(m=>m.starred).length],['trash','휴지통','trash-2',null]].map(([k,l,ic,c])=>(
              <button key={k} onClick={()=>setFolder(k)} className="w-full flex items-center gap-2 px-3 py-2 text-[12.5px] font-medium rounded-md"
                style={{background: folder===k?'var(--ink)':'transparent', color: folder===k?'#fff':'var(--ink-2)'}}>
                <Icon name={ic} size={13}/> {l} {c && <span className="ml-auto mono text-[10.5px]">{c}</span>}
              </button>
            ))}
          </div>
          <div className="col-scroll" style={{borderRight:'1px solid var(--line-2)', overflowY:'auto'}}>
            {MAILS.map(m=>{
              const u = userById(m.from);
              return (
                <div key={m.id} onClick={()=>setOpenId(m.id)} className="px-4 py-3 cursor-pointer"
                  style={{background: openId===m.id ? 'var(--primary-50)' : 'transparent', borderBottom:'1px solid var(--line-2)'}}>
                  <div className="flex items-center gap-2 mb-1">
                    {m.unread && <span className="w-1.5 h-1.5 rounded-full" style={{background:'var(--primary)'}}/>}
                    <Avatar user={u} size={18}/>
                    <span className="text-[12.5px] font-semibold">{u.name}</span>
                    <span className="mono text-[10.5px] ml-auto" style={{color:'var(--ink-4)'}}>{m.time}</span>
                  </div>
                  <div className="text-[13px] truncate" style={{fontWeight: m.unread?600:400}}>{m.subject}</div>
                  <div className="text-[11.5px] truncate" style={{color:'var(--ink-3)'}}>{m.preview}</div>
                  <div className="flex items-center gap-2 mt-1">
                    {m.starred && <Icon name="star" size={12} style={{color:'var(--warn)'}}/>}
                    {m.hasAttach && <Icon name="paperclip" size={12} style={{color:'var(--ink-4)'}}/>}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="overflow-y-auto col-scroll">
            {!open && <Empty icon="mail" title="메일을 선택하세요" sub="왼쪽 목록에서 메일을 선택하면 내용이 표시됩니다." />}
            {open && (
              <div className="p-6">
                <div className="text-[20px] font-bold tracking-tight mb-3">{open.subject}</div>
                <div className="flex items-center gap-3 mb-5 pb-4" style={{borderBottom:'1px solid var(--line-2)'}}>
                  <Avatar user={userById(open.from)} size={36}/>
                  <div className="flex-1">
                    <div className="text-[13px] font-semibold">{userById(open.from).name}</div>
                    <div className="mono text-[11px]" style={{color:'var(--ink-3)'}}>To {me.name} · {open.time}</div>
                  </div>
                  <Btn variant="ghost" icon="reply" size="sm">답장</Btn>
                  <Btn variant="ghost" icon="corner-up-right" size="sm">전달</Btn>
                </div>
                <div className="text-[13.5px] leading-relaxed space-y-3" style={{color:'var(--ink-2)'}}>
                  <div>안녕하세요 {me.name}님,</div>
                  <div>{open.preview} 관련하여 자세한 내용 공유드립니다. 첨부된 문서 확인 후 의견 부탁드립니다.</div>
                  <div>감사합니다.</div>
                  <div className="mono text-[11.5px]" style={{color:'var(--ink-4)'}}>— {userById(open.from).name} ({userById(open.from).rank}) · 학사운영팀</div>
                </div>
                {open.hasAttach && (
                  <div className="mt-5 p-3 rounded-lg flex items-center gap-3" style={{background:'#FBFBF7', border:'1px solid var(--line-2)'}}>
                    <FileTypeIcon ext="pdf" size={22}/>
                    <div className="flex-1">
                      <div className="text-[12.5px] font-medium">첨부파일_2026_업무양식.pdf</div>
                      <div className="mono text-[10.5px]" style={{color:'var(--ink-3)'}}>412 KB</div>
                    </div>
                    <Btn size="sm" variant="outline" icon="download">다운로드</Btn>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>

      <Modal open={compose} onClose={()=>setCompose(false)} title="메일 작성" width={640}>
        <div className="p-6 space-y-3">
          <Input icon="user" placeholder="받는 사람"/>
          <Input placeholder="제목"/>
          <textarea placeholder="내용을 입력하세요" rows={8} className="w-full outline-none rounded-lg ring-focus p-3 text-[13px]" style={{border:'1px solid var(--line)', resize:'vertical'}}/>
          <div className="flex items-center gap-2 pt-2">
            <Btn variant="outline" icon="paperclip">첨부</Btn>
            <div className="flex-1"/>
            <Btn variant="ghost" onClick={()=>setCompose(false)}>취소</Btn>
            <Btn variant="primary" icon="send">전송</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

window.Mail = Mail;
