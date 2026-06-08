import React, { useEffect, useMemo, useRef, useState } from 'react';

const fileToDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = () => reject(new Error('파일을 읽지 못했습니다.'));
  reader.readAsDataURL(file);
});

const normalizeAttachments = (files) =>
  files.map((file) => ({
    id: `${Date.now()}-${Math.random()}`,
    name: file.name,
    type: file.type,
    size: file.size,
    isImage: file.type.startsWith('image/'),
  }));

const formatFileSize = (size) => {
  if (!size && size !== 0) return '';
  if (size < 1024) return `${size}B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}KB`;
  return `${(size / (1024 * 1024)).toFixed(1)}MB`;
};

const truncateText = (text, max = 15) => {
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max)}...` : text;
};

export default function Board({ me, currentSubPage = 'board' }) {
  const [posts, setPosts] = useState(() => {
    const saved = localStorage.getItem('ang_posts');
    return saved ? JSON.parse(saved) : [];
  });
  const [q, setQ] = useState('');
  const [mode, setMode] = useState('list');
  const [selectedPost, setSelectedPost] = useState(null);
  const [formData, setFormData] = useState({ title: '', content: '', type: 'general', pinned: false });
  const [attachments, setAttachments] = useState([]);
  const [attachmentPreviews, setAttachmentPreviews] = useState({});
  const [toast, setToast] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const fileInputRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('ang_posts', JSON.stringify(posts));
  }, [posts]);

  useEffect(() => {
    const loadPreviews = async () => {
      const previewMap = {};

      for (const attachment of attachments) {
        if (attachment.previewUrl) {
          previewMap[attachment.id] = attachment.previewUrl;
        }
      }

      setAttachmentPreviews(previewMap);
    };

    loadPreviews();
  }, [attachments]);

  const showMsg = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 2000);
  };

  const getBoardTitle = () => {
    if (currentSubPage === 'board-notice') return '공지사항';
    if (currentSubPage === 'board-general') return '자유게시판';
    if (currentSubPage === 'board-my') return '내가 쓴 글';
    return '전체 게시판';
  };

  const displayList = useMemo(() => {
    let filtered = [...posts];

    if (currentSubPage === 'board-notice') {
      filtered = filtered.filter((post) => post.type === 'notice');
    } else if (currentSubPage === 'board-general') {
      filtered = filtered.filter((post) => post.type === 'general');
    } else if (currentSubPage === 'board-my') {
      const myId = me?.id || 'my_user_id';
      filtered = filtered.filter((post) => post.authorId === myId);
    }

    return filtered
      .filter((post) =>
        post.title?.toLowerCase().includes(q.toLowerCase()) ||
        post.content?.toLowerCase().includes(q.toLowerCase())
      )
      .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.id - a.id);
  }, [posts, currentSubPage, q, me]);

  const totalPages = Math.max(1, Math.ceil(displayList.length / itemsPerPage));
  const pagedList = displayList.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => {
    // If filters/search change, reset to first page
    setCurrentPage(1);
  }, [currentSubPage, q]);

  useEffect(() => {
    // Clamp currentPage if totalPages decreased
    setCurrentPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  const resetForm = () => {
    setFormData({ title: '', content: '', type: 'general', pinned: false });
    setAttachments([]);
    setAttachmentPreviews({});
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleOpenCompose = () => {
    setSelectedPost(null);
    resetForm();
    setMode('compose');
  };

  const handleOpenPost = (post) => {
    setPosts((prev) => {
      const updated = prev.map((item) => (item.id === post.id ? { ...item, views: (item.views || 0) + 1 } : item));
      const updatedPost = updated.find((item) => item.id === post.id);
      setSelectedPost(updatedPost || post);
      return updated;
    });
    setMode('detail');
  };

  const handleOpenEdit = () => {
    if (!selectedPost) return;

    setFormData({
      title: selectedPost.title,
      content: selectedPost.content,
      type: selectedPost.type,
      pinned: selectedPost.pinned || false,
    });
    setAttachments(selectedPost.attachments || []);
    setMode('compose');
  };

  const handleAttachmentChange = async (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const prepared = await Promise.all(
      files.map(async (file) => {
        const attachment = {
          id: `${Date.now()}-${Math.random()}`,
          name: file.name,
          type: file.type,
          size: file.size,
          isImage: file.type.startsWith('image/'),
          url: await fileToDataUrl(file),
        };

        return attachment;
      })
    );

    setAttachments((prev) => [...prev, ...prepared]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveAttachment = (attachmentId) => {
    setAttachments((prev) => prev.filter((attachment) => attachment.id !== attachmentId));
  };

  const handleSave = () => {
    if (!formData.title.trim() || !formData.content.trim()) {
      alert('제목과 내용을 모두 입력하세요.');
      return;
    }

    const myId = me?.id || '';
    const myName = me?.name || '익명';

    if (selectedPost) {
      setPosts((prev) => prev.map((post) => (
        post.id === selectedPost.id
          ? { ...post, ...formData, attachments }
          : post
      )));
      showMsg('게시글이 수정되었습니다.');
      setSelectedPost((prev) => (prev ? { ...prev, ...formData, attachments } : prev));
      setMode('detail');
    } else {
      const newPost = {
        id: Date.now(),
        ...formData,
        attachments,
        author: myName,
        authorId: myId,
        date: new Date().toLocaleDateString(),
        views: 0,
      };
      setPosts((prev) => [newPost, ...prev]);
      showMsg('새 글이 등록되었습니다.');
      setMode('list');
    }

    setSelectedPost(null);
    resetForm();
  };

  const handleDelete = (postId) => {
    if (!window.confirm('이 게시글을 정말 삭제하시겠습니까?')) return;

    setPosts((prev) => prev.filter((post) => post.id !== postId));
    setSelectedPost(null);
    setMode('list');
    resetForm();
    showMsg('게시글이 삭제되었습니다.');
  };

  const handleClose = () => {
    setMode('list');
    setSelectedPost(null);
    resetForm();
  };

  const renderAttachmentPreview = (attachment) => {
    if (attachment.isImage) {
      return <img src={attachment.url} alt={attachment.name} className="board-attachment-thumb" />;
    }

    return <div className="board-attachment-file-icon">FILE</div>;
  };

  const renderListView = () => (
    <div className="board-container">
      <div className="board-top">
        <div className="board-left">
          <span className="board-category">{getBoardTitle()}</span>
          <span className="board-count">총 {displayList.length}건</span>
        </div>
        <div className="board-right">
          <input
            type="text"
            placeholder="검색어를 입력하세요..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="board-search"
          />
          <button className="btn btn-primary board-write-btn" onClick={handleOpenCompose}>글쓰기</button>
        </div>
      </div>

      <div className="board-list">
        <div className="board-list-body">
          <div className="board-list-header">
            <div></div>
            <div className="board-list-label">제목</div>
            <div className="board-list-label">작성자</div>
            <div className="board-list-label">작성일</div>
            <div className="board-list-label">조회수</div>
          </div>

          {displayList.length > 0 ? (
            pagedList.map((post) => (
              <div key={post.id} onClick={() => handleOpenPost(post)} className="board-item">
                <div className="board-item-pin">{post.pinned ? '📌' : '·'}</div>
                <div className="board-item-title" style={{ fontWeight: post.pinned ? 'bold' : 'normal' }} title={post.title}>
                  {truncateText(post.title, 15)}
                  {post.attachments?.length > 0 && <span className="board-attachment-count">첨부 {post.attachments.length}</span>}
                </div>
                <div className="board-item-author">{post.author}</div>
                <div className="board-item-date">{post.date}</div>
                <div className="board-item-views">{post.views || 0}</div>
              </div>
            ))
          ) : (
            <div className="board-empty">해당 메뉴에 등록된 게시글이 없습니다.</div>
          )}
        </div>

        <div className="board-pagination" aria-label="게시글 페이지">
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            이전
          </button>
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i}
              type="button"
              className={currentPage === i + 1 ? 'active' : ''}
              onClick={() => setCurrentPage(i + 1)}
            >
              {i + 1}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            다음
          </button>
        </div>
      </div>
    </div>
  );

  const renderDetailView = () => {
    if (!selectedPost) return null;

    return (
      <div className="board-container board-detail-page">
        <div className="board-top board-detail-top">
          <div className="board-left">
            <button type="button" className="board-back-btn" onClick={handleClose}>← 목록</button>
            <span className="board-category">게시글 상세</span>
          </div>
          <div className="board-right">
            <button className="btn btn-secondary" onClick={handleOpenEdit}>수정</button>
            <button className="btn btn-danger" onClick={() => handleDelete(selectedPost.id)}>삭제</button>
          </div>
        </div>

        <div className="board-detail">
          <div className="board-detail-header">
            <div>
              <h2>{selectedPost.title}</h2>
              <div className="board-detail-meta">
                작성자: {selectedPost.author} | 날짜: {selectedPost.date} | 조회수: {selectedPost.views || 0}
              </div>
            </div>
          </div>

          {selectedPost.attachments?.length > 0 && (
            <div className="board-detail-attachments">
              <h3>첨부파일</h3>
              <div className="board-attachment-grid">
                {selectedPost.attachments.map((attachment) => (
                  <a
                    key={attachment.id}
                    className="board-attachment-card"
                    href={attachment.url}
                    download={attachment.name}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {renderAttachmentPreview(attachment)}
                    <div className="board-attachment-info">
                      <div className="board-attachment-name">{attachment.name}</div>
                      <div className="board-attachment-size">{formatFileSize(attachment.size)}</div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="board-detail-content">{selectedPost.content}</div>
        </div>
      </div>
    );
  };

  const renderComposeView = () => (
    <div className="board-container board-compose-page">
      <div className="board-top board-detail-top">
        <div className="board-left">
          <button type="button" className="board-back-btn" onClick={handleClose}>← 뒤로</button>
          <span className="board-category">{selectedPost ? '게시글 수정' : '새 게시글 작성'}</span>
        </div>
      </div>

      <div className="board-form">
        <div className="board-form-row">
          <select
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            className="board-select"
          >
            <option value="general">자유게시판</option>
            <option value="notice">공지사항</option>
          </select>

          <label className="board-label-checkbox">
            <input
              type="checkbox"
              checked={formData.pinned}
              onChange={(e) => setFormData({ ...formData, pinned: e.target.checked })}
            />
            상단 고정
          </label>
        </div>

        <input
          type="text"
          placeholder="제목을 입력하세요"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          className="board-input"
        />

        <textarea
          className="board-textarea"
          placeholder="내용을 입력하세요"
          value={formData.content}
          onChange={(e) => setFormData({ ...formData, content: e.target.value })}
        />

        <div className="board-attachment-uploader">
          <div className="board-attachment-uploader-head">
            <strong>이미지 / 파일 첨부</strong>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.hwp,.txt"
              multiple
              onChange={handleAttachmentChange}
            />
          </div>

          {attachments.length > 0 && (
            <div className="board-attachment-draft-list">
              {attachments.map((attachment) => (
                <div key={attachment.id} className="board-attachment-draft-item">
                  {attachment.isImage ? (
                    <img src={attachment.url} alt={attachment.name} className="board-attachment-thumb" />
                  ) : (
                    <div className="board-attachment-file-icon">FILE</div>
                  )}
                  <div className="board-attachment-info">
                    <div className="board-attachment-name">{attachment.name}</div>
                    <div className="board-attachment-size">{formatFileSize(attachment.size)}</div>
                  </div>
                  <button
                    type="button"
                    className="board-attachment-remove"
                    onClick={() => handleRemoveAttachment(attachment.id)}
                  >
                    삭제
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="board-form-actions">
          <button type="button" className="btn btn-secondary" onClick={handleClose}>취소</button>
          <button type="button" className="btn btn-primary" onClick={handleSave}>
            {selectedPost ? '수정 완료' : '등록하기'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="board-page">
      {toast && <div className="board-toast">{toast}</div>}

      {mode === 'detail' ? renderDetailView() : null}
      {mode === 'compose' ? renderComposeView() : null}
      {mode === 'list' ? renderListView() : null}
    </div>
  );
}