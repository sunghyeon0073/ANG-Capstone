import { useState } from 'react'
import './App.css'

function App() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)

  const testConnection = async () => {
    setLoading(true)
    setStatus(null)

    try {
      const res = await fetch('/api/health')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setStatus({ success: true, data })
    } catch (err) {
      setStatus({ success: false, message: err.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <h1>Ang Project</h1>
      <p className="subtitle">백엔드 · 프론트엔드 연동 테스트</p>

      <button onClick={testConnection} disabled={loading}>
        {loading ? '요청 중...' : '연결 테스트'}
      </button>

      {status && (
        <div className={`result ${status.success ? 'success' : 'error'}`}>
          {status.success ? (
            <>
              <strong>✅ 연결 성공</strong><br />
              status &nbsp;&nbsp;: {status.data.status}<br />
              message &nbsp;: {status.data.message}<br />
              timestamp: {status.data.timestamp}
            </>
          ) : (
            <>
              <strong>❌ 연결 실패</strong><br />
              {status.message}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default App
