import { useEffect, useMemo, useState } from 'react'
import { FiChevronDown, FiMessageCircle, FiX } from 'react-icons/fi'

const DEFAULT_MESSAGE = '필요하면 제가 옆에서 도와드릴게요.'
const AI_MESSAGE = '문서 읽는 중... 프롬프트를 입력하면 초안을 만들어볼게요.'

const ANIMATION_FRAMES = {
  idle: {
    count: 16,
    interval: 120,
    loop: true,
    path: (frame) => `/assets/mascot/idle/${frame}.png`,
  },
  run: {
    count: 20,
    interval: 70,
    loop: true,
    path: (frame) => `/assets/mascot/run/${frame}.png`,
  },
  dead: {
    count: 30,
    interval: 55,
    loop: false,
    path: (frame) => `/assets/mascot/dead/${frame}.png`,
  },
}

export default function FloatingMascot({ mode = 'default' }) {
  const [collapsed, setCollapsed] = useState(false)
  const [bubbleOpen, setBubbleOpen] = useState(false)
  const [message, setMessage] = useState(DEFAULT_MESSAGE)
  const [hasAlert, setHasAlert] = useState(false)
  const [animation, setAnimation] = useState('idle')
  const [frame, setFrame] = useState(1)

  const modeMessage = useMemo(() => (
    mode === 'ai' ? AI_MESSAGE : DEFAULT_MESSAGE
  ), [mode])

  const frameConfig = ANIMATION_FRAMES[animation] || ANIMATION_FRAMES.idle
  const mascotSrc = frameConfig.path(frame)

  useEffect(() => {
    setMessage(modeMessage)
  }, [modeMessage])

  useEffect(() => {
    setFrame(1)
  }, [animation])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setFrame((currentFrame) => {
        if (currentFrame < frameConfig.count) return currentFrame + 1
        return frameConfig.loop ? 1 : frameConfig.count
      })
    }, frameConfig.interval)

    return () => window.clearInterval(timer)
  }, [frameConfig.count, frameConfig.interval, frameConfig.loop])

  useEffect(() => {
    const handleMascotAlert = (event) => {
      const nextAnimation = event.detail?.animation

      setHasAlert(true)
      setBubbleOpen(true)
      setCollapsed(false)
      setMessage(event.detail?.message || '새로운 AI 알림이 있어요.')

      if (nextAnimation && ANIMATION_FRAMES[nextAnimation]) {
        setAnimation(nextAnimation)
      }
    }

    window.addEventListener('ang:mascot-alert', handleMascotAlert)
    return () => window.removeEventListener('ang:mascot-alert', handleMascotAlert)
  }, [])

  const handleMascotClick = () => {
    setBubbleOpen((open) => !open)
    setHasAlert(false)
  }

  const handleMascotPointerEnter = () => {
    if (animation === 'run') return
    setAnimation('dead')
    setMessage('앗, 살살 부탁드려요.')
    setBubbleOpen(true)

    window.setTimeout(() => {
      setAnimation((currentAnimation) => (
        currentAnimation === 'dead' ? 'idle' : currentAnimation
      ))
    }, 1800)
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
        className={`floating-mascot-character is-${animation}`}
        onClick={handleMascotClick}
        onPointerEnter={handleMascotPointerEnter}
        aria-label="AI 도우미 말풍선 열기"
        title="AI 도우미"
      >
        <span className="floating-mascot-alert-dot" />
        <img src={mascotSrc} alt="" draggable="false" />
      </button>
    </div>
  )
}
