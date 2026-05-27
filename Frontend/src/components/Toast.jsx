import { useEffect, useState } from 'react'

export default function Toast() {
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    const handler = (e) => {
      const detail = e.detail || {}
      const id = Date.now() + Math.random()
      const toast = {
        id,
        message: detail.message || '',
        type: detail.type || 'info',
        duration: detail.duration ?? 3000,
      }
      setToasts((t) => [...t, toast])
      setTimeout(() => {
        setToasts((t) => t.filter((x) => x.id !== id))
      }, toast.duration)
    }

    window.addEventListener('ang:toast', handler)
    return () => window.removeEventListener('ang:toast', handler)
  }, [])

  if (!toasts.length) return null

  return (
    <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 2000 }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            marginBottom: 10,
            padding: '10px 14px',
            borderRadius: 8,
            background: t.type === 'error' ? '#ffd6d6' : '#fff6e6',
            color: t.type === 'error' ? '#8b1e1e' : '#7a4b00',
            boxShadow: '0 6px 18px rgba(15,35,52,0.12)',
            minWidth: 220,
          }}
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}
