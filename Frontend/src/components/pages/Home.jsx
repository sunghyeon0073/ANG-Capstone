import { useState } from 'react'
import HomeCalendar from './HomeCalendar'
import Board from './Board'

export default function Home({ currentSubPage, user, onSubPageChange }) {
  const [prompt, setPrompt] = useState('')

  if (currentSubPage === 'home-memo') {
    return <Memo />
  }

  return (
    <div className="home-page">
      <div className="home-prompt-card">
        <div className="home-prompt-header">
          <div className="home-prompt-title">ANG 비서</div>
          <div className="home-prompt-meta">Local LLM | Ollama · 빠른 요약과 안내 지원</div>
        </div>
        <div className="home-prompt-box">
          <textarea
            className="home-prompt-input"
            placeholder="무엇을 도와드릴까요? 예: 이번 주 일정과 공지사항을 정리해줘"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={2}
          />
          <div className="home-prompt-actions">
            <button className="btn btn-primary" type="button">
              전송
            </button>
          </div>
        </div>
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


