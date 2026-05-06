import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const messages = [
  '야 거기 없는데?',
  '없는 페이지를 왜 찾아...',
  '열심히 찾아봤는데 진짜 없음 ㅋ',
  '혹시 오타 아님?',
  '페이지가 도망갔나봐요 🏃',
]

export default function NotFound() {
  const navigate = useNavigate()
  const [msg, setMsg] = useState(messages[0])
  const [clicks, setClicks] = useState(0)

  useEffect(() => {
    const idx = Math.floor(Math.random() * messages.length)
    setMsg(messages[idx])
  }, [])

  const handleClick = () => {
    const next = (clicks + 1) % messages.length
    setClicks(next)
    setMsg(messages[next])
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100vh', background: '#f0f4ff',
      fontFamily: 'sans-serif', gap: 16, userSelect: 'none',
    }}>
      <div
        onClick={handleClick}
        style={{ fontSize: 120, cursor: 'pointer', lineHeight: 1 }}
        title="클릭해봐"
      >
        🤨
      </div>

      <h1 style={{ fontSize: 80, fontWeight: 900, color: '#2563eb', margin: 0, letterSpacing: -4 }}>
        404
      </h1>

      <p style={{ fontSize: 22, fontWeight: 700, color: '#374151', margin: 0 }}>
        {msg}
      </p>

      <p style={{ fontSize: 14, color: '#9ca3af', marginTop: 4 }}>
        이모지 클릭하면 변해요 (진짜로)
      </p>

      <button
        onClick={() => navigate('/')}
        style={{
          marginTop: 16, padding: '12px 32px', background: '#2563eb',
          color: '#fff', border: 'none', borderRadius: 999, fontSize: 15,
          fontWeight: 700, cursor: 'pointer',
        }}
      >
        나 집에 갈래
      </button>
    </div>
  )
}
