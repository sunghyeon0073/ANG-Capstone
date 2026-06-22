import '../../style/board.css'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { FiDownload, FiEdit, FiFileText, FiFlag, FiPaperclip, FiStar, FiTrash2, FiX } from 'react-icons/fi'
import FileSourceModal from '../common/FileSourceModal'
import { showAlert } from '../../utils/alertUtils'
import {
  getBoardPosts,
  createBoardPost,
  updateBoardPost,
  deleteBoardPost,
  incrementBoardViews,
  uploadBoardAttachment,
  downloadBoardAttachment,
  deleteBoardAttachment,
} from '../../api/boardApi'

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

const categoryToType = (catId) => {
  if (catId === 'board-notice') return 'notice'
  if (catId === 'board-general') return 'general'
  if (catId === 'board-my') return 'my'
  return null
}

export default function Board({ me, currentSubPage = 'board', onSubPageChange, maxItems, onNavigateToBoard }) {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')
  const [mode, setMode] = useState('list')
  const [selectedPost, setSelectedPost] = useState(null)
  const [formData, setFormData] = useState({ title: '', content: '', type: 'general', pinned: false })
  const [attachments, setAttachments] = useState([])      // 새로 선택한 File 객체 목록
  const [savedAttachments, setSavedAttachments] = useState([]) // 서버에 저장된 첨부 목록
  const [toast, setToast] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [internalCategory, setInternalCategory] = useState(currentSubPage)
  const [totalCount, setTotalCount] = useState(0)
  const [showFileSourceModal, setShowFileSourceModal] = useState(false)
  const itemsPerPage = maxItems != null ? maxItems : 13

  const isDashboard = maxItems != null

  const loadPosts = useCallback(async (catId) => {
    setLoading(true)
    try {
      const type = categoryToType(catId ?? internalCategory)
      const res = await getBoardPosts(type)
      const data = res.data?.data ?? []
      setPosts(data)
      if (!type) setTotalCount(data.length)
    } catch {
      setPosts([])
    } finally {
      setLoading(false)
    }
  }, [internalCategory])

  useEffect(() => {
    setInternalCategory(currentSubPage)
    loadPosts(currentSubPage)
    setMode('list')
    setSelectedPost(null)
    // 전체 탭이 아닌 경우에도 전체 게시글 수 유지
    if (currentSubPage !== 'board') {
      getBoardPosts(null).then(res => setTotalCount((res.data?.data ?? []).length)).catch(() => {})
    }
  }, [currentSubPage]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setCurrentPage(1) }, [internalCategory, q])

  const activeCategory = internalCategory

  const showMsg = (message) => {
    setToast(message)
    setTimeout(() => setToast(null), 2000)
  }

  const displayList = useMemo(() => {
    const kw = q.trim().toLowerCase()
    if (!kw) return posts
    return posts.filter(p =>
      p.title?.toLowerCase().includes(kw) || p.content?.toLowerCase().includes(kw)
    )
  }, [posts, q])

  const totalPages = Math.max(1, Math.ceil(displayList.length / itemsPerPage))
  const pagedList = displayList.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  useEffect(() => {
    setCurrentPage(p => Math.min(Math.max(1, p), totalPages))
  }, [totalPages])

  const resetForm = () => {
    setFormData({ title: '', content: '', type: 'general', pinned: false })
    setAttachments([])
    setSavedAttachments([])
  }

  const handleOpenCompose = () => { setSelectedPost(null); resetForm(); setMode('compose') }

  const handleOpenPost = async (post) => {
    try {
      const res = await incrementBoardViews(post.id)
      const updated = res.data?.data ?? post
      setSelectedPost(updated)
      setPosts(prev => prev.map(p => p.id === updated.id ? updated : p))
    } catch {
      setSelectedPost(post)
    }
    setMode('detail')
  }

  const handleOpenEdit = () => {
    if (!selectedPost) return
    setFormData({ title: selectedPost.title, content: selectedPost.content, type: selectedPost.type, pinned: selectedPost.pinned || false })
    setAttachments([])
    setSavedAttachments(selectedPost.attachments || [])
    setMode('compose')
  }

  const handleFilesAdded = (files) => {
    if (!files.length) return
    setAttachments(prev => [...prev, ...files])
  }

  const handleDownload = async (att) => {
    try {
      const res = await downloadBoardAttachment(att.attachmentId)
      const url = URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url; a.download = att.fileName; a.click()
      URL.revokeObjectURL(url)
    } catch {
      showAlert('파일 다운로드에 실패했습니다.', 'error')
    }
  }

  const handleDeleteSavedAttachment = async (attachmentId) => {
    try {
      await deleteBoardAttachment(attachmentId)
      setSavedAttachments(prev => prev.filter(a => a.attachmentId !== attachmentId))
      setSelectedPost(prev => prev ? { ...prev, attachments: prev.attachments.filter(a => a.attachmentId !== attachmentId) } : prev)
    } catch {
      showAlert('첨부파일 삭제에 실패했습니다.', 'error')
    }
  }

  const handleSave = async () => {
    if (!formData.title.trim() || !formData.content.trim()) { showAlert('제목과 내용을 모두 입력하세요.', 'warning'); return }
    try {
      let postId
      if (selectedPost) {
        const res = await updateBoardPost(selectedPost.id, formData)
        postId = selectedPost.id
        // 새 파일 업로드
        for (const file of attachments) {
          await uploadBoardAttachment(postId, file)
        }
        // 최신 데이터 다시 조회
        const refreshed = await getBoardPosts(categoryToType(internalCategory))
        const refreshedList = refreshed.data?.data ?? []
        setPosts(refreshedList)
        const updated = refreshedList.find(p => p.id === postId) || res.data?.data
        setSelectedPost(updated)
        showMsg('수정되었습니다.')
        setMode('detail')
      } else {
        const res = await createBoardPost(formData)
        const created = res.data?.data
        postId = created?.id
        // 새 파일 업로드
        if (postId) {
          for (const file of attachments) {
            await uploadBoardAttachment(postId, file)
          }
          // 첨부 포함 최신 데이터 다시 조회
          const refreshed = await getBoardPosts(categoryToType(internalCategory))
          setPosts(refreshed.data?.data ?? [])
        } else if (created) {
          setPosts(prev => [created, ...prev])
        }
        showMsg('등록되었습니다.')
        setMode('list')
      }
      resetForm()
    } catch {
      showAlert('저장에 실패했습니다.', 'error')
    }
  }

  const handleDelete = async (postId) => {
    if (!window.confirm('삭제하시겠습니까?')) return
    try {
      await deleteBoardPost(postId)
      setPosts(prev => prev.filter(p => p.id !== postId))
      setSelectedPost(null); setMode('list'); resetForm(); showMsg('삭제되었습니다.')
    } catch {
      showAlert('삭제에 실패했습니다.', 'error')
    }
  }

  const handleClose = () => { setMode('list'); setSelectedPost(null); resetForm() }

  const handleCategoryChange = (catId) => {
    setInternalCategory(catId)
    if (!isDashboard) onSubPageChange?.(catId)
    setMode('list')
    setSelectedPost(null)
    loadPosts(catId)
    if (catId !== 'board') {
      getBoardPosts(null).then(res => setTotalCount((res.data?.data ?? []).length)).catch(() => {})
    }
  }

  const isMyPost = (post) => post.authorId === me?.id

  // ── Dashboard mode (compact) ──────────────────────────────────────────────
  if (isDashboard) {
    return (
      <div className="board-dash-wrap">
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

        <div className="board-dash-col-header">
          <span className="board-dash-col board-dash-col--no">구분</span>
          <span className="board-dash-col board-dash-col--title">제목</span>
          <span className="board-dash-col board-dash-col--author">작성자</span>
          <span className="board-dash-col board-dash-col--date">날짜</span>
          <span className="board-dash-col board-dash-col--views">조회</span>
        </div>

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
                <span className="board-dash-col board-dash-col--date">{formatDate(post.createdAt)}</span>
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

        {mode === 'list' && (
          <div className="board-tabs">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                className={`board-tab ${activeCategory === cat.id ? 'active' : ''}`}
                onClick={() => handleCategoryChange(cat.id)}
              >
                {cat.label}
                {cat.id === 'board' && <span className="board-tab-count">{totalCount}</span>}
              </button>
            ))}
          </div>
        )}

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
                {loading ? (
                  <tr><td colSpan={5} className="board-empty-cell">불러오는 중...</td></tr>
                ) : displayList.length === 0 ? (
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
                    <td className="board-td-date">{formatDate(post.createdAt)}</td>
                    <td className="board-td-views">{post.views || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {mode === 'detail' && selectedPost && (
          <>
            <div className="board-subheader">
              <button className="board-back-btn" onClick={handleClose}>← 목록으로</button>
              {isMyPost(selectedPost) && (
                <div className="board-subheader-actions">
                  <button className="board-action-btn" onClick={handleOpenEdit}><FiEdit size={13} /> 수정</button>
                  <button className="board-action-btn board-action-btn--danger" onClick={() => handleDelete(selectedPost.id)}><FiTrash2 size={13} /> 삭제</button>
                </div>
              )}
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
                  <span>{formatDate(selectedPost.createdAt)}</span>
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
                      <div key={att.attachmentId} className="board-file-item" onClick={() => handleDownload(att)}>
                        <div className="board-file-icon"><FiFileText size={20} /></div>
                        <div className="board-file-info">
                          <span className="board-file-name">{att.fileName}</span>
                          <span className="board-file-size">{formatFileSize(att.fileSize)}</span>
                        </div>
                        <FiDownload size={14} className="board-file-download-icon" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

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

              {/* 기존 첨부파일 (수정 시) */}
              {savedAttachments.length > 0 && (
                <div className="board-compose-saved-files">
                  <span className="board-compose-file-label">첨부된 파일</span>
                  {savedAttachments.map(att => (
                    <div key={att.attachmentId} className="board-compose-file-item">
                      <FiFileText size={13} />
                      <span>{att.fileName}</span>
                      <span className="board-compose-file-size">{formatFileSize(att.fileSize)}</span>
                      <button type="button" onClick={() => handleDeleteSavedAttachment(att.attachmentId)}><FiX size={12} /></button>
                    </div>
                  ))}
                </div>
              )}

              <div className="board-compose-attach">
                <button
                  type="button"
                  className="board-compose-attach-btn"
                  onClick={() => setShowFileSourceModal(true)}
                >
                  <FiPaperclip size={13} /> 파일 첨부
                </button>
                <FileSourceModal
                  isOpen={showFileSourceModal}
                  onClose={() => setShowFileSourceModal(false)}
                  onFilesSelected={handleFilesAdded}
                  multiple={true}
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.hwp,.txt"
                />
                {attachments.length > 0 && (
                  <div className="board-compose-file-list">
                    {attachments.map((file, idx) => (
                      <div key={idx} className="board-compose-file-item">
                        <FiFileText size={13} />
                        <span>{file.name}</span>
                        <span className="board-compose-file-size">{formatFileSize(file.size)}</span>
                        <button type="button" onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}><FiX size={12} /></button>
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
