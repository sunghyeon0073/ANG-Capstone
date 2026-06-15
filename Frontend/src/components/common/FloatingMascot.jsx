import '../../style/mascot.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  FiCalendar, FiCheck, FiChevronDown, FiFileText, FiFolder,
  FiMail, FiMessageCircle, FiSend, FiX, FiLoader, FiArrowRight
} from 'react-icons/fi'
import { askAiAssistant } from '../../api/aiAssistantApi'

const ANIMATION_FRAMES = {
  idle: { count: 16, interval: 120, loop: true,  path: f => `/assets/mascot/idle/${f}.png` },
  run:  { count: 20, interval: 70,  loop: true,  path: f => `/assets/mascot/run/${f}.png`  },
  dead: { count: 30, interval: 55,  loop: false, path: f => `/assets/mascot/dead/${f}.png` },
}

const TYPE_ICONS = {
  schedule: FiCalendar,
  mail:     FiMail,
  document: FiFileText,
  file:     FiFolder,
  approval: FiCheck,
}

const MASCOT_POSITION_KEY = 'ang:floating-mascot-position'
const MASCOT_W = 96
const MASCOT_H = 118
const MASCOT_MARGIN = 12
const clamp = (v, min, max) => Math.min(Math.max(v, min), max)

const getDefaultPos = () => ({
  x: Math.max(window.innerWidth - MASCOT_W - 24, MASCOT_MARGIN),
  y: Math.max(window.innerHeight - MASCOT_H - 22, MASCOT_MARGIN),
})

const readSavedPos = () => {
  try {
    const s = JSON.parse(localStorage.getItem(MASCOT_POSITION_KEY) || 'null')
    if (Number.isFinite(s?.x) && Number.isFinite(s?.y)) return s
  } catch { return null }
  return null
}

