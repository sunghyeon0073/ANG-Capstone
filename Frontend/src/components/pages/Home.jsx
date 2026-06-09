import { useCallback, useEffect, useRef, useState } from 'react'
import HomeCalendar from './HomeCalendar'
import Board from './Board'
import { reserveScheduledSend, getAiSchedules, cancelAiSchedule, updateAiSchedule } from '../../api/aiAssistantApi'
import { searchUsers } from '../../api/userApi'
import {
  FiAlertCircle, FiCheck, FiChevronLeft, FiChevronRight,
  FiClock, FiEdit2, FiLoader, FiMail, FiMessageSquare,
  FiPaperclip, FiSearch, FiSend, FiTrash2, FiUser, FiX
} from 'react-icons/fi'

const STEPS = ['수신자', '제목', '본문', '전송 방식', '파일 첨부', '예약 시간']

// ── shared sub-component ──────────────────────────────────────────────────────

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
    } catch { setSuggestions([]) }
    finally { setSearching(false) }
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
              <button type="button" onClick={() => remove(u.empNo)}><FiX size={11} /></button>
            </span>
          ))}
        </div>
      )}
      <div className="reserve-recipient-search">
        <FiSearch size={14} className="reserve-recipient-icon" />
        <input
          type="text"
          placeholder="이름 또는 사번으로 검색..."
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
                <span className="reserve-recipient-emp">{u.empNo}{u.deptName ? ' · ' + u.deptName : ''}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── reserve list components ───────────────────────────────────────────────────

function StatusBadge({ status }) {
  const map = {
    PENDING:    { label: '대기 중',   cls: 'is-pending' },
    PROCESSING: { label: '처리 중',   cls: 'is-processing' },
    SENT:       { label: '발송 완료', cls: 'is-sent' },
    FAILED:     { label: '실패',      cls: 'is-failed' },
    CANCELLED:  { label: '취소됨',    cls: 'is-cancelled' },
  }
  const s = map[status] || { label: status, cls: '' }
  return <span className={`reserve-status-badge ${s.cls}`}>{s.label}</span>
}

