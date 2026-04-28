// Boards — notice + free
function Boards({ me, go, subPage }) {
  const [tab, setTab] = useState(subPage || 'notice');
  useEffect(() => { if (subPage) setTab(subPage); }, [subPage]);
  const [q, setQ] = useState('');
  const [boards, setBoards] = useState({ notice: [...BOARDS.notice], free: [...BOARDS.free] });
  const [selected, setSelected] = useState(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [newPost, setNewPost] = useState({ title:'', content:'' });
  const [likes, setLikes] = useState({});
  const [comments, setComments] = useState({
    n1: [
      { author:'u_lead', text:'확인했습니다. 팀원들에게 공유하겠습니다.', time:'09:45' },
      { author:'u_kim', text:'네, 알겠습니다!', time:'10:12' },
    ],
    f1: [
      { author:'u_gal', text:'저도 동의합니다 ㅎㅎ', time:'14:30' },
    ],
  });
  const [commentText, setCommentText] = useState('');
  const [toast, setToast] = useState(null);

  const showMsg = (m) => { setToast(m); setTimeout(() => setToast(null), 2200); };

  const list = boards[tab].filter(p => !q || p.title.includes(q));

  const toggleLike = (id, e) => {
    e.stopPropagation();
    setLikes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const addComment = (postId) => {
    if (!commentText.trim()) return;
    const now = new Date().toTimeString().slice(0, 5);
    setComments(prev => ({
      ...prev,
      [postId]: [...(prev[postId] || []), { author: me.id, text: commentText, time: now }],
    }));
    setBoards(prev => ({
      ...prev,
      [tab]: prev[tab].map(p => p.id === postId ? { ...p, comments: (p.comments || 0) + 1 } : p),
    }));
    if (selected?.id === postId) {
      setSelected(s => ({ ...s, comments: (s.comments || 0) + 1 }));
    }
    setCommentText('');
  };

  return (
    <div className="fadein" style={{maxWidth: 1360, margin:'0 auto', padding:'26px 36px 60px'}}>
      {toast && (
        <div style={{
          position:'fixed', bottom:28, left:'50%', transform:'translateX(-50%)',
          background:'var(--ink)', color:'#fff', padding:'10px 22px', borderRadius:12,
          fontSize:13, fontWeight:600, zIndex:9999, boxShadow:'0 4px 20px rgba(0,0,0,0.18)',
          pointerEvents:'none',
        }}>{toast}</div>
      )}

      <div className="flex items-end justify-between mb-5">
        <div>
          <div className="mono text-[11px] uppercase tracking-[0.18em] mb-1" style={{color:'var(--ink-4)'}}>Common-04 · Boards</div>
          <h1 className="text-[24px] font-bold tracking-tight">게시판</h1>
        </div>
        <Btn variant="primary" icon="pen-square" onClick={()=>{ setNewPost({title:'',content:''}); setComposeOpen(true); }}>글쓰기</Btn>
      </div>

      <Card pad={false}>
        <div className="flex items-center justify-between px-5 pt-4 pb-3" style={{borderBottom:'1px solid var(--line-2)'}}>
          <div className="flex items-center gap-2">
            <Icon name={tab === 'notice' ? 'pin' : 'message-circle'} size={14} style={{ color: 'var(--primary)' }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
              {tab === 'notice' ? '공지사항' : '자유게시판'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <select className="text-[12px] outline-none" style={{padding:'7px 10px', border:'1px solid var(--line)', borderRadius:8, background:'#fff'}}>
              <option>기간 · 전체</option><option>최근 7일</option><option>이번 달</option>
            </select>
            <Input icon="search" placeholder="통합 검색" value={q} onChange={setQ} style={{width:240}} />
          </div>
        </div>
        <div>
          <div className="grid px-5 py-2.5 mono text-[10.5px] uppercase tracking-wider"
            style={{gridTemplateColumns:'40px 1fr 140px 120px 80px 60px', color:'var(--ink-3)', borderBottom:'1px solid var(--line-2)', background:'#FBFBF7'}}>
            <div>#</div><div>제목</div><div>작성자</div><div>등록일</div><div className="text-right">조회</div><div className="text-right">좋아요</div>
          </div>
          {list.map((p,i) => (
            <div key={p.id} onClick={()=>setSelected(p)} className="grid items-center px-5 py-3.5 hover:bg-[--line-2] cursor-pointer" style={{
              gridTemplateColumns:'40px 1fr 140px 120px 80px 60px', borderBottom:'1px solid var(--line-2)'
            }}>
              <div className="mono text-[11.5px]" style={{color:'var(--ink-4)'}}>
                {p.pinned ? <Icon name="pin" size={13} style={{color:'var(--danger)'}}/> : String(list.length-i).padStart(2,'0')}
              </div>
              <div className="text-[13.5px]" style={{fontWeight: p.pinned ? 700 : 500}}>
                {p.pinned && <span className="mono text-[10px] mr-2 px-1.5 py-0.5 rounded" style={{background:'oklch(0.97 0.03 25)', color:'oklch(0.45 0.14 25)'}}>필독</span>}
                {p.title}
                {p.comments > 0 && <span className="mono text-[11px] ml-2" style={{color:'var(--primary-700)'}}>[{p.comments}]</span>}
              </div>
              <div className="flex items-center gap-1.5"><Avatar user={userById(p.author)} size={18}/><span className="text-[12px]">{userById(p.author).name}</span></div>
              <div className="mono text-[11.5px]" style={{color:'var(--ink-3)'}}>{p.date}</div>
              <div className="mono text-[11.5px] text-right" style={{color:'var(--ink-3)'}}>{p.views || '—'}</div>
              <div className="flex justify-end">
                <button onClick={e => toggleLike(p.id, e)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-md"
                  style={{ fontSize:11, color: likes[p.id] ? 'var(--danger)' : 'var(--ink-4)', background: likes[p.id] ? '#FEE2E2' : 'transparent' }}>
                  <Icon name="heart" size={11} style={{ fill: likes[p.id] ? 'var(--danger)' : 'none' }} />
                  {likes[p.id] ? '1' : '0'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* 게시글 상세보기 */}
      <Modal open={!!selected} onClose={()=>{ setSelected(null); setCommentText(''); }} title="게시글" width={680}>
        {selected && (
          <div className="p-6">
            <div className="flex items-center gap-2 mb-2">
              {selected.pinned && <Pill tone="danger"><Icon name="pin" size={10}/>필독</Pill>}
              <span className="mono text-[11px]" style={{color:'var(--ink-4)'}}>{tab==='notice'?'공지사항':'자유 게시판'}</span>
            </div>
            <div className="text-[20px] font-bold tracking-tight mb-4">{selected.title}</div>
            <div className="flex items-center gap-3 pb-4 mb-4" style={{borderBottom:'1px solid var(--line-2)'}}>
              <Avatar user={userById(selected.author)} size={28}/>
              <div>
                <div className="text-[13px] font-semibold">{userById(selected.author).name}</div>
                <div className="mono text-[11px]" style={{color:'var(--ink-3)'}}>{selected.date} · 조회 {selected.views || 1}</div>
              </div>
              <div className="flex-1"/>
              {/* 좋아요 버튼 */}
              <button onClick={() => setLikes(prev => ({ ...prev, [selected.id]: !prev[selected.id] }))}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                style={{
                  border: '1.5px solid ' + (likes[selected.id] ? 'var(--danger)' : 'var(--line)'),
                  color: likes[selected.id] ? 'var(--danger)' : 'var(--ink-3)',
                  background: likes[selected.id] ? '#FEE2E2' : 'transparent',
                  fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                }}>
                <Icon name="heart" size={13} style={{ fill: likes[selected.id] ? 'var(--danger)' : 'none' }} />
                {likes[selected.id] ? '좋아요 1' : '좋아요'}
              </button>
            </div>

            {/* 본문 */}
            <div className="text-[13.5px] leading-relaxed mb-6" style={{color:'var(--ink-2)', minHeight:80}}>
              {selected.content ||
                (selected.pinned
                  ? '이 공지사항의 내용을 주의 깊게 읽어 주시기 바랍니다. 해당 사항에 대해 궁금한 점이 있으시면 담당자에게 문의하세요.'
                  : '게시글 내용입니다. 댓글을 통해 의견을 공유해 주세요.')}
            </div>

            {/* 댓글 섹션 */}
            <div style={{borderTop:'1.5px solid var(--line-2)', paddingTop:16}}>
              <div className="mono text-[10.5px] uppercase tracking-wider mb-3" style={{color:'var(--ink-3)'}}>
                댓글 {(comments[selected.id] || []).length}개
              </div>

              {/* 댓글 목록 */}
              <div style={{display:'flex', flexDirection:'column', gap:10, marginBottom:14}}>
                {(comments[selected.id] || []).map((c, i) => (
                  <div key={i} className="flex gap-3 p-3 rounded-xl" style={{background:'#FBFBF7', border:'1px solid var(--line-2)'}}>
                    <Avatar user={userById(c.author)} size={26} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span style={{fontSize:12.5, fontWeight:700}}>{userById(c.author).name}</span>
                        <span className="mono" style={{fontSize:10.5, color:'var(--ink-4)'}}>{c.time}</span>
                      </div>
                      <div style={{fontSize:13, color:'var(--ink-2)'}}>{c.text}</div>
                    </div>
                  </div>
                ))}
                {(comments[selected.id] || []).length === 0 && (
                  <div style={{padding:'16px 0', textAlign:'center', color:'var(--ink-4)', fontSize:13}}>
                    첫 번째 댓글을 남겨보세요.
                  </div>
                )}
              </div>

              {/* 댓글 입력 */}
              <div className="flex gap-2">
                <Avatar user={me} size={30} />
                <div className="flex-1 flex gap-2">
                  <input
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && addComment(selected.id)}
                    placeholder="댓글을 입력하세요…"
                    style={{
                      flex:1, padding:'8px 12px', border:'1.5px solid var(--line)',
                      borderRadius:10, fontSize:13, outline:'none', color:'var(--ink)',
                    }}
                    onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                    onBlur={e => e.target.style.borderColor = 'var(--line)'}
                  />
                  <Btn variant="primary" icon="send" onClick={() => addComment(selected.id)} disabled={!commentText.trim()}>등록</Btn>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-4 mt-4" style={{borderTop:'1px solid var(--line-2)'}}>
              <Btn variant="ghost" size="sm" icon="share-2" onClick={() => showMsg('링크가 복사되었습니다.')}>공유</Btn>
              <Btn variant="ghost" size="sm" icon="flag" onClick={() => showMsg('신고가 접수되었습니다.')}>신고</Btn>
              <div className="flex-1"/>
              <Btn variant="ghost" icon="x" onClick={()=>{ setSelected(null); setCommentText(''); }}>닫기</Btn>
            </div>
          </div>
        )}
      </Modal>

      {/* 글쓰기 모달 */}
      <Modal open={composeOpen} onClose={()=>setComposeOpen(false)} title="글쓰기" width={600}>
        <div className="p-6 space-y-4">
          <div className="flex gap-2">
            {[['notice','공지사항'],['free','자유 게시판']].map(([k,l])=>(
              <button key={k} onClick={()=>setTab(k)}
                className="px-3 py-1.5 rounded-md text-[12.5px] font-semibold"
                style={{background: tab===k?'var(--ink)':'var(--line-2)', color: tab===k?'#fff':'var(--ink-2)'}}>
                {l}
              </button>
            ))}
          </div>
          <input className="w-full outline-none px-3 py-2.5 rounded-xl text-[13.5px]"
            style={{border:'1px solid var(--line)'}}
            placeholder="제목을 입력하세요"
            value={newPost.title}
            onChange={e=>setNewPost({...newPost, title: e.target.value})} />
          <textarea className="w-full outline-none px-3 py-2.5 rounded-xl text-[13.5px]"
            style={{border:'1px solid var(--line)', resize:'vertical', minHeight:160}}
            placeholder="내용을 입력하세요"
            value={newPost.content}
            onChange={e=>setNewPost({...newPost, content: e.target.value})} />
          <div className="flex items-center gap-2 pt-2">
            <Btn variant="outline" icon="paperclip" onClick={() => showMsg('파일 첨부 기능 준비 중입니다.')}>첨부파일</Btn>
            <div className="flex-1"/>
            <Btn variant="ghost" onClick={()=>setComposeOpen(false)}>취소</Btn>
            <Btn variant="primary" icon="send" onClick={()=>{
              if (!newPost.title.trim()) return;
              const post = {
                id: 'p_'+Date.now(),
                title: newPost.title,
                content: newPost.content,
                author: me.id,
                date: fmtDate(TODAY),
                views: 0,
                comments: 0,
              };
              setBoards(prev => ({ ...prev, [tab]: [post, ...prev[tab]] }));
              setComposeOpen(false);
              setSelected(post);
              showMsg('게시글이 등록되었습니다.');
            }}>등록</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

window.Boards = Boards;
