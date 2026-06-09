import { useState } from 'react'
import HomeCalendar from './HomeCalendar'
import Board from './Board'
import { askAiAssistant } from '../../api/aiAssistantApi'
import { FiCalendar, FiMail, FiFileText, FiFolder, FiCheckSquare, FiArrowRight, FiLoader } from 'react-icons/fi'

const TYPE_CONFIG = {
  schedule:  { label: '일정',   icon: FiCalendar,    color: '#5d7a64' },
  mail:      { label: '메일',   icon: FiMail,        color: '#2563eb' },
  document:  { label: '문서',   icon: FiFileText,    color: '#7c3aed' },
  file:      { label: '파일',   icon: FiFolder,      color: '#d97706' },
  approval:  { label: '결재',   icon: FiCheckSquare, color: '#dc2626' },
}

const MISSING_LABELS = {
  channel:            '전송 방식',
  scheduledAt:        '보낼 시간',
  message:            '메시지 내용',
  recipient:          '받는 사람',
  recipientOrChatRoom:'받는 사람 또는 채팅방',
  title:              '메일 제목',
}

function SecretaryResult({ result, onAction }) {
  if (!result) return null
  const { answer, intent, results, actions, missingFields, schedulePreview, hasMore } = result

  return (
    <div className="ang-secretary-result">
      <p className="ang-secretary-answer">{answer}</p>

      {schedulePreview?.preview && (
        <div className="ang-secretary-schedule-preview">
          <p className="ang-secretary-preview-text">{schedulePreview.preview}</p>
          {missingFields?.length > 0 && (
            <p className="ang-secretary-missing">
              부족한 정보: {missingFields.map(f => MISSING_LABELS[f] || f).join(', ')}
            </p>
          )}
        </div>
      )}

      {results?.length > 0 && (
        <ul className="ang-secretary-results-list">
          {results.map((item, i) => {
            const cfg = TYPE_CONFIG[item.type] || { label: item.type, icon: FiFolder, color: '#6b7280' }
            const Icon = cfg.icon
            return (
              <li key={i} className="ang-secretary-result-item">
                <span className="ang-secretary-type-dot" style={{ background: cfg.color }} title={cfg.label} />
                <div className="ang-secretary-result-body">
                  <span className="ang-secretary-result-title">{item.title}</span>
                  {item.summary && <span className="ang-secretary-result-summary">{item.summary}</span>}
                </div>
                <span className="ang-secretary-source-label">{item.sourceLabel}</span>
              </li>
            )
          })}
          {hasMore && <li className="ang-secretary-has-more">결과가 더 있어요. 해당 메뉴에서 전체 확인하세요.</li>}
        </ul>
      )}

      {actions?.length > 0 && (
        <div className="ang-secretary-actions">
          {actions.map((action, i) => (
            <button
              key={i}
              type="button"
              className={`ang-secretary-action-btn ${action.actionType === 'confirm_send' ? 'is-primary' : 'is-secondary'}`}
              onClick={() => onAction(action)}
            >
              {action.label}
              {action.actionType === 'navigate' && <FiArrowRight aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Home({ currentSubPage, user, onSubPageChange }) {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  if (currentSubPage === 'home-memo') {
    return <Memo />
  }

  const handleAsk = async (text, confirm = false) => {
    const trimmed = (text || prompt).trim()
    if (!trimmed) return
    setLoading(true)
    setError(null)
    try {
      const data = await askAiAssistant(trimmed, confirm)
      setResult(data)
      if (!confirm) setPrompt('')
    } catch (err) {
      setError(err.response?.data?.message || '오류가 발생했어요. 다시 시도해 주세요.')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  const handleAction = (action) => {
    if (action.actionType === 'navigate') {
      onSubPageChange?.(action.payload)
    } else if (action.actionType === 'confirm_send') {
      handleAsk(action.payload, true)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleAsk()
    }
  }

  return (
    <div className="home-page">
      <div className="home-prompt-card">
        <div className="home-prompt-header">
          <div className="home-prompt-title">ANG 비서</div>
          <div className="home-prompt-meta">일정 · 메일 · 문서 · 파일 · 결재 · 예약 발송</div>
        </div>
        <div className="home-prompt-box">
          <textarea
            className="home-prompt-input"
            placeholder="무엇을 도와드릴까요?  예: 오늘 일정 알려줘 / 김성현이 보낸 메일 찾아줘 / 결재 대기 알려줘 / 10분 뒤 김성현에게 채팅 보내줘"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            disabled={loading}
          />
          <div className="home-prompt-actions">
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => handleAsk()}
              disabled={loading || !prompt.trim()}
            >
              {loading ? <FiLoader className="ang-spin" aria-hidden="true" /> : '전송'}
            </button>
          </div>
        </div>

        {error && <p className="ang-secretary-error">{error}</p>}

        {(result || loading) && !error && (
          <SecretaryResult result={result} onAction={handleAction} />
        )}
      </div>

      <div className="home-dashboard-grid">
        <section className="home-panel home-calendar-panel" style={{ overflow: 'hidden' }}>
          <HomeCalendar onNavigateToCalendar={() => onSubPageChange('calendar')} />
        </section>
        <section className="home-panel home-board-panel">
          <Board currentSubPage="board-notice" />
        </section>
      </div>
    </div>
  )
}