function EditModal({ item, onClose, onSaved }) {
  const [recipients, setRecipients] = useState(
    (item.recipientEmpNos || []).map((empNo, i) => ({ empNo, name: (item.recipientNames || [])[i] || empNo }))
  )
  const [subject, setSubject]     = useState(item.title || '')
  const [body, setBody]           = useState(item.message || '')
  const [channel, setChannel]     = useState((item.channel || '').toUpperCase() === 'MAIL' ? 'mail' : 'chat')
  const [scheduledAt, setScheduledAt] = useState(
    item.scheduledAt ? new Date(item.scheduledAt).toISOString().slice(0, 16) : ''
  )
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const handleSave = async () => {
    if (!body.trim()) { setError('본문을 입력해주세요.'); return }
    setSaving(true)
    setError('')
    try {
      const updated = await updateAiSchedule(item.id, {
        recipientEmpNos: recipients.map(u => u.empNo),
        recipientNames:  recipients.map(u => u.name),
        subject: subject.trim() || null,
        body:    body.trim(),
        channel,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString().replace('Z', '') : null,
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
          <span className="reserve-modal-title">예약 수정</span>
          <button type="button" className="reserve-modal-close" onClick={onClose}><FiX size={16} /></button>
        </div>
        <div className="reserve-modal-body">
          <label className="home-reserve-label"><FiUser size={13} /> 수신자</label>
          <RecipientSelector selected={recipients} onChange={setRecipients} />

          <label className="home-reserve-label" style={{ marginTop: 4 }}>
            <FiMail size={13} /> 제목
            <span className="home-reserve-optional">선택</span>
          </label>
          <input className="home-reserve-input" value={subject} maxLength={200}
            onChange={e => setSubject(e.target.value)} placeholder="메일 제목 (선택)" />

          <label className="home-reserve-label"><FiMessageSquare size={13} /> 본문</label>
          <textarea className="home-reserve-textarea" value={body} rows={4}
            onChange={e => setBody(e.target.value)} placeholder="보낼 내용을 입력하세요" />

          <label className="home-reserve-label"><FiSend size={13} /> 전송 방식</label>
          <div className="home-reserve-channel-group" style={{ marginBottom: 2 }}>
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
            min={new Date(Date.now() + 60000).toISOString().slice(0, 16)} />

          {error && <p className="home-reserve-error">{error}</p>}
        </div>
        <div className="reserve-modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>취소</button>
          <button type="button" className="btn btn-primary" onClick={handleSave}
            disabled={saving || !body.trim()}>
            {saving
              ? <><FiLoader size={13} className="mascot-spin" /> 저장 중...</>
              : <><FiCheck size={13} /> 저장</>}
          </button>
        </div>
      </div>
    </div>
  )
}

function ReserveList({ onSubPageChange }) {
  const [items, setItems]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [editItem, setEditItem] = useState(null)
  const [cancelling, setCancelling] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getAiSchedules()
      setItems(Array.isArray(data) ? data : [])
    } catch {
      setError('목록을 불러오지 못했어요.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleCancel = async (id) => {
    if (!window.confirm('이 예약을 취소하시겠어요?')) return
    setCancelling(id)
    try {
      await cancelAiSchedule(id)
      setItems(prev => prev.map(it => it.id === id ? { ...it, status: 'CANCELLED' } : it))
    } catch (err) {
      alert(err.response?.data?.message || '취소에 실패했습니다.')
    } finally {
      setCancelling(null)
    }
  }

  const handleSaved = (updated) => {
    setItems(prev => prev.map(it => it.id === updated.id ? updated : it))
    setEditItem(null)
  }

  if (loading) {
    return (
      <div className="reserve-list-loading">
        <FiLoader size={20} className="mascot-spin" /> 불러오는 중...
      </div>
    )
  }

  return (
    <div className="reserve-list-page">
      <div className="reserve-list-header">
        <h2 className="reserve-list-title">예약 목록</h2>
        <button type="button" className="btn btn-primary"
          onClick={() => onSubPageChange?.('home-dashboard')}>
          <FiSend size={13} /> 새 예약
        </button>
      </div>

      {error && <p className="home-reserve-error">{error}</p>}

      {items.length === 0 ? (
        <div className="reserve-list-empty">
          <FiClock size={36} />
          <p>예약된 발송이 없어요</p>
          <button type="button" className="btn btn-primary"
            onClick={() => onSubPageChange?.('home-dashboard')}>
            첫 예약 만들기
          </button>
        </div>
      ) : (
        <ul className="reserve-list">
          {items.map(item => (
            <li key={item.id} className={`reserve-card ${item.status === 'CANCELLED' ? 'is-cancelled' : ''}`}>
              <div className="reserve-card-top">
                <div className="reserve-card-channel">
                  {(item.channel || '').toUpperCase() === 'MAIL'
                    ? <><FiMail size={13} /> 메일</>
                    : <><FiMessageSquare size={13} /> 채팅</>}
                </div>
                <StatusBadge status={item.status} />
              </div>

              <div className="reserve-card-recipients">
                {(item.recipientNames || []).join(', ') || '수신자 없음'}
              </div>

              {item.title && (
                <div className="reserve-card-subject">{item.title}</div>
              )}

              <div className="reserve-card-body">
                {item.message && item.message.length > 120
                  ? item.message.slice(0, 120) + '...'
                  : item.message}
              </div>

              <div className="reserve-card-footer">
                <div className="reserve-card-time">
                  <FiClock size={11} />
                  {item.scheduledAt
                    ? new Date(item.scheduledAt).toLocaleString('ko-KR')
                    : '즉시 발송'}
                </div>

                {item.status === 'PENDING' && (
                  <div className="reserve-card-actions">
                    <button type="button" className="reserve-action-btn is-edit"
                      onClick={() => setEditItem(item)}>
                      <FiEdit2 size={12} /> 수정
                    </button>
                    <button type="button" className="reserve-action-btn is-cancel"
                      onClick={() => handleCancel(item.id)}
                      disabled={cancelling === item.id}>
                      {cancelling === item.id
                        ? <FiLoader size={12} className="mascot-spin" />
                        : <FiTrash2 size={12} />} 취소
                    </button>
                  </div>
                )}
              </div>

              {item.status === 'FAILED' && item.errorMessage && (
                <div className="reserve-card-error-msg">
                  <FiAlertCircle size={12} />
                  {item.errorMessage.slice(0, 100)}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {editItem && (
        <EditModal item={editItem} onClose={() => setEditItem(null)} onSaved={handleSaved} />
      )}
    </div>
  )
}

// ── main Home page ────────────────────────────────────────────────────────────

export default function Home({ currentSubPage, user, onSubPageChange }) {
  const [step, setStep]             = useState(0)
  const [recipients, setRecipients] = useState([])
  const [subject, setSubject]       = useState('')
  const [body, setBody]             = useState('')
  const [channel, setChannel]       = useState('chat')
  const [scheduledAt, setScheduledAt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone]             = useState(null)
  const [error, setError]           = useState('')

  if (currentSubPage === 'home-reserve-list') {
    return <ReserveList onSubPageChange={onSubPageChange} />
  }

  if (currentSubPage === 'home-memo') return null

  const reset = () => {
    setStep(0); setRecipients([]); setSubject(''); setBody('')
    setChannel('chat'); setScheduledAt(''); setDone(null); setError('')
  }

  const canNext = () => {
    if (step === 0) return recipients.length > 0
    if (step === 2) return body.trim().length > 0
    return true
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError('')
    try {
      const result = await reserveScheduledSend({
        recipientEmpNos: recipients.map(u => u.empNo),
        recipientNames:  recipients.map(u => u.name),
        subject: subject.trim() || null,
        body:    body.trim(),
        channel,
        fileIds: [],
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString().replace('Z', '') : null,
      })
      setDone(result)
      window.dispatchEvent(new CustomEvent('ang:mascot-alert', {
        detail: {
          message: recipients.map(u => u.name).join(', ') + '에게 ' + (channel === 'mail' ? '메일' : '채팅') + ' 예약이 등록됐어요!',
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
    <div className="home-page">
      <div className="home-reserve-card">
        <div className="home-reserve-header">
          <div>
            <div className="home-reserve-title">예약 발송</div>
            <div className="home-reserve-meta">메일 · 채팅 메시지를 원하는 시간에 자동 발송</div>
          </div>
        </div>

        {done ? (
          <div className="home-reserve-done">
            <div className="home-reserve-done-icon"><FiCheck size={28} /></div>
            <p className="home-reserve-done-title">예약이 등록됐어요</p>
            <p className="home-reserve-done-preview">{done.preview}</p>
            <div className="home-reserve-done-actions">
              <button type="button" className="btn btn-primary" onClick={reset}>새 예약</button>
              <button type="button" className="btn btn-secondary"
                onClick={() => onSubPageChange?.('home-reserve-list')}>예약 목록</button>
            </div>
          </div>
        ) : (
          <>
            <div className="home-reserve-steps">
              {STEPS.map((label, i) => (
                <div key={i} className={`home-reserve-step ${i === step ? 'is-active' : ''} ${i < step ? 'is-done' : ''}`}>
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
                    <p className="home-reserve-hint">1명 이상 선택 후 다음으로 넘어갈 수 있어요.</p>
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
                    placeholder={channel === 'mail' ? '메일 제목을 입력하세요' : '채팅은 제목이 필요 없어요. 건너뛰어도 됩니다.'}
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
                    <span className="home-reserve-optional">선택</span>
                  </label>
                  <p className="home-reserve-hint">파일 첨부 기능은 파일 저장소에서 직접 공유하거나, 이 단계를 건너뛰어도 됩니다.</p>
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
                    min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                    autoFocus
                  />

                  <div className="home-reserve-summary">
                    <p><strong>수신자</strong>{recipients.map(u => u.name).join(', ')}</p>
                    {subject && <p><strong>제목</strong>{subject}</p>}
                    <p><strong>본문</strong>{body.length > 80 ? body.slice(0, 80) + '...' : body}</p>
                    <p><strong>방식</strong>{channel === 'mail' ? '메일' : '채팅'}</p>
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
                    ? <><FiLoader size={14} className="mascot-spin" /> 등록 중...</>
                    : <><FiCheck size={14} /> 예약 확정</>}
                </button>
              )}
            </div>
          </>
        )}
      </div>

      <div className="home-dashboard-grid">
        <section className="home-panel home-calendar-panel" style={{ overflow: 'hidden' }}>
          <HomeCalendar onNavigateToCalendar={() => onSubPageChange?.('calendar')} />
        </section>
        <section className="home-panel home-board-panel">
          <Board currentSubPage="board-notice" />
        </section>
      </div>
    </div>
  )
}
