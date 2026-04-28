import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { USERS, DEPTS, DOCS, TASKS, APPROVALS, BOARDS, CHATS, CHAT_MESSAGES, MAILS, NOTIFICATIONS, TODAY, EVENTS, userById, fmtDate, d } from '../data';
import { Icon, Avatar, Pill, Btn, Card, SectionLabel, Input, AIBadge, Modal, Empty, FileTypeIcon, DocPreviewModal, DocPreviewContent } from '../ui';
import { api } from '../api';

// Mail — 받은메일함 / 보낸메일함 / 즐겨찾기 / 휴지통
function Mail({ me, go, subPage }) {
  const [folder, setFolder] = useState(subPage || 'inbox');
  useEffect(() => { if (subPage) setFolder(subPage); }, [subPage]);

  const [mails, setMails] = useState(MAILS);

  useEffect(() => {
    api.get('/mails').then(data => {
      if (data) {
        setTrashedIds(new Set(data.filter(m => m.trashed).map(m => m.id)));
        setMails(data.map(m => ({ ...m, unread: !!m.unread, starred: !!m.starred, hasAttach: !!m.has_attach, from: m.from_user })));
      }
    });
    api.get('/mails/sent').then(data => {
      if (data) setSentMails(data.map(m => ({ ...m, hasAttach: !!m.has_attach, to: m.to_user })));
    });
  }, []);

  const [sentMails, setSentMails] = useState([
    { id:'s1', to:'차무식 팀장', subject:'주간 업무 보고 (4월 3주차)', preview:'이번 주 업무 진행상황 보고드립니다. 신청서 초안 작성 완료, 외부강사 명단 확인 중입니다.', time:'09:30', unread:false, hasAttach:false },
    { id:'s2', to:'최선호 원장', subject:'행사지원 서류 제출 안내', preview:'4월 행사 지원 서류 첨부하여 제출드립니다. 확인 부탁드립니다.', time:'어제', unread:false, hasAttach:true },
  ]);
  const [trashedIds, setTrashedIds] = useState(new Set());
  const [openId, setOpenId] = useState(null);
  const [compose, setCompose] = useState(false);
  const [composeData, setComposeData] = useState({ to:'', subject:'', body:'' });
  const [sent, setSent] = useState(false);
  const [toast, setToast] = useState(null);

  const showMsg = (m) => { setToast(m); setTimeout(() => setToast(null), 2200); };

  // 폴더별 메일 목록
  const folderMails =
    folder === 'inbox'   ? mails.filter(m => !trashedIds.has(m.id)) :
    folder === 'starred' ? mails.filter(m => m.starred && !trashedIds.has(m.id)) :
    folder === 'sent'    ? sentMails :
    /* trash */            mails.filter(m => trashedIds.has(m.id));

  const open = folder === 'sent'
    ? sentMails.find(m => m.id === openId)
    : mails.find(m => m.id === openId) || mails.find(m => trashedIds.has(m.id) && m.id === openId);

  const openMail = (id) => {
    setOpenId(id);
    if (folder !== 'sent') {
      const mail = mails.find(m => m.id === id);
      if (mail?.unread) {
        setMails(prev => prev.map(m => m.id === id ? { ...m, unread: false } : m));
        api.patch('/mails/' + id, { unread: 0 });
      }
    }
  };

  const startCompose = (opts = {}) => {
    setComposeData({ to: opts.to || '', subject: opts.subject || '', body: opts.body || '' });
    setSent(false);
    setCompose(true);
  };

  const sendMail = () => {
    if (!composeData.to.trim() || !composeData.subject.trim()) return;
    const id = 's_' + Date.now();
    const now = new Date().toTimeString().slice(0, 5);
    const item = {
      id, to: composeData.to,
      subject: composeData.subject,
      preview: composeData.body.trim().slice(0, 60) || '(내용 없음)',
      time: now, unread: false, hasAttach: false,
    };
    setSentMails(prev => [item, ...prev]);
    setSent(true);
    api.post('/mails/sent', { id, to_user: composeData.to, subject: composeData.subject, preview: item.preview, time: now, has_attach: 0 });
  };

  const reply = () => {
    if (!open || folder === 'sent') return;
    const sender = userById(open.from);
    startCompose({
      to: sender.name,
      subject: open.subject.startsWith('Re:') ? open.subject : 'Re: ' + open.subject,
      body: `\n\n──────────────\n원문\n보낸 사람: ${sender.name} (${sender.rank})\n일시: ${open.time}\n\n${open.preview} 관련하여 자세한 내용을 공유드립니다.`,
    });
  };

  const forward = () => {
    if (!open || folder === 'sent') return;
    startCompose({
      subject: open.subject.startsWith('Fw:') ? open.subject : 'Fw: ' + open.subject,
      body: `\n\n──────────────\n전달된 메일\n보낸 사람: ${userById(open.from).name}\n일시: ${open.time}\n\n${open.preview} 관련 내용입니다.`,
    });
  };

  const toggleStar = (id) => {
    const mail = mails.find(m => m.id === id);
    const newStarred = mail ? !mail.starred : true;
    setMails(prev => prev.map(m => m.id === id ? { ...m, starred: newStarred } : m));
    api.patch('/mails/' + id, { starred: newStarred ? 1 : 0 });
  };

  const trashMail = (id) => {
    setTrashedIds(prev => new Set([...prev, id]));
    if (openId === id) setOpenId(null);
    showMsg('메일을 휴지통으로 이동했습니다.');
    api.patch('/mails/' + id, { trashed: 1 });
  };

  const restoreMail = (id) => {
    setTrashedIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    showMsg('메일을 받은메일함으로 복원했습니다.');
    api.patch('/mails/' + id, { trashed: 0 });
  };

  const unreadCount = mails.filter(m => m.unread && !trashedIds.has(m.id)).length;

  return (
    <div className="fadein" style={{ maxWidth: 1360, margin: '0 auto', padding: '26px 36px 60px' }}>
      <div className="flex items-end justify-between mb-5">
        <div>
          <div className="mono text-[11px] uppercase tracking-[0.18em] mb-1" style={{ color: 'var(--ink-4)' }}>Mail-01 · Inbox</div>
          <h1 className="text-[24px] font-bold tracking-tight">메일함</h1>
        </div>
        <Btn variant="primary" icon="pen-square" onClick={() => startCompose()}>메일 작성</Btn>
      </div>

      <Card pad={false} style={{ height: 640, overflow: 'hidden' }}>
        <div className="grid h-full" style={{ gridTemplateColumns: '360px 1fr' }}>

          {/* ── 메일 목록 ── */}
          <div className="col-scroll" style={{ borderRight: '1px solid var(--line-2)', overflowY: 'auto' }}>
            {folderMails.length === 0 && (
              <Empty icon={folder === 'trash' ? 'trash-2' : folder === 'starred' ? 'star' : 'inbox'}
                title={folder === 'trash' ? '휴지통이 비어있습니다' : folder === 'starred' ? '즐겨찾기한 메일이 없습니다' : folder === 'sent' ? '보낸 메일이 없습니다' : '받은 메일이 없습니다'} />
            )}
            {folderMails.map(m => {
              const isSent = folder === 'sent';
              const u = isSent ? null : userById(m.from);
              const isOpen = openId === m.id;
              return (
                <div key={m.id} onClick={() => openMail(m.id)}
                  className="px-4 py-3 cursor-pointer transition-all"
                  style={{ background: isOpen ? 'var(--primary-50)' : 'transparent', borderBottom: '1px solid var(--line-2)', borderLeft: isOpen ? '3px solid var(--primary)' : '3px solid transparent' }}>
                  <div className="flex items-center gap-2 mb-1">
                    {m.unread && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--primary)' }} />}
                    {!isSent && <Avatar user={u} size={18} />}
                    {isSent && <Icon name="send" size={14} style={{ color: 'var(--ink-4)', flexShrink: 0 }} />}
                    <span className="text-[12.5px] font-semibold truncate">{isSent ? 'To: ' + m.to : u.name}</span>
                    <span className="mono text-[10.5px] ml-auto shrink-0" style={{ color: 'var(--ink-4)' }}>{m.time}</span>
                  </div>
                  <div className="text-[13px] truncate" style={{ fontWeight: m.unread ? 600 : 400 }}>{m.subject}</div>
                  <div className="text-[11.5px] truncate" style={{ color: 'var(--ink-3)' }}>{m.preview}</div>
                  <div className="flex items-center gap-2 mt-1">
                    {m.starred && <Icon name="star" size={12} style={{ color: 'var(--warn)' }} />}
                    {m.hasAttach && <Icon name="paperclip" size={12} style={{ color: 'var(--ink-4)' }} />}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── 메일 본문 ── */}
          <div className="overflow-y-auto col-scroll">
            {!open && (
              <Empty icon="mail" title="메일을 선택하세요" sub="왼쪽 목록에서 메일을 선택하면 내용이 표시됩니다." />
            )}
            {open && (
              <div className="p-6">
                {/* 제목 */}
                <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16 }}>{open.subject}</div>

                {/* 발신자/수신자 + 액션 */}
                <div className="flex items-center gap-3 mb-5 pb-4" style={{ borderBottom: '1px solid var(--line-2)' }}>
                  {folder !== 'sent' && <Avatar user={userById(open.from)} size={38} />}
                  {folder === 'sent' && (
                    <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--line-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="send" size={16} style={{ color: 'var(--ink-3)' }} />
                    </div>
                  )}
                  <div className="flex-1">
                    {folder !== 'sent' ? (
                      <>
                        <div style={{ fontSize: 13.5, fontWeight: 700 }}>{userById(open.from).name}</div>
                        <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                          To {me.name} · {open.time}
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 13.5, fontWeight: 700 }}>To: {open.to}</div>
                        <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>보낸 시간 · {open.time}</div>
                      </>
                    )}
                  </div>
                  {/* 액션 버튼 */}
                  <div className="flex items-center gap-1">
                    {folder !== 'sent' && folder !== 'trash' && (
                      <>
                        <Btn variant="ghost" icon="reply" size="sm" onClick={reply}>답장</Btn>
                        <Btn variant="ghost" icon="corner-up-right" size="sm" onClick={forward}>전달</Btn>
                      </>
                    )}
                    {folder !== 'sent' && folder !== 'trash' && (
                      <button
                        onClick={() => toggleStar(open.id)}
                        style={{ padding: '6px 8px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: open.starred ? 'var(--warn)' : 'var(--ink-4)' }}
                        title={open.starred ? '즐겨찾기 해제' : '즐겨찾기'}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--line-2)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <Icon name="star" size={16} />
                      </button>
                    )}
                    {folder === 'trash' ? (
                      <Btn variant="outline" icon="rotate-ccw" size="sm" onClick={() => restoreMail(open.id)}>복원</Btn>
                    ) : (
                      <button
                        onClick={() => trashMail(open.id)}
                        style={{ padding: '6px 8px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink-4)' }}
                        title="삭제"
                        onMouseEnter={e => { e.currentTarget.style.background = '#FEE2E2'; e.currentTarget.style.color = 'var(--danger)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink-4)'; }}>
                        <Icon name="trash-2" size={16} />
                      </button>
                    )}
                  </div>
                </div>

                {/* 본문 */}
                <div style={{ fontSize: 14, lineHeight: 1.85, color: 'var(--ink-2)' }}>
                  {folder !== 'sent' ? (
                    <>
                      <p>안녕하세요 {me.name}님,</p>
                      <p style={{ marginTop: 10 }}>{open.preview} 관련하여 자세한 내용 공유드립니다. 첨부된 문서 확인 후 의견 부탁드립니다.</p>
                      <p style={{ marginTop: 10 }}>감사합니다.</p>
                      <p className="mono" style={{ marginTop: 16, fontSize: 12, color: 'var(--ink-4)' }}>
                        — {userById(open.from).name} ({userById(open.from).rank}) · {userById(open.from).dept}
                      </p>
                    </>
                  ) : (
                    <p>{open.preview}</p>
                  )}
                </div>

                {/* 첨부파일 */}
                {open.hasAttach && (
                  <div className="mt-5 p-3 rounded-xl flex items-center gap-3" style={{ background: '#FBFBF7', border: '1px solid var(--line-2)' }}>
                    <FileTypeIcon ext="pdf" size={22} />
                    <div className="flex-1">
                      <div style={{ fontSize: 13, fontWeight: 600 }}>첨부파일_2026_업무양식.pdf</div>
                      <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>412 KB</div>
                    </div>
                    <Btn size="sm" variant="outline" icon="download" onClick={() => showMsg('다운로드를 시작합니다.')}>다운로드</Btn>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* ── 메일 작성 모달 ── */}
      <Modal open={compose}
        onClose={() => { setCompose(false); setSent(false); setComposeData({ to: '', subject: '', body: '' }); }}
        title="메일 작성" width={640}>
        {sent ? (
          <div className="p-10 flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: '#ECFDF5' }}>
              <Icon name="check-circle-2" size={28} style={{ color: 'var(--good)' }} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>메일이 전송되었습니다</div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>받는 사람: {composeData.to}</div>
            <Btn variant="outline" style={{ marginTop: 20 }}
              onClick={() => { setCompose(false); setSent(false); setComposeData({ to: '', subject: '', body: '' }); }}>닫기</Btn>
          </div>
        ) : (
          <div className="p-6 space-y-3">
            <Input icon="user" placeholder="받는 사람 (이름 또는 이메일)"
              value={composeData.to} onChange={v => setComposeData(p => ({ ...p, to: v }))} />
            <Input placeholder="제목"
              value={composeData.subject} onChange={v => setComposeData(p => ({ ...p, subject: v }))} />
            <textarea placeholder="내용을 입력하세요" rows={9}
              className="w-full outline-none rounded-xl p-3"
              style={{ border: '1.5px solid var(--line)', resize: 'vertical', fontSize: 13.5, lineHeight: 1.8, fontFamily: 'inherit' }}
              value={composeData.body}
              onChange={e => setComposeData(p => ({ ...p, body: e.target.value }))}
              onFocus={e => e.target.style.borderColor = 'var(--primary)'}
              onBlur={e => e.target.style.borderColor = 'var(--line)'} />
            <div className="flex items-center gap-2 pt-2">
              <Btn variant="outline" icon="paperclip" onClick={() => showMsg('파일 첨부 기능을 준비 중입니다.')}>첨부</Btn>
              <div className="flex-1" />
              <Btn variant="ghost" onClick={() => setCompose(false)}>취소</Btn>
              <Btn variant="primary" icon="send"
                disabled={!composeData.to.trim() || !composeData.subject.trim()}
                onClick={sendMail}>전송</Btn>
            </div>
          </div>
        )}
      </Modal>

      {toast && <div className="toast"><Icon name="check-circle-2" size={16} style={{ color: 'var(--good)' }} /> {toast}</div>}
    </div>
  );
}


export default Mail;
