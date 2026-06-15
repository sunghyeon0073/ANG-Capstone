import { useCallback, useEffect, useRef, useState } from 'react'
import '../../style/toast.css'

export default function Toast() {
  const [toasts, setToasts] = useState([])
  const timeoutIdsRef = useRef(new Map())

  const removeToast = useCallback((id) => {
    const timeoutId = timeoutIdsRef.current.get(id)
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutIdsRef.current.delete(id)
    }
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  useEffect(() => {
    const timeoutIds = timeoutIdsRef.current

    const handler = (e) => {
      const detail = e.detail || {}
      const id = Date.now() + Math.random()
      const toast = {
        id,
        message: detail.message || '',
        title: detail.title || '',
        avatar: detail.avatar || '',
        onClick: detail.onClick,
        type: detail.type || 'info',
        duration: detail.duration ?? 3000,
      }
      setToasts((current) => [...current.slice(-2), toast])
      const timeoutId = setTimeout(() => {
        removeToast(id)
      }, toast.duration)
      timeoutIds.set(id, timeoutId)
    }

    window.addEventListener('ang:toast', handler)
    return () => {
      window.removeEventListener('ang:toast', handler)
      timeoutIds.forEach(clearTimeout)
      timeoutIds.clear()
    }
  }, [removeToast])

  if (!toasts.length) return null

  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`app-toast ${t.type === 'chat' ? 'chat-toast' : `toast-${t.type}`}`}
          onClick={() => {
            t.onClick?.()
            removeToast(t.id)
          }}
          role={t.onClick ? 'button' : 'status'}
          tabIndex={t.onClick ? 0 : undefined}
          onKeyDown={(event) => {
            if (t.onClick && (event.key === 'Enter' || event.key === ' ')) {
              event.preventDefault()
              t.onClick()
              removeToast(t.id)
            }
          }}
        >
          {t.type === 'chat' && <span className="chat-toast-avatar">{t.avatar || '채'}</span>}
          <span className="toast-content">
            {t.title && <strong>{t.title}</strong>}
            <span>{t.message}</span>
          </span>
          <button
            type="button"
            className="toast-close"
            aria-label="알림 닫기"
            onClick={(event) => {
              event.stopPropagation()
              removeToast(t.id)
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
