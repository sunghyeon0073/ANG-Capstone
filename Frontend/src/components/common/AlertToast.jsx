import { useCallback, useEffect, useRef, useState } from 'react'
import { FiAlertTriangle, FiCheckCircle, FiInfo, FiX, FiXCircle } from 'react-icons/fi'
import '../../style/alert-toast.css'

const ICONS = {
  success: <FiCheckCircle />,
  error:   <FiXCircle />,
  warning: <FiAlertTriangle />,
  info:    <FiInfo />,
}

export default function AlertToast() {
  const [alerts, setAlerts] = useState([])
  const timeoutIdsRef = useRef(new Map())

  const removeAlert = useCallback((id) => {
    const tid = timeoutIdsRef.current.get(id)
    if (tid) {
      clearTimeout(tid)
      timeoutIdsRef.current.delete(id)
    }
    setAlerts((prev) => prev.filter((a) => a.id !== id))
  }, [])

  useEffect(() => {
    const timeoutIds = timeoutIdsRef.current

    const handler = (e) => {
      const { message = '', type = 'info', duration = 3500 } = e.detail || {}
      const id = Date.now() + Math.random()
      setAlerts((prev) => [...prev.slice(-3), { id, message, type }])
      timeoutIds.set(id, setTimeout(() => removeAlert(id), duration))
    }

    window.addEventListener('ang:alert', handler)
    return () => {
      window.removeEventListener('ang:alert', handler)
      timeoutIds.forEach(clearTimeout)
      timeoutIds.clear()
    }
  }, [removeAlert])

  if (!alerts.length) return null

  return (
    <div className="alert-toast-stack">
      {alerts.map((a) => (
        <div key={a.id} className={`alert-toast alert-toast-${a.type}`} role="alert">
          <span className="alert-toast-icon">{ICONS[a.type] ?? ICONS.info}</span>
          <span className="alert-toast-message">{a.message}</span>
          <button
            type="button"
            className="alert-toast-close"
            aria-label="닫기"
            onClick={() => removeAlert(a.id)}
          >
            <FiX />
          </button>
        </div>
      ))}
    </div>
  )
}
