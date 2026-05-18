import React, { useState, useMemo, useEffect } from 'react';

const SimpleModal = ({ open, onClose, title, children }) => {
  if (!open) return null;
  return (
    <div className="modal-overlay">
      <div className="modal-content board-modal">
        <div className="modal-header">
          <h3>{title}</h3>
          <button onClick={onClose} className="modal-close">&times;</button>
        </div>
        {children}
      </div>
    </div>
  );
};
// =====================================================================

export default function Board({ me, currentSubPage = 'board' }) {
  // 1. 상태 관리
  const [posts, setPosts] = useState(() => {
    const saved = localStorage.getItem('ang_posts');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [q, setQ] = useState(''); 
  const [selected, setSelected] = useState(null); 
  const [isEdit, setIsEdit] = useState(false); 
  
  const [formData, setFormData] = useState({ title: '', content: '', type: 'general', pinned: false });
  const [toast, setToast] = useState(null);

  useEffect(() => {
    localStorage.setItem('ang_posts', JSON.stringify(posts));
  }, [posts]);

  const showMsg = (m) => {
    setToast(m);
    setTimeout(() => setToast(null), 2000);
  };

  const getBoardTitle = () => {
    if (currentSubPage === 'board-notice') return '공지사항';
    if (currentSubPage === 'board-general') return '자유게시판';
    if (currentSubPage === 'board-my') return '내가 쓴 글';
    return '전체 게시판';
  };

  // 2. 리스트 필터링
  const displayList = useMemo(() => {
    let filtered = [...posts];

    if (currentSubPage === 'board-notice') {
      filtered = filtered.filter(p => p.type === 'notice');
    } else if (currentSubPage === 'board-general') {
      filtered = filtered.filter(p => p.type === 'general');
    } else if (currentSubPage === 'board-my') {
      const myId = me?.id || 'my_user_id';
      filtered = filtered.filter(p => p.authorId === myId); 
    }

    return filtered
      .filter(p => 
        p.title?.toLowerCase().includes(q.toLowerCase()) || 
        p.content?.toLowerCase().includes(q.toLowerCase())
      )
      .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.id - a.id);
  }, [posts, currentSubPage, q, me]);

  // 3. CRUD 액션
  const handleOpenCompose = () => {
    setSelected(null);
    setFormData({ title: '', content: '', type: 'general', pinned: false });
    setIsEdit(true);
  };

  const handleOpenEdit = () => {
    if (!selected) return;
    setFormData({ 
      title: selected.title, 
      content: selected.content, 
      type: selected.type,
      pinned: selected.pinned || false 
    });
    setIsEdit(true);
  };

  const handleSave = () => {
    if (!formData.title.trim() || !formData.content.trim()) return alert("제목과 내용을 모두 입력하세요.");

    const myId = me?.id || '';
    const myName = me?.name || '익명';

    if (selected) {
      setPosts(prev => prev.map(p => p.id === selected.id ? { ...p, ...formData } : p));
      showMsg("게시글이 수정되었습니다.");
    } else {
      const newPost = {
        id: Date.now(),
        ...formData,
        author: myName,
        authorId: myId,
        date: new Date().toLocaleDateString(),
      };
      setPosts(prev => [newPost, ...prev]);
      showMsg("새 글이 등록되었습니다.");
    }
    handleClose();
  };

  const handleDelete = (id) => {
    if (window.confirm("이 게시글을 정말 삭제하시겠습니까?")) {
      setPosts(prev => prev.filter(p => p.id !== id));
      handleClose();
      showMsg("게시글이 삭제되었습니다.");
    }
  };

  const handleClose = () => {
    setIsEdit(false);
    setSelected(null);
  };

  // 4. UI 렌더링
  return (
    <div className="board-page">

      {toast && (
        <div className="board-toast">
          {toast}
        </div>
      )}

      <div className="board-header">
        <div>
          <h1>{getBoardTitle()}</h1>
        </div>
        <button className="btn btn-primary" onClick={handleOpenCompose}>글쓰기</button>
      </div>

      <div className="board-container">
        <div className="board-top">
          <span className="board-count">총 {displayList.length}건</span>
          <input type="text" placeholder="검색어를 입력하세요..." value={q} onChange={(e) => setQ(e.target.value)} className="board-search" />
        </div>

        <div className="board-list">
          {displayList.length > 0 ? (
            displayList.map((post) => (
              <div key={post.id} onClick={() => setSelected(post)} className="board-item">
                <div className="board-item-pin">{post.pinned ? '📌' : '·'}</div>
                <div className="board-item-title" style={{ fontWeight: post.pinned ? 'bold' : 'normal' }}>{post.title}</div>
                <div className="board-item-author">{post.author}</div>
                <div className="board-item-date">{post.date}</div>
              </div>
            ))
          ) : (
            <div className="board-empty">
              해당 메뉴에 등록된 게시글이 없습니다.
            </div>
          )}
        </div>
      </div>

      {/* 상세보기 모달 */}
      <SimpleModal open={!!selected && !isEdit} onClose={handleClose} title="게시글 상세보기">
        {selected && (
          <div className="board-detail">
            <div className="board-detail-header">
              <h2>{selected.title}</h2>
              <div className="board-detail-actions">
                <button className="btn btn-secondary" onClick={handleOpenEdit}>수정</button>
                <button className="btn btn-danger" onClick={() => handleDelete(selected.id)}>삭제</button>
              </div>
            </div>
            <div className="board-detail-meta">
              작성자: {selected.author} | 날짜: {selected.date}
            </div>
            <div className="board-detail-content">
              {selected.content}
            </div>
          </div>
        )}
      </SimpleModal>

      {/* 새 글 작성 및 수정 모달 */}
      <SimpleModal open={isEdit} onClose={handleClose} title={selected ? "게시글 수정" : "새 게시글 작성"}>
        <div className="board-form">

          <div className="board-form-row">
            <select
              value={formData.type}
              onChange={e => setFormData({...formData, type: e.target.value})}
              className="board-select"
            >
              <option value="general">자유게시판</option>
              <option value="notice">공지사항</option>
            </select>

            <label className="board-label-checkbox">
              <input
                type="checkbox"
                checked={formData.pinned}
                onChange={e => setFormData({...formData, pinned: e.target.checked})}
              />
              상단 고정
            </label>
          </div>

          <input
            type="text"
            placeholder="제목을 입력하세요"
            value={formData.title}
            onChange={e => setFormData({...formData, title: e.target.value})}
            className="board-input"
          />
          <textarea
            className="board-textarea"
            placeholder="내용을 입력하세요"
            value={formData.content}
            onChange={e => setFormData({...formData, content: e.target.value})}
          />
          <div className="board-form-actions">
            <button className="btn btn-secondary" onClick={handleClose}>취소</button>
            <button className="btn btn-primary" onClick={handleSave}>{selected ? "수정 완료" : "등록하기"}</button>
          </div>
        </div>
      </SimpleModal>
    </div>
  );
}