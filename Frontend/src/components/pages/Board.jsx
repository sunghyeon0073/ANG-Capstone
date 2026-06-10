import React, { useEffect, useMemo, useRef, useState } from 'react'
import { FiEdit, FiFileText, FiFlag, FiPaperclip, FiSearch, FiStar, FiTrash2, FiX } from 'react-icons/fi'

const fileToDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result || ''))
  reader.onerror = () => reject(new Error('파일을 읽지 못했습니다.'))
  reader.readAsDataURL(file)
})

const formatFileSize = (size) => {
  if (!size && size !== 0) return ''
  if (size < 1024) return `${size}B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}KB`
  return `${(size / (1024 * 1024)).toFixed(1)}MB`
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d)) return dateStr
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
  return d.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })
}

const CATEGORIES = [
  { id: 'board',         label: '전체',      icon: FiFileText },
  { id: 'board-notice',  label: '공지사항',   icon: FiFlag },
  { id: 'board-general', label: '자유게시판', icon: FiEdit },
  { id: 'board-my',      label: '내가 쓴 글', icon: FiStar },
]

export default function Board({ me, currentSubPage = 'board', onSubPageChange, maxItems, onNavigateToBoard }) {
  const [posts, setPosts] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ang_posts') || '[]') } catch { return [] }
  })
  const [q, setQ] = useState('')
  const [mode, setMode] = useState('list')
  const [selectedPost, setSelectedPost] = useState(null)
  const [formData, setFormData] = useState({ title: '', content: '', type: 'general', pinned: false })
  const [attachments, setAttachments] = useState([])
  const [toast, setToast] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [internalCategory, setInternalCategory] = useState(currentSubPage)
  const itemsPerPage = maxItems != null ? maxItems : 13
  const fileInputRef = useRef(null)

  const isDashboard = maxItems != null

  useEffect(() => { localStorage.setItem('ang_posts', JSON.stringify(posts)) }, [posts])
  useEffect(() => { setInternalCategory(currentSubPage) }, [currentSubPage])
  useEffect(() => { setCurrentPage(1) }, [internalCategory, q])

  const activeCategory = internalCategory

  const showMsg = (message) => {
    setToast(message)
    setTimeout(() => setToast(null), 2000)
  }

  const getCategoryLabel = () => CATEGORIES.find(c => c.id === activeCategory)?.label || '전체'

  const displayList = useMemo(() => {
    let filtered = [...posts]
    if (activeCategory === 'board-notice') filtered = filtered.filter(p => p.type === 'notice')
    else if (activeCategory === 'board-general') filtered = filtered.filter(p => p.type === 'general')
    else if (activeCategory === 'board-my') {
      const myId = me?.id || 'my_user_id'
      filtered = filtered.filter(p => p.authorId === myId)
    }
    const kw = q.trim().toLowerCase()
    if (kw) filtered = filtered.filter(p =>
      p.title?.toLowerCase().includes(kw) || p.content?.toLowerCase().includes(kw)
    )
    return filtered.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.id - a.id)
  }, [posts, activeCategory, q, me])

  const totalPages = Math.max(1, Math.ceil(displayList.length / itemsPerPage))
  const pagedList = displayList.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  useEffect(() => {
    setCurrentPage(p => Math.min(Math.max(1, p), totalPages))
  }, [totalPages])

  const resetForm = () => {
    setFormData({ title: '', content: '', type: 'general', pinned: false })
    setAttachments([])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleOpenCompose = () => { setSelectedPost(null); resetForm(); setMode('compose') }

  const handleOpenPost = (post) => {
    setPosts(prev => {
      const updated = prev.map(item => item.id === post.id ? { ...item, views: (item.views || 0) + 1 } : item)
      setSelectedPost(updated.find(item => item.id === post.id) || post)
      return updated
    })
    setMode('detail')
  }

  const handleOpenEdit = () => {
    if (!selectedPost) return
    setFormData({ title: selectedPost.title, content: selectedPost.content, type: selectedPost.type, pinned: selectedPost.pinned || false })
    setAttachments(selectedPost.attachments || [])
    setMode('compose')
  }

  const handleAttachmentChange = async (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const prepared = await Promise.all(files.map(async file => ({
      id: `${Date.now()}-${Math.random()}`,
      name: file.name, type: file.type, size: file.size,
      isImage: file.type.startsWith('image/'),
      url: await fileToDataUrl(file),
    })))
    setAttachments(prev => [...prev, ...prepared])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSave = () => {
    if (!formData.title.trim() || !formData.content.trim()) { alert('제목과 내용을 모두 입력하세요.'); return }
    const myId = me?.id || ''; const myName = me?.name || '익명'
    if (selectedPost) {
      setPosts(prev => prev.map(p => p.id === selectedPost.id ? { ...p, ...formData, attachments } : p))
      setSelectedPost(prev => prev ? { ...prev, ...formData, attachments } : prev)
      showMsg('수정되었습니다.')
      setMode('detail')
    } else {
      setPosts(prev => [{ id: Date.now(), ...formData, attachments, author: myName, authorId: myId, date: new Date().toISOString(), views: 0 }, ...prev])
      showMsg('등록되었습니다.')
      setMode('list')
    }
    setSelectedPost(s => selectedPost ? s : null)
    resetForm()
  }

  const handleDelete = (postId) => {
    if (!window.confirm('삭제하시겠습니까?')) return
    setPosts(prev => prev.filter(p => p.id !== postId))
    setSelectedPost(null); setMode('list'); resetForm(); showMsg('삭제되었습니다.')
  }

  const handleClose = () => { setMode('list'); setSelectedPost(null); resetForm() }

  const handleCategoryChange = (catId) => {
    setInternalCategory(catId)
    if (!isDashboard) onSubPageChange?.(catId)
    setMode('list')
    setSelectedPost(null)
  }

  // ── Dashboard mode (compact) ──────────────────────────────────────────────
  if (isDashboard) {
    return (
      <div className="board-dash-wrap">
        {/* 헤더: 카테고리 탭 + 더보기 */}
        <div className="board-dash-header">
          <div className="board-dash-tabs">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                className={`board-dash-tab ${activeCategory === cat.id ? 'active' : ''}`}
                onClick={() => handleCategoryChange(cat.id)}
              >
                {cat.label}
              </button>
            ))}
          </div>
          <button className="board-dash-more-btn" onClick={() => onSubPageChange?.('board')}>
            더보기 →
          </button>
        </div>

        {/* 컬럼 헤더 */}
        <div className="board-dash-col-header">
          <span className="board-dash-col board-dash-col--no">구분</span>
          <span className="board-dash-col board-dash-col--title">제목</span>
          <span className="board-dash-col board-dash-col--author">작성자</span>
          <span className="board-dash-col board-dash-col--date">날짜</span>
          <span className="board-dash-col board-dash-col--views">조회</span>
        </div>

        {/* 목록 */}
        <div className="board-dash-list">
          {Array.from({ length: maxItems }).map((_, i) => {
            const post = pagedList[i]
            if (post) return (
              <div key={post.id} className="board-dash-item" onClick={() => handleOpenPost(post)}>
                <span className="board-dash-col board-dash-col--no">
                  {post.pinned ? <FiFlag size={10} className="board-dash-pin" /> : <span className="board-dash-no-num">{displayList.length - i}</span>}
                </span>
                <span className="board-dash-col board-dash-col--title">
                  {post.type === 'notice' && activeCategory !== 'board-notice' && <span className="board-dash-notice-badge">공지</span>}
                  <span className="board-dash-title-text">{post.title.length > 15 ? post.title.slice(0, 15) + '…' : post.title}</span>
                </span>
                <span className="board-dash-col board-dash-col--author">{post.author || '-'}</span>
                <span className="board-dash-col board-dash-col--date">{formatDate(post.date)}</span>
                <span className="board-dash-col board-dash-col--views">{post.views || 0}</span>
              </div>
            )
            return (
              <div key={`ph-${i}`} className="board-dash-item board-dash-placeholder">
                <span className="board-dash-col board-dash-col--no" />
                <span className="board-dash-col board-dash-col--title" />
                <span className="board-dash-col board-dash-col--author" />
                <span className="board-dash-col board-dash-col--date" />
                <span className="board-dash-col board-dash-col--views" />
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Full page mode ────────────────────────────────────────────────────────
  return (
    <div className="board-page">
      {toast && <div className="board-toast">{toast}</div>}

      <div className="board-main">

        {/* ── 카테고리 탭 (list 모드에서만) ── */}
        {mode === 'list' && (
          <div className="board-tabs">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                className={`board-tab ${activeCategory === cat.id ? 'active' : ''}`}
                onClick={() => handleCategoryChange(cat.id)}
              >
                {cat.label}
                {cat.id === 'board' && <span className="board-tab-count">{posts.length}</span>}
              </button>
            ))}
          </div>
        )}

        {/* ── 툴바 (list 모드에서만) ── */}
        {mode === 'list' && (
          <div className="board-toolbar">
            <span className="board-toolbar-total">{displayList.length}건</span>
            <div className="board-toolbar-right">
              <div className="board-search-wrap">
                <input
                  className="board-search"
                  type="text"
                  placeholder="검색"
                  value={q}
                  onChange={e => setQ(e.target.value)}
                />
                {q && <button className="board-search-clear" onClick={() => setQ('')}><FiX size={12} /></button>}
              </div>
              <div className="board-page-nav">
                <button className="board-page-arrow" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>‹</button>
                <span className="board-page-info">{currentPage} / {totalPages}</span>
                <button className="board-page-arrow" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>›</button>
              </div>
              <button className="board-write-btn" onClick={handleOpenCompose}>
                <FiEdit size={14} /> 글쓰기
              </button>
            </div>
          </div>
        )}

        {/* ── 목록 ── */}
        {mode === 'list' && (
          <div className="board-table-wrap">
            <table className="board-table">
              <colgroup>
                <col style={{ width: 80 }} />
                <col />
                <col style={{ width: 110 }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 60 }} />
              </colgroup>
              <thead>
                <tr>
                  <th>구분</th>
                  <th>제목</th>
                  <th>작성자</th>
                  <th>날짜</th>
                  <th>조회</th>
                </tr>
              </thead>
              <tbody>
                {displayList.length === 0 ? (
                  <tr><td colSpan={5} className="board-empty-cell">게시글이 없습니다.</td></tr>
                ) : pagedList.map((post, idx) => (
                  <tr
                    key={post.id}
                    className={`board-tr ${post.pinned ? 'board-tr--pinned' : ''}`}
                    onClick={() => handleOpenPost(post)}
                  >
                    <td className="board-td-no">
                      {post.pinned
                        ? <span className="board-pin-badge"><FiFlag size={10} /> 공지</span>
                        : <span className="board-td-num">{displayList.length - (currentPage - 1) * itemsPerPage - idx}</span>
                      }
                    </td>
                    <td className="board-td-title">
                      {post.type === 'notice' && activeCategory !== 'board-notice' && (
                        <span className="board-type-badge">공지</span>
                      )}
                      <span className="board-title-text">{post.title}</span>
                      {post.attachments?.length > 0 && (
                        <span className="board-attach-badge"><FiPaperclip size={10} /></span>
                      )}
                    </td>
                    <td className="board-td-author">{post.author || '-'}</td>
                    <td className="board-td-date">{formatDate(post.date)}</td>
                    <td className="board-td-views">{post.views || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── 상세 ── */}
        {mode === 'detail' && selectedPost && (
          <>
            <div className="board-subheader">
              <button className="board-back-btn" onClick={handleClose}>← 목록으로</button>
              <div className="board-subheader-actions">
                <button className="board-action-btn" onClick={handleOpenEdit}><FiEdit size={13} /> 수정</button>
                <button className="board-action-btn board-action-btn--danger" onClick={() => handleDelete(selectedPost.id)}><FiTrash2 size={13} /> 삭제</button>
              </div>
            </div>

            <div className="board-detail">
              <div className="board-detail-head">
                <div className="board-detail-badges">
                  {selectedPost.pinned && <span className="board-pin-badge"><FiFlag size={10} /> 공지</span>}
                  {selectedPost.type === 'notice' && <span className="board-type-badge">공지사항</span>}
                </div>
                <h2 className="board-detail-title">{selectedPost.title}</h2>
                <div className="board-detail-meta">
                  <span className="board-meta-author">{selectedPost.author || '익명'}</span>
                  <span className="board-meta-sep">·</span>
                  <span>{formatDate(selectedPost.date)}</span>
                  <span className="board-meta-sep">·</span>
                  <span>조회 {selectedPost.views || 0}</span>
                </div>
              </div>

              <div className="board-detail-body">{selectedPost.content}</div>

              {selectedPost.attachments?.length > 0 && (
                <div className="board-detail-files">
                  <p className="board-detail-files-label"><FiPaperclip size={13} /> 첨부파일 {selectedPost.attachments.length}개</p>
                  <div className="board-file-list">
                    {selectedPost.attachments.map(att => (
                      <a key={att.id} className="board-file-item" href={att.url} download={att.name} target="_blank" rel="noreferrer">
                        {att.isImage
                          ? <img src={att.url} alt={att.name} className="board-file-thumb" />
                          : <div className="board-file-icon"><FiFileText size={20} /></div>
                        }
                        <div className="board-file-info">
                          <span className="board-file-name">{att.name}</span>
                          <span className="board-file-size">{formatFileSize(att.size)}</span>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── 작성/수정 ── */}
        {mode === 'compose' && (
          <>
            <div className="board-subheader">
              <button className="board-back-btn" onClick={handleClose}>← 뒤로</button>
              <h1 className="board-subheader-title">{selectedPost ? '게시글 수정' : '새 게시글'}</h1>
            </div>

            <div className="board-compose">
              <div className="board-compose-row">
                <select
                  className="board-compose-select"
                  value={formData.type}
                  onChange={e => setFormData({ ...formData, type: e.target.value })}
                >
                  <option value="general">자유게시판</option>
                  <option value="notice">공지사항</option>
                </select>
                <label className="board-compose-pin">
                  <input type="checkbox" checked={formData.pinned} onChange={e => setFormData({ ...formData, pinned: e.target.checked })} />
                  상단 고정
                </label>
              </div>

              <input
                className="board-compose-input"
                type="text"
                placeholder="제목을 입력하세요"
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
              />

              <textarea
                className="board-compose-textarea"
                placeholder="내용을 입력하세요"
                value={formData.content}
                onChange={e => setFormData({ ...formData, content: e.target.value })}
              />

              <div className="board-compose-attach">
                <label className="board-compose-attach-btn">
                  <FiPaperclip size={13} /> 파일 첨부
                  <input ref={fileInputRef} type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.hwp,.txt" multiple onChange={handleAttachmentChange} style={{ display: 'none' }} />
                </label>
                {attachments.length > 0 && (
                  <div className="board-compose-file-list">
                    {attachments.map(att => (
                      <div key={att.id} className="board-compose-file-item">
                        <FiFileText size={13} />
                        <span>{att.name}</span>
                        <span className="board-compose-file-size">{formatFileSize(att.size)}</span>
                        <button type="button" onClick={() => setAttachments(prev => prev.filter(a => a.id !== att.id))}><FiX size={12} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="board-compose-actions">
                <button className="board-compose-cancel" onClick={handleClose}>취소</button>
                <button className="board-compose-submit" onClick={handleSave}>
                  {selectedPost ? '수정 완료' : '등록하기'}
                </button>
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  )
}