function ChatMessage({ msg, onAction }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`mascot-chat-msg ${isUser ? 'is-user' : 'is-bot'}`}>
      <div className="mascot-chat-bubble">
        <p className="mascot-chat-text">{msg.content}</p>

        {msg.results?.length > 0 && (
          <ul className="mascot-chat-results">
            {msg.results.map((item, i) => {
              const Icon = TYPE_ICONS[item.type] || FiFolder
              return (
                <li key={i} className="mascot-chat-result-item">
                  <Icon size={12} className="mascot-chat-result-icon" />
                  <span className="mascot-chat-result-title">{item.title}</span>
                  {item.summary && <span className="mascot-chat-result-summary">{item.summary}</span>}
                </li>
              )
            })}
            {msg.hasMore && <li className="mascot-chat-result-more">결과가 더 있어요 →</li>}
          </ul>
        )}

        {msg.actions?.length > 0 && (
          <div className="mascot-chat-actions">
            {msg.actions.map((action, i) => (
              <button
                key={i}
                type="button"
                className={`mascot-chat-action-btn ${action.actionType === 'confirm_send' ? 'is-primary' : 'is-secondary'}`}
                onClick={() => onAction(action)}
              >
                {action.label}
                {action.actionType === 'navigate' && <FiArrowRight size={11} />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function FloatingMascot({ mode = 'default', onSubPageChange }) {
  const [collapsed, setCollapsed] = useState(false)
  const [bubbleOpen, setBubbleOpen] = useState(false)
  const [hasAlert, setHasAlert] = useState(false)
  const [animation, setAnimation] = useState('idle')
  const [frame, setFrame] = useState(1)
  const [messages, setMessages] = useState([
    { role: 'bot', content: '안녕하세요! 일정·메일·문서·결재·예약발송 뭐든 물어보세요.' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [position, setPosition] = useState(null)
  const messagesEndRef = useRef(null)
  const dragStateRef = useRef(null)
  const dragMovedRef = useRef(false)

  const frameConfig = ANIMATION_FRAMES[animation] || ANIMATION_FRAMES.idle
  const mascotPositionStyle = position
    ? { left: position.x, top: position.y, right: 'auto', bottom: 'auto' }
    : undefined

  useEffect(() => {
    const initial = readSavedPos() || getDefaultPos()
    setPosition({
      x: clamp(initial.x, MASCOT_MARGIN, window.innerWidth - MASCOT_W - MASCOT_MARGIN),
      y: clamp(initial.y, MASCOT_MARGIN, window.innerHeight - MASCOT_H - MASCOT_MARGIN),
    })
    const onResize = () => setPosition(cur => {
      const p = cur || getDefaultPos()
      return { x: clamp(p.x, MASCOT_MARGIN, window.innerWidth - MASCOT_W - MASCOT_MARGIN), y: clamp(p.y, MASCOT_MARGIN, window.innerHeight - MASCOT_H - MASCOT_MARGIN) }
    })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // 모든 애니메이션 프레임을 미리 캐시에 올려 src 전환 시 깨짐 방지
  useEffect(() => {
    Object.values(ANIMATION_FRAMES).forEach(({ count, path }) => {
      for (let i = 1; i <= count; i++) {
        const img = new Image()
        img.src = path(i)
      }
    })
  }, [])

  useEffect(() => { setFrame(1) }, [animation])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setFrame(f => f < frameConfig.count ? f + 1 : (frameConfig.loop ? 1 : frameConfig.count))
    }, frameConfig.interval)
    return () => window.clearInterval(timer)
  }, [frameConfig.count, frameConfig.interval, frameConfig.loop])

  useEffect(() => {
    const onAlert = (e) => {
      const text = e.detail?.message || '새로운 AI 알림이 있어요.'
      setHasAlert(true)
      setCollapsed(false)
      setBubbleOpen(true)
      setMessages(prev => [...prev, { role: 'bot', content: text }])
      if (e.detail?.animation && ANIMATION_FRAMES[e.detail.animation]) {
        setAnimation(e.detail.animation)
      }
    }
    window.addEventListener('ang:mascot-alert', onAlert)
    return () => window.removeEventListener('ang:mascot-alert', onAlert)
  }, [])

  useEffect(() => {
    if (bubbleOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, bubbleOpen])

  const handleMascotClick = () => {
    if (dragMovedRef.current) { dragMovedRef.current = false; return }
    setBubbleOpen(o => !o)
    setHasAlert(false)
  }

  const handleRestoreClick = () => {
    if (dragMovedRef.current) { dragMovedRef.current = false; return }
    setCollapsed(false)
  }

  const handleDragStart = (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    const cur = position || getDefaultPos()
    dragMovedRef.current = false
    dragStateRef.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, originX: cur.x, originY: cur.y }
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  const handleDragMove = (e) => {
    const d = dragStateRef.current
    if (!d || d.pointerId !== e.pointerId) return
    const dx = e.clientX - d.startX, dy = e.clientY - d.startY
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragMovedRef.current = true
    e.preventDefault()
    setPosition({ x: clamp(d.originX + dx, MASCOT_MARGIN, window.innerWidth - MASCOT_W - MASCOT_MARGIN), y: clamp(d.originY + dy, MASCOT_MARGIN, window.innerHeight - MASCOT_H - MASCOT_MARGIN) })
  }

  const handleDragEnd = (e) => {
    if (!dragStateRef.current || dragStateRef.current.pointerId !== e.pointerId) return
    dragStateRef.current = null
    setPosition(cur => { if (cur) localStorage.setItem(MASCOT_POSITION_KEY, JSON.stringify(cur)); return cur })
  }

  const sendMessage = async (text, confirm = false) => {
    const trimmed = (text || input).trim()
    if (!trimmed || loading) return
    if (!confirm) setInput('')

    setMessages(prev => [...prev, { role: 'user', content: trimmed }])
    setLoading(true)

    try {
      const data = await askAiAssistant(trimmed, confirm)
      setMessages(prev => [...prev, {
        role: 'bot',
        content: data.answer || '',
        results: data.results || [],
        actions: data.actions || [],
        hasMore: data.hasMore,
      }])

      if (data.intent === 'scheduled_send' && !confirm && !data.missingFields?.length) {
        setAnimation('run')
        setTimeout(() => setAnimation('idle'), 2500)
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'bot',
        content: err.response?.data?.message || '오류가 발생했어요. 다시 시도해 주세요.',
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleAction = (action) => {
    if (action.actionType === 'navigate') {
      onSubPageChange?.(action.payload)
      setBubbleOpen(false)
    } else if (action.actionType === 'confirm_send') {
      sendMessage(action.payload, true)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  if (collapsed) {
    return (
      <button type="button" className="floating-mascot-restore" style={mascotPositionStyle}
        onClick={handleRestoreClick} onPointerDown={handleDragStart}
        onPointerMove={handleDragMove} onPointerUp={handleDragEnd} onPointerCancel={handleDragEnd}
        aria-label="AI 도우미 열기"
      >
        <FiMessageCircle />
      </button>
    )
  }

  return (
    <div className={`floating-mascot ${hasAlert ? 'has-alert' : ''}`} style={mascotPositionStyle}>
      {bubbleOpen && (
        <div className="mascot-chat-panel" role="dialog" aria-label="ANG 비서">
          <div className="mascot-chat-header">
            <span className="mascot-chat-title">ANG 비서</span>
            <button type="button" className="mascot-chat-close" onClick={() => setBubbleOpen(false)} aria-label="닫기">
              <FiX size={14} />
            </button>
          </div>

          <div className="mascot-chat-messages">
            {messages.map((msg, i) => (
              <ChatMessage key={i} msg={msg} onAction={handleAction} />
            ))}
            {loading && (
              <div className="mascot-chat-msg is-bot">
                <div className="mascot-chat-bubble">
                  <span className="mascot-chat-typing">
                    <span /><span /><span />
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="mascot-chat-input-row">
            <textarea
              className="mascot-chat-input"
              placeholder="무엇이든 물어보세요..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={loading}
            />
            <button
              type="button"
              className="mascot-chat-send"
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              aria-label="전송"
            >
              {loading ? <FiLoader size={14} className="mascot-spin" /> : <FiSend size={14} />}
            </button>
          </div>
        </div>
      )}

      {!bubbleOpen && (
        <div className="floating-mascot-controls">
          <button type="button" className="floating-mascot-collapse" onClick={() => setCollapsed(true)} aria-label="접기">
            <FiChevronDown />
          </button>
        </div>
      )}

      <button
        type="button"
        className={`floating-mascot-character is-${animation}`}
        onClick={handleMascotClick}
        onPointerDown={handleDragStart}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
        onPointerCancel={handleDragEnd}
        aria-label="ANG 비서 열기"
      >
        <span className="floating-mascot-alert-dot" />
        <img src={frameConfig.path(frame)} alt="" draggable="false" />
      </button>
    </div>
  )
}
