import { useEffect, useMemo, useState } from 'react'
import { FiCalendar, FiCheck, FiChevronDown, FiMessageCircle, FiSend, FiX } from 'react-icons/fi'
import { confirmAiSchedule, previewAiSchedule } from '../../api/aiAssistantApi'

const DEFAULT_MESSAGE = '필요하면 제가 옆에서 도와드릴게요.'
const AI_MESSAGE = '문서 작업을 도와드릴게요. 프롬프트를 입력하면 초안을 만들어볼게요.'

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

const MISSING_FIELD_LABELS = {
  channel: '전송 방식',
  scheduledAt: '보낼 시간',
  message: '메시지 내용',
  recipient: '받는 사람',
  recipientOrChatRoom: '받는 사람 또는 채팅방',
  title: '메일 제목',
}

const formatMissingFields = fields => (
  fields?.map(field => MISSING_FIELD_LABELS[field] || field).join(', ')
)

export default function FloatingMascot({ mode = 'default' }) {
  const [collapsed, setCollapsed] = useState(false)
  const [bubbleOpen, setBubbleOpen] = useState(false)
  const [message, setMessage] = useState(DEFAULT_MESSAGE)
  const [hasAlert, setHasAlert] = useState(false)
  const [animation, setAnimation] = useState('idle')
  const [frame, setFrame] = useState(1)
  const [schedulePrompt, setSchedulePrompt] = useState('')
  const [schedulePreview, setSchedulePreview] = useState(null)
  const [scheduleStatus, setScheduleStatus] = useState('')
  const [isScheduling, setIsScheduling] = useState(false)

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

  const handleSchedulePreview = async () => {
    const prompt = schedulePrompt.trim()
    if (!prompt) return
    setIsScheduling(true)
    setScheduleStatus('')
    try {
      const preview = await previewAiSchedule(prompt)
      setSchedulePreview(preview)
      setScheduleStatus(preview.missingFields?.length
        ? `부족한 정보: ${formatMissingFields(preview.missingFields)}`
        : '예약 내용을 확인해 주세요.')
    } catch (error) {
      setScheduleStatus(error.response?.data?.message || '예약 내용을 해석하지 못했습니다.')
      setSchedulePreview(null)
    } finally {
      setIsScheduling(false)
    }
  }

  const handleScheduleConfirm = async () => {
    const prompt = schedulePrompt.trim()
    if (!prompt || schedulePreview?.missingFields?.length) return
    setIsScheduling(true)
    try {
      const saved = await confirmAiSchedule(prompt)
      setSchedulePreview(saved)
      setSchedulePrompt('')
      setScheduleStatus('예약이 등록되었습니다.')
      setMessage('예약해뒀어요. 시간에 맞춰 전송할게요.')
      setAnimation('run')
      setTimeout(() => setAnimation('idle'), 3000)
    } catch (error) {
      setScheduleStatus(error.response?.data?.message || '예약 등록에 실패했습니다.')
    } finally {
      setIsScheduling(false)
    }
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
          <div className="mascot-scheduler">
            <label className="mascot-scheduler-label" htmlFor="mascot-schedule-prompt">
              <FiCalendar aria-hidden="true" />
              AI 예약 지시
            </label>
            <textarea
              id="mascot-schedule-prompt"
              value={schedulePrompt}
              onChange={(event) => {
                setSchedulePrompt(event.target.value)
                setSchedulePreview(null)
                setScheduleStatus('')
              }}
              placeholder="예: 내일 오전 9시에 김대리에게 메일 제목은 회의자료, 내용은 자료 확인 부탁드립니다 라고 보내줘"
              rows={3}
            />
            {schedulePreview?.preview && (
              <div className="mascot-scheduler-preview">
                {schedulePreview.preview}
              </div>
            )}
            {scheduleStatus && (
              <div className={`mascot-scheduler-status ${schedulePreview?.missingFields?.length ? 'is-warning' : ''}`}>
                {scheduleStatus}
              </div>
            )}
            <div className="mascot-scheduler-actions">
              <button type="button" onClick={handleSchedulePreview} disabled={isScheduling || !schedulePrompt.trim()} title="예약 미리보기">
                {isScheduling && !schedulePreview ? <span className="mascot-loading-dot" aria-hidden="true" /> : <FiSend aria-hidden="true" />}
              </button>
              <button
                type="button"
                onClick={handleScheduleConfirm}
                disabled={isScheduling || !schedulePrompt.trim() || Boolean(schedulePreview?.missingFields?.length)}
                title="예약 확정"
              >
                <FiCheck aria-hidden="true" />
              </button>
            </div>
          </div>
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
        aria-label="AI 도우미 말풍선 열기"
        title="AI 도우미"
      >
        <span className="floating-mascot-alert-dot" />
        <img src={mascotSrc} alt="" draggable="false" />
      </button>
    </div>
  )
}
