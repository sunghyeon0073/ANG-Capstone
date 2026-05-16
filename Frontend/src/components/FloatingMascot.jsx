import { useEffect, useMemo, useState } from 'react'
import { FiChevronDown, FiMessageCircle, FiX } from 'react-icons/fi'

const DEFAULT_MESSAGE = '필요하면 제가 옆에서 도와드릴게요.'
const AI_MESSAGE = '문서 읽는 중... 프롬프트를 입력하면 초안을 만들어볼게요.'

export default function FloatingMascot({ mode = 'default' }) {
  const [collapsed, setCollapsed] = useState(false)
  const [bubbleOpen, setBubbleOpen] = useState(false)
  const [message, setMessage] = useState(DEFAULT_MESSAGE)
  const [hasAlert, setHasAlert] = useState(false)

  const modeMessage = useMemo(() => (
    mode === 'ai' ? AI_MESSAGE : DEFAULT_MESSAGE
  ), [mode])

  useEffect(() => {
    setMessage(modeMessage)
  }, [modeMessage])

  useEffect(() => {
    const handleMascotAlert = (event) => {
      setHasAlert(true)
      setBubbleOpen(true)
      setCollapsed(false)
      setMessage(event.detail?.message || '새로운 AI 추천이 도착했어요.')
    }

    window.addEventListener('ang:mascot-alert', handleMascotAlert)
    return () => window.removeEventListener('ang:mascot-alert', handleMascotAlert)
  }, [])

  const handleMascotClick = () => {
    setBubbleOpen((open) => !open)
    setHasAlert(false)
  }

  if (collapsed) {
    return (
      <button
        type="button"
        className="floating-mascot-restore"
        onClick={() => setCollapsed(false)}
        aria-label="AI 도우미 열기"
        title="AI 도우미 열기"
      >
        <FiMessageCircle />
      </button>
    )
  }

  return (
    <div className={`floating-mascot ${hasAlert ? 'has-alert' : ''}`}>
      {bubbleOpen && (
        <div className="floating-mascot-bubble" role="status">
          <p>{message}</p>
          <button
            type="button"
            className="floating-mascot-bubble-close"
            onClick={() => setBubbleOpen(false)}
            aria-label="말풍선 닫기"
            title="닫기"
          >
            <FiX />
          </button>
        </div>
      )}

      <div className="floating-mascot-controls">
        <button
          type="button"
          className="floating-mascot-collapse"
          onClick={() => setCollapsed(true)}
          aria-label="AI 도우미 접기"
          title="접기"
        >
          <FiChevronDown />
        </button>
      </div>

      <button
        type="button"
        className="floating-mascot-character"
        onClick={handleMascotClick}
        aria-label="AI 도우미 말풍선 열기"
        title="AI 도우미"
      >
        <span className="floating-mascot-alert-dot" />
        <img src="/assets/mascot/mascot-idle.png" alt="" />
      </button>
    </div>
  )
}
