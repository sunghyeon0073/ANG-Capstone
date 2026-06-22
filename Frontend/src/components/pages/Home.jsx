import '../../style/home.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import HomeCalendar from './HomeCalendar'
import Board from './Board'
import { reserveScheduledSend, getAiSchedules, cancelAiSchedule, updateAiSchedule } from '../../api/aiAssistantApi'
import { showAlert } from '../../utils/alertUtils'
import { searchUsers } from '../../api/userApi'
import { getMyDocuments } from '../../api/documentApi'
import {
  FiAlertCircle, FiCheck, FiChevronLeft, FiChevronRight,
  FiClock, FiEdit2, FiHome, FiLoader, FiMail, FiMessageSquare,
  FiPaperclip, FiSearch, FiSend, FiTrash2, FiUser, FiX
} from 'react-icons/fi'
import {
  getPendingInbox,
  getCompletedInbox,
  getRejectedInbox,
  getProgressOutbox,
} from '../../api/approvalApi'
import { unwrapList } from '../../utils/responseUtils'
import { toDateTimeLocalValue, toLocalDateTimePayload } from '../../utils/dateUtils'

const STEPS = ['수신자', '제목', '본문', '전송 방식', '파일 첨부', '예약 시간']

const STATUS_META = {
  ALL: { label: '전체', tone: 'is-all' },
  PENDING: { label: '대기', tone: 'is-pending' },
  PROCESSING: { label: '처리 중', tone: 'is-processing' },
  SENT: { label: '발송 완료', tone: 'is-sent' },
  FAILED: { label: '실패', tone: 'is-failed' },
  CANCELLED: { label: '취소됨', tone: 'is-cancelled' },
}

const STATUS_FILTERS = ['ALL', 'PENDING', 'SENT', 'FAILED', 'CANCELLED']

const extractDocumentList = response => unwrapList(response)

const getDocumentFileId = doc => doc?.fileId ?? doc?.file?.id ?? doc?.fileItemId ?? null

const formatScheduleTime = (value) => {
  if (!value) return '즉시 발송'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function ApprovalSummary({ onSubPageChange }) {
  const [counts, setCounts] = useState({ pending: null, completed: null, rejected: null, my: null })

  useEffect(() => {
    const extract = (res) => {
      const d = res?.data?.data
      if (!d) return 0
      if (typeof d.totalElements === 'number') return d.totalElements
      if (Array.isArray(d.content)) return d.content.length
      if (Array.isArray(d)) return d.length
      return 0
    }
    Promise.allSettled([
      getPendingInbox({ size: 999 }),
      getCompletedInbox({ size: 999 }),
      getRejectedInbox({ size: 999 }),
      getProgressOutbox({ size: 999 }),
    ]).then(([pending, completed, rejected, my]) => {
      setCounts({
        pending: pending.status === 'fulfilled' ? extract(pending.value) : 0,
        completed: completed.status === 'fulfilled' ? extract(completed.value) : 0,
        rejected: rejected.status === 'fulfilled' ? extract(rejected.value) : 0,
        my: my.status === 'fulfilled' ? extract(my.value) : 0,
      })
    })
  }, [])

  const items = [
    { label: '결재 대기', key: 'pending', page: 'esignature-waiting', color: '#f59e0b' },
    { label: '완료', key: 'completed', page: 'esignature-completed', color: '#10b981' },
    { label: '반려', key: 'rejected', page: 'esignature-rejected', color: '#ef4444' },
    { label: '내 요청', key: 'my', page: 'esignature-my', color: '#6366f1' },
  ]

  return (
    <div className="home-approval-summary">
      <div className="home-approval-header">
        <span className="home-approval-title">전자결재</span>
        <button className="home-approval-more" onClick={() => onSubPageChange?.('esignature-waiting')}>
          더보기
        </button>
      </div>
      <div className="home-approval-grid">
        {items.map(({ label, key, page, color }) => (
          <button key={key} className="home-approval-card" onClick={() => onSubPageChange?.(page)}>
            <span className="home-approval-count" style={{ color }}>
              {counts[key] === null ? '-' : counts[key]}
            </span>
            <span className="home-approval-label">{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function RecipientSelector({ selected, onChange }) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [searching, setSearching] = useState(false)
  const timerRef = useRef(null)

  const doSearch = useCallback(async (q) => {
    if (!q.trim()) { setSuggestions([]); return }
    setSearching(true)
    try {
      const res = await searchUsers(q)
      const data = res.data?.data ?? res.data ?? []
      setSuggestions((Array.isArray(data) ? data : []).filter(u => !selected.some(s => s.empNo === u.empNo)))
    } catch {
      setSuggestions([])
    } finally {
      setSearching(false)
    }
  }, [selected])

  useEffect(() => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => doSearch(query), 280)
    return () => clearTimeout(timerRef.current)
  }, [query, doSearch])

  const add = (user) => { onChange([...selected, user]); setQuery(''); setSuggestions([]) }
  const remove = (empNo) => onChange(selected.filter(u => u.empNo !== empNo))

  return (
    <div className="reserve-recipient">
      {selected.length > 0 && (
        <div className="reserve-recipient-tags">
          {selected.map(u => (
            <span key={u.empNo} className="reserve-recipient-tag">
              {u.name}
              <button type="button" onClick={() => remove(u.empNo)} aria-label={`${u.name} 제거`}>
                <FiX size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="reserve-recipient-search">
        <FiSearch size={14} className="reserve-recipient-icon" />
        <input
          type="text"
          placeholder="이름 또는 사번으로 검색"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="reserve-recipient-input"
          autoFocus
        />
        {searching && <FiLoader size={13} className="mascot-spin reserve-search-spinner" />}
      </div>
      {suggestions.length > 0 && (
        <ul className="reserve-recipient-dropdown">
          {suggestions.slice(0, 6).map(u => (
            <li key={u.empNo}>
              <button type="button" onClick={() => add(u)}>
                <span className="reserve-recipient-name">{u.name}</span>
                <span className="reserve-recipient-emp">{u.empNo}{u.deptName ? ` · ${u.deptName}` : ''}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { label: status, tone: '' }
  return <span className={`reserve-status-badge ${meta.tone}`}>{meta.label}</span>
}

function DocumentAttachmentPicker({ selectedDocs, onChange, selectedFileIds = [], onSelectedFileIdsChange }) {
  const [open, setOpen] = useState(false)
  const [documents, setDocuments] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const selectedIdSet = useMemo(
    () => new Set(selectedDocs.map(doc => getDocumentFileId(doc)).filter(Boolean)),
    [selectedDocs]
  )

  const selectedFileIdSet = useMemo(
    () => new Set(selectedFileIds.filter(Boolean)),
    [selectedFileIds]
  )
  const selectedCount = selectedDocs.length + selectedFileIdSet.size

  const loadDocuments = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getMyDocuments({ keyword: query.trim() || undefined, size: 80, page: 0 })
      setDocuments(extractDocumentList(res))
    } catch {
      setError('문서 목록을 불러오지 못했습니다.')
      setDocuments([])
    } finally {
      setLoading(false)
    }
  }, [query])

  useEffect(() => {
    if (!open) return undefined
    const timer = setTimeout(loadDocuments, 180)
    return () => clearTimeout(timer)
  }, [loadDocuments, open])

  const toggleDocument = (doc) => {
    const fileId = getDocumentFileId(doc)
    if (!fileId) return
    if (selectedIdSet.has(fileId)) {
      onChange(selectedDocs.filter(item => getDocumentFileId(item) !== fileId))
      return
    }
    if (selectedFileIdSet.has(fileId)) {
      onSelectedFileIdsChange?.(selectedFileIds.filter(id => id !== fileId))
      return
    }
    onChange([...selectedDocs, doc])
  }

  const removeDocument = (fileId) => {
    onChange(selectedDocs.filter(doc => getDocumentFileId(doc) !== fileId))
  }

  const removeExistingFile = (fileId) => {
    onSelectedFileIdsChange?.(selectedFileIds.filter(id => id !== fileId))
  }

  const clearSelection = () => {
    onChange([])
    onSelectedFileIdsChange?.([])
  }

  const visibleDocuments = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return documents
    return documents.filter(doc => [
      doc.title,
      doc.originalFileName,
      doc.scopeName,
      doc.fileContentType,
    ].filter(Boolean).join(' ').toLowerCase().includes(keyword))
  }, [documents, query])

  return (
    <div className="reserve-attachment">
      <div className="reserve-attachment-bar">
        <div>
          <strong>{selectedCount > 0 ? `${selectedCount}개 문서 선택됨` : '첨부할 문서를 선택하세요'}</strong>
          <span>메일 예약 발송 시 선택한 문서 파일이 함께 전송됩니다.</span>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
          <FiPaperclip size={13} /> 문서 선택
        </button>
      </div>

      {selectedDocs.length > 0 && (
        <div className="reserve-attachment-selected">
          {selectedDocs.map(doc => {
            const fileId = getDocumentFileId(doc)
            return (
              <span key={fileId || doc.docId} className="reserve-attachment-chip">
                {doc.title || doc.originalFileName || `파일 ${fileId}`}
                <button type="button" onClick={() => removeDocument(fileId)} aria-label="첨부 제거">
                  <FiX size={11} />
                </button>
              </span>
            )
          })}
        </div>
      )}

      {selectedFileIdSet.size > 0 && (
        <div className="reserve-attachment-selected">
          {selectedFileIds.map(fileId => (
            <span key={fileId} className="reserve-attachment-chip is-existing">
              기존 첨부 #{fileId}
              {onSelectedFileIdsChange && (
                <button type="button" onClick={() => removeExistingFile(fileId)} aria-label="기존 첨부 제거">
                  <FiX size={11} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {open && (
        <div className="reserve-modal-overlay" onClick={e => e.target === e.currentTarget && setOpen(false)}>
          <div className="reserve-modal reserve-document-modal">
            <div className="reserve-modal-header">
              <div>
                <span className="reserve-modal-title">문서 선택</span>
                <p className="reserve-modal-subtitle">문서생성의 내 문서 목록에서 첨부할 파일을 고릅니다.</p>
              </div>
              <button type="button" className="reserve-modal-close" onClick={() => setOpen(false)} aria-label="닫기">
                <FiX size={16} />
              </button>
            </div>
            <div className="reserve-document-search">
              <FiSearch size={15} />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="문서명, 파일명 검색"
                autoFocus
              />
            </div>
            <div className="reserve-document-list">
              {loading ? (
                <div className="reserve-document-empty">
                  <FiLoader size={18} className="mascot-spin" /> 문서를 불러오는 중입니다.
                </div>
              ) : error ? (
                <div className="reserve-document-empty">{error}</div>
              ) : visibleDocuments.length === 0 ? (
                <div className="reserve-document-empty">선택할 문서가 없습니다.</div>
              ) : (
                visibleDocuments.map(doc => {
                  const fileId = getDocumentFileId(doc)
                  const checked = selectedIdSet.has(fileId) || selectedFileIdSet.has(fileId)
                  const disabled = !fileId
                  return (
                    <button
                      type="button"
                      key={doc.docId || fileId}
                      className={`reserve-document-item ${checked ? 'is-selected' : ''}`}
                      onClick={() => toggleDocument(doc)}
                      disabled={disabled}
                    >
                      <span className="reserve-document-check">{checked ? <FiCheck size={13} /> : null}</span>
                      <span className="reserve-document-info">
                        <strong>{doc.title || doc.originalFileName || '제목 없음'}</strong>
                        <small>
                          {doc.originalFileName || '저장 문서'}
                          {doc.scopeName ? ` · ${doc.scopeName === 'N/A' ? '개인 문서' : doc.scopeName}` : ''}
                        </small>
                      </span>
                      {disabled && <span className="reserve-document-disabled">파일 없음</span>}
                    </button>
                  )
                })
              )}
            </div>
            <div className="reserve-modal-footer">
              <button type="button" className="btn btn-secondary" onClick={clearSelection}>선택 해제</button>
              <button type="button" className="btn btn-primary" onClick={() => setOpen(false)}>
                <FiCheck size={13} /> 선택 완료
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function EditModal({ item, onClose, onSaved }) {
  const [recipients, setRecipients] = useState(
    (item.recipientEmpNos || []).map((empNo, i) => ({ empNo, name: (item.recipientNames || [])[i] || empNo }))
  )
  const [subject, setSubject] = useState(item.title || '')
  const [body, setBody] = useState(item.message || '')
  const [channel, setChannel] = useState((item.channel || '').toUpperCase() === 'MAIL' ? 'mail' : 'chat')
  const [scheduledAt, setScheduledAt] = useState(toDateTimeLocalValue(item.scheduledAt))
  const [minScheduleAt] = useState(() => toDateTimeLocalValue(Date.now() + 60000))
  const [selectedDocs, setSelectedDocs] = useState([])
  const [retainedFileIds, setRetainedFileIds] = useState(item.fileIds || [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!body.trim()) { setError('본문을 입력해주세요.'); return }
    const selectedFileIds = Array.from(new Set([
      ...retainedFileIds,
      ...selectedDocs.map(getDocumentFileId).filter(Boolean),
    ]))
    setSaving(true)
    setError('')
    try {
      const updated = await updateAiSchedule(item.id, {
        recipientEmpNos: recipients.map(u => u.empNo),
        recipientNames: recipients.map(u => u.name),
        subject: subject.trim() || null,
        body: body.trim(),
        channel,
        scheduledAt: toLocalDateTimePayload(scheduledAt),
        fileIds: channel === 'mail' ? selectedFileIds : [],
      })
      onSaved(updated)
    } catch (err) {
      setError(err.response?.data?.message || '수정에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="reserve-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="reserve-modal">
        <div className="reserve-modal-header">
          <div>
            <span className="reserve-modal-title">예약 수정</span>
            <p className="reserve-modal-subtitle">대기 중인 예약만 수정할 수 있습니다.</p>
          </div>
          <button type="button" className="reserve-modal-close" onClick={onClose} aria-label="닫기">
            <FiX size={16} />
          </button>
        </div>
        <div className="reserve-modal-body">
          <label className="home-reserve-label"><FiUser size={13} /> 수신자</label>
          <RecipientSelector selected={recipients} onChange={setRecipients} />

          <label className="home-reserve-label">
            <FiMail size={13} /> 제목
            <span className="home-reserve-optional">선택</span>
          </label>
          <input className="home-reserve-input" value={subject} maxLength={200}
            onChange={e => setSubject(e.target.value)} placeholder="메일 제목" />

          <label className="home-reserve-label"><FiMessageSquare size={13} /> 본문</label>
          <textarea className="home-reserve-textarea" value={body} rows={4}
            onChange={e => setBody(e.target.value)} placeholder="보낼 내용을 입력하세요" />

          <label className="home-reserve-label"><FiSend size={13} /> 전송 방식</label>
          <div className="home-reserve-channel-group is-compact">
            <button type="button"
              className={`home-reserve-channel-btn ${channel === 'chat' ? 'is-selected' : ''}`}
              onClick={() => setChannel('chat')}>
              <FiMessageSquare size={18} /><span>채팅</span>
            </button>
            <button type="button"
              className={`home-reserve-channel-btn ${channel === 'mail' ? 'is-selected' : ''}`}
              onClick={() => setChannel('mail')}>
              <FiMail size={18} /><span>메일</span>
            </button>
          </div>

          <label className="home-reserve-label">
            <FiClock size={13} /> 예약 시간
            <span className="home-reserve-optional">비우면 즉시</span>
          </label>
          <input type="datetime-local" className="home-reserve-input"
            value={scheduledAt} onChange={e => setScheduledAt(e.target.value)}
            min={minScheduleAt} />

          <label className="home-reserve-label">
            <FiPaperclip size={13} /> 첨부 문서
            <span className="home-reserve-optional">메일 전용</span>
          </label>
          <DocumentAttachmentPicker
            selectedDocs={selectedDocs}
            onChange={setSelectedDocs}
            selectedFileIds={retainedFileIds}
            onSelectedFileIdsChange={setRetainedFileIds}
          />

          {error && <p className="home-reserve-error">{error}</p>}
        </div>
        <div className="reserve-modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>취소</button>
          <button type="button" className="btn btn-primary" onClick={handleSave}
            disabled={saving || !body.trim()}>
            {saving
              ? <><FiLoader size={13} className="mascot-spin" /> 저장 중</>
              : <><FiCheck size={13} /> 저장</>}
          </button>
        </div>
      </div>
    </div>
  )
}

function ReserveList({ onSubPageChange }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editItem, setEditItem] = useState(null)
  const [cancelling, setCancelling] = useState(null)
  const [activeStatus, setActiveStatus] = useState('ALL')
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getAiSchedules()
      setItems(Array.isArray(data) ? data : [])
    } catch {
      setError('예약 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load]) // eslint-disable-line react-hooks/set-state-in-effect

  const stats = useMemo(() => {
    return items.reduce((acc, item) => {
      acc.ALL += 1
      acc[item.status] = (acc[item.status] || 0) + 1
      return acc
    }, { ALL: 0, PENDING: 0, SENT: 0, FAILED: 0, CANCELLED: 0, PROCESSING: 0 })
  }, [items])

  const filteredItems = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    return items.filter(item => {
      const statusMatch = activeStatus === 'ALL' || item.status === activeStatus
      if (!statusMatch) return false
      if (!keyword) return true
      const haystack = [
        item.title,
        item.message,
        item.channel,
        ...(item.recipientNames || []),
        ...(item.recipientEmpNos || []),
      ].filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(keyword)
    })
  }, [activeStatus, items, query])

  const nextPending = useMemo(() => {
    return items
      .filter(item => item.status === 'PENDING' && item.scheduledAt)
      .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))[0]
  }, [items])

  const handleCancel = async (id) => {
    if (!window.confirm('이 예약을 취소하시겠습니까?')) return
    setCancelling(id)
    try {
      await cancelAiSchedule(id)
      setItems(prev => prev.map(it => it.id === id ? { ...it, status: 'CANCELLED' } : it))
    } catch (err) {
      showAlert(err.response?.data?.message || '취소에 실패했습니다.', 'error')
    } finally {
      setCancelling(null)
    }
  }

  const handleSaved = async (updated) => {
    setItems(prev => prev.map(it => it.id === updated.id ? updated : it))
    setEditItem(null)
    await load()
  }

  if (loading) {
    return (
      <div className="reserve-list-loading">
        <FiLoader size={20} className="mascot-spin" /> 예약 목록을 불러오는 중입니다.
      </div>
    )
  }

  return (
    <div className="reserve-list-page">
      <div className="reserve-list-hero">
        <div>
          <p className="reserve-list-kicker">예약 전송 관리</p>
          <h2 className="reserve-list-title">보낼 메시지와 상태를 한 곳에서 관리합니다</h2>
          <p className="reserve-list-subtitle">
            {nextPending
              ? `다음 발송: ${formatScheduleTime(nextPending.scheduledAt)} · ${(nextPending.recipientNames || []).join(', ') || '수신자 없음'}`
              : '대기 중인 예약이 없습니다.'}
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => onSubPageChange?.('home-dashboard')}>
          <FiSend size={13} /> 새 예약
        </button>
      </div>

      <div className="reserve-list-toolbar">
        <div className="reserve-list-search">
          <FiSearch size={15} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="수신자, 제목, 본문 검색"
          />
        </div>
        <div className="reserve-list-filters" role="tablist" aria-label="예약 상태 필터">
          {STATUS_FILTERS.map(status => (
            <button
              type="button"
              key={status}
              className={`reserve-filter-btn ${activeStatus === status ? 'is-active' : ''}`}
              onClick={() => setActiveStatus(status)}
            >
              <span>{STATUS_META[status].label}</span>
              <strong>{stats[status] || 0}</strong>
            </button>
          ))}
        </div>
      </div>

      {error && <p className="home-reserve-error">{error}</p>}

      {items.length === 0 ? (
        <div className="reserve-list-empty">
          <FiClock size={36} />
          <p>등록된 예약 전송이 없습니다.</p>
          <button type="button" className="btn btn-primary" onClick={() => onSubPageChange?.('home-dashboard')}>
            첫 예약 만들기
          </button>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="reserve-list-empty">
          <FiSearch size={34} />
          <p>조건에 맞는 예약이 없습니다.</p>
          <button type="button" className="btn btn-secondary" onClick={() => { setQuery(''); setActiveStatus('ALL') }}>
            필터 초기화
          </button>
        </div>
      ) : (
        <ul className="reserve-list">
          {filteredItems.map(item => {
            const isMail = (item.channel || '').toUpperCase() === 'MAIL'
            const recipients = (item.recipientNames || []).join(', ') || '수신자 없음'
            const canEdit = item.status === 'PENDING'
            return (
              <li key={item.id} className={`reserve-card ${item.status === 'CANCELLED' ? 'is-cancelled' : ''}`}>
                <div className="reserve-card-main">
                  <div className="reserve-card-icon">
                    {isMail ? <FiMail size={18} /> : <FiMessageSquare size={18} />}
                  </div>
                  <div className="reserve-card-content">
                    <div className="reserve-card-top">
                      <div className="reserve-card-channel">{isMail ? '메일' : '채팅'}</div>
                      <StatusBadge status={item.status} />
                    </div>
                    <div className="reserve-card-subject">
                      {item.title || (isMail ? '제목 없음' : '채팅 메시지')}
                    </div>
                    <div className="reserve-card-body">
                      {item.message && item.message.length > 130
                        ? `${item.message.slice(0, 130)}...`
                        : item.message || '본문 없음'}
                    </div>
                    <div className="reserve-card-meta">
                      <span><FiUser size={12} />{recipients}</span>
                      <span><FiClock size={12} />{formatScheduleTime(item.scheduledAt)}</span>
                      {(item.fileIds || []).length > 0 && (
                        <span><FiPaperclip size={12} />첨부 {(item.fileIds || []).length}개</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="reserve-card-actions">
                  {canEdit ? (
                    <>
                      <button type="button" className="reserve-action-btn is-edit" onClick={() => setEditItem(item)}>
                        <FiEdit2 size={13} /> 수정
                      </button>
                      <button type="button" className="reserve-action-btn is-cancel"
                        onClick={() => handleCancel(item.id)}
                        disabled={cancelling === item.id}>
                        {cancelling === item.id
                          ? <FiLoader size={13} className="mascot-spin" />
                          : <FiTrash2 size={13} />} 취소
                      </button>
                    </>
                  ) : (
                    <span className="reserve-card-locked">관리 완료</span>
                  )}
                </div>

                {item.status === 'FAILED' && item.errorMessage && (
                  <div className="reserve-card-error-msg">
                    <FiAlertCircle size={12} />
                    {item.errorMessage.slice(0, 100)}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {editItem && (
        <EditModal item={editItem} onClose={() => setEditItem(null)} onSaved={handleSaved} />
      )}
    </div>
  )
}

const HOME_NAV = [
  { id: 'home-dashboard', label: '대시보드', icon: FiHome },
  { id: 'home-reserve-list', label: '예약 목록', icon: FiClock },
]

export default function Home({ currentSubPage, onSubPageChange }) {
  const [step, setStep] = useState(0)
  const [recipients, setRecipients] = useState([])
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [channel, setChannel] = useState('chat')
  const [scheduledAt, setScheduledAt] = useState('')
  const [minScheduleAt] = useState(() => toDateTimeLocalValue(Date.now() + 60000))
  const [selectedDocs, setSelectedDocs] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(null)
  const [error, setError] = useState('')

  const reset = () => {
    setStep(0); setRecipients([]); setSubject(''); setBody('')
    setChannel('chat'); setScheduledAt(''); setSelectedDocs([]); setDone(null); setError('')
  }

  const canNext = () => {
    if (step === 0) return recipients.length > 0
    if (step === 2) return body.trim().length > 0
    return true
  }

  const handleSubmit = async () => {
    const selectedFileIds = selectedDocs.map(getDocumentFileId).filter(Boolean)
    setSubmitting(true)
    setError('')
    try {
      const result = await reserveScheduledSend({
        recipientEmpNos: recipients.map(u => u.empNo),
        recipientNames: recipients.map(u => u.name),
        subject: subject.trim() || null,
        body: body.trim(),
        channel,
        fileIds: channel === 'mail' ? selectedFileIds : [],
        scheduledAt: toLocalDateTimePayload(scheduledAt),
      })
      setDone(result)
      window.dispatchEvent(new CustomEvent('ang:mascot-alert', {
        detail: {
          message: `${recipients.map(u => u.name).join(', ')}에게 ${channel === 'mail' ? '메일' : '채팅'} 예약이 등록됐어요.`,
          animation: 'run',
        }
      }))
    } catch (err) {
      setError(err.response?.data?.message || '예약 등록에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="org-workspace">
      <aside className="home-rail">
        <div className="home-rail-header">
          <span className="home-rail-title">홈</span>
        </div>
        <nav className="home-nav">
          {HOME_NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`home-nav-item ${currentSubPage === id || (id === 'home-dashboard' && currentSubPage !== 'home-reserve-list') ? 'active' : ''}`}
              onClick={() => onSubPageChange?.(id)}
            >
              <Icon size={15} />
              <span className="home-nav-label">{label}</span>
            </button>
          ))}
        </nav>
      </aside>
      <div className="home-content">
        {currentSubPage === 'home-reserve-list' ? (
          <ReserveList onSubPageChange={onSubPageChange} />
        ) : (
          <div className="home-page">
            <section className="home-panel home-calendar-panel">
              <HomeCalendar onNavigateToCalendar={() => onSubPageChange?.('calendar')} />
            </section>

            <div className="home-dashboard-grid">
              <div className="home-reserve-card">
                <div className="home-reserve-header">
                  <div>
                    <div className="home-reserve-title">예약 발송</div>
                    <div className="home-reserve-meta">메일과 채팅 메시지를 원하는 시간에 자동 발송합니다.</div>
                  </div>
                  <button type="button" className="btn btn-secondary" onClick={() => onSubPageChange?.('home-reserve-list')}>
                    <FiClock size={13} /> 예약 목록
                  </button>
                </div>

                {done ? (
                  <div className="home-reserve-done">
                    <div className="home-reserve-done-icon"><FiCheck size={28} /></div>
                    <p className="home-reserve-done-title">예약이 등록됐습니다.</p>
                    <p className="home-reserve-done-preview">{done.preview}</p>
                    <div className="home-reserve-done-actions">
                      <button type="button" className="btn btn-primary" onClick={reset}>새 예약</button>
                      <button type="button" className="btn btn-secondary" onClick={() => onSubPageChange?.('home-reserve-list')}>
                        예약 목록
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="home-reserve-steps">
                      {STEPS.map((label, i) => (
                        <div key={label} className={`home-reserve-step ${i === step ? 'is-active' : ''} ${i < step ? 'is-done' : ''}`}>
                          <div className="home-reserve-step-dot">
                            {i < step ? <FiCheck size={10} /> : <span>{i + 1}</span>}
                          </div>
                          <span className="home-reserve-step-label">{label}</span>
                        </div>
                      ))}
                    </div>

                    <div className="home-reserve-body">
                      {step === 0 && (
                        <div className="home-reserve-step-content">
                          <label className="home-reserve-label"><FiUser size={13} /> 수신자</label>
                          <RecipientSelector selected={recipients} onChange={setRecipients} />
                          {recipients.length === 0 && (
                            <p className="home-reserve-hint">한 명 이상 선택해야 다음 단계로 넘어갈 수 있습니다.</p>
                          )}
                        </div>
                      )}

                      {step === 1 && (
                        <div className="home-reserve-step-content">
                          <label className="home-reserve-label">
                            <FiMail size={13} /> 제목
                            <span className="home-reserve-optional">선택</span>
                          </label>
                          <input
                            type="text"
                            className="home-reserve-input"
                            placeholder={channel === 'mail' ? '메일 제목을 입력하세요' : '채팅은 제목 없이 보낼 수 있습니다'}
                            value={subject}
                            onChange={e => setSubject(e.target.value)}
                            maxLength={200}
                            autoFocus
                          />
                        </div>
                      )}

                      {step === 2 && (
                        <div className="home-reserve-step-content">
                          <label className="home-reserve-label"><FiMessageSquare size={13} /> 본문</label>
                          <textarea
                            className="home-reserve-textarea"
                            placeholder="보낼 내용을 입력하세요"
                            value={body}
                            onChange={e => setBody(e.target.value)}
                            rows={5}
                            autoFocus
                          />
                        </div>
                      )}

                      {step === 3 && (
                        <div className="home-reserve-step-content">
                          <label className="home-reserve-label"><FiSend size={13} /> 전송 방식</label>
                          <div className="home-reserve-channel-group">
                            <button type="button"
                              className={`home-reserve-channel-btn ${channel === 'chat' ? 'is-selected' : ''}`}
                              onClick={() => setChannel('chat')}>
                              <FiMessageSquare size={22} />
                              <span>채팅</span>
                            </button>
                            <button type="button"
                              className={`home-reserve-channel-btn ${channel === 'mail' ? 'is-selected' : ''}`}
                              onClick={() => setChannel('mail')}>
                              <FiMail size={22} />
                              <span>메일</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {step === 4 && (
                        <div className="home-reserve-step-content">
                          <label className="home-reserve-label">
                            <FiPaperclip size={13} /> 파일 첨부
                            <span className="home-reserve-optional">메일 전용</span>
                          </label>
                          <DocumentAttachmentPicker selectedDocs={selectedDocs} onChange={setSelectedDocs} />
                          {channel !== 'mail' && selectedDocs.length > 0 && (
                            <p className="home-reserve-hint">현재 채팅 예약은 첨부 발송을 지원하지 않아, 메일 방식일 때만 첨부됩니다.</p>
                          )}
                        </div>
                      )}

                      {step === 5 && (
                        <div className="home-reserve-step-content">
                          <label className="home-reserve-label">
                            <FiClock size={13} /> 예약 시간
                            <span className="home-reserve-optional">비우면 즉시 발송</span>
                          </label>
                          <input
                            type="datetime-local"
                            className="home-reserve-input"
                            value={scheduledAt}
                            onChange={e => setScheduledAt(e.target.value)}
                            min={minScheduleAt}
                            autoFocus
                          />

                          <div className="home-reserve-summary">
                            <p><strong>수신자</strong>{recipients.map(u => u.name).join(', ')}</p>
                            {subject && <p><strong>제목</strong>{subject}</p>}
                            <p><strong>본문</strong>{body.length > 80 ? `${body.slice(0, 80)}...` : body}</p>
                            <p><strong>방식</strong>{channel === 'mail' ? '메일' : '채팅'}</p>
                            <p><strong>첨부</strong>{channel === 'mail' && selectedDocs.length > 0 ? `${selectedDocs.length}개 문서` : '없음'}</p>
                            <p><strong>시간</strong>{scheduledAt ? new Date(scheduledAt).toLocaleString('ko-KR') : '즉시 발송'}</p>
                          </div>

                          {error && <p className="home-reserve-error">{error}</p>}
                        </div>
                      )}
                    </div>

                    <div className="home-reserve-nav">
                      <button type="button" className="btn btn-secondary"
                        onClick={() => setStep(s => s - 1)} disabled={step === 0}>
                        <FiChevronLeft size={14} /> 이전
                      </button>

                      {step < STEPS.length - 1 ? (
                        <button type="button" className="btn btn-primary"
                          onClick={() => setStep(s => s + 1)} disabled={!canNext()}>
                          다음 <FiChevronRight size={14} />
                        </button>
                      ) : (
                        <button type="button" className="btn btn-primary"
                          onClick={handleSubmit} disabled={submitting || !body.trim()}>
                          {submitting
                            ? <><FiLoader size={14} className="mascot-spin" /> 등록 중</>
                            : <><FiCheck size={14} /> 예약 확정</>}
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>

              <section className="home-panel home-board-panel">
                <Board currentSubPage="board" maxItems={5} onSubPageChange={onSubPageChange} />
              </section>
              <section className="home-panel home-approval-panel">
                <ApprovalSummary onSubPageChange={onSubPageChange} />
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
