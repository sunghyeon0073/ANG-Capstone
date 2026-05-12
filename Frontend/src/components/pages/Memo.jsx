import { useState } from 'react'
import { FiPlus, FiTrash2, FiSave } from 'react-icons/fi'

export default function Memo() {
  const [memos, setMemos] = useState([])
  const [selectedMemo, setSelectedMemo] = useState(null)
  const [memoContent, setMemoContent] = useState('')
  const [memoTitle, setMemoTitle] = useState('')

  const handleNewMemo = () => {
    setSelectedMemo(null)
    setMemoTitle('')
    setMemoContent('')
  }

  const handleSelectMemo = (memo) => {
    setSelectedMemo(memo)
    setMemoTitle(memo.title)
    setMemoContent(memo.content)
  }

  const handleSaveMemo = async () => {
    if (!memoTitle.trim()) {
      alert('제목을 입력해주세요.')
      return
    }

    if (selectedMemo) {
      // 기존 메모 수정
      const updatedMemos = memos.map(memo =>
        memo.id === selectedMemo.id
          ? { ...memo, title: memoTitle, content: memoContent, updatedAt: new Date().toISOString() }
          : memo
      )
      setMemos(updatedMemos)
      setSelectedMemo(updatedMemos.find(m => m.id === selectedMemo.id))
      // 나중에 백엔드 API: PUT /api/memos/:id
    } else {
      // 새 메모 작성
      const newMemo = {
        id: Date.now().toString(),
        title: memoTitle,
        content: memoContent,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      const updatedMemos = [newMemo, ...memos]
      setMemos(updatedMemos)
      setSelectedMemo(newMemo)
      // 나중에 백엔드 API: POST /api/memos
    }
  }

  const handleDeleteMemo = async () => {
    if (!selectedMemo) return

    if (window.confirm('이 메모를 삭제하시겠습니까?')) {
      const updatedMemos = memos.filter(memo => memo.id !== selectedMemo.id)
      setMemos(updatedMemos)
      setSelectedMemo(null)
      setMemoTitle('')
      setMemoContent('')
      // 나중에 백엔드 API: DELETE /api/memos/:id
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="memo-container">
      <div className="memo-sidebar">
        <button className="memo-new-btn" onClick={handleNewMemo}>
          <FiPlus />
          <span>새 메모</span>
        </button>

        <div className="memo-list">
          {memos.length === 0 ? (
            <div className="memo-empty">메모가 없습니다</div>
          ) : (
            memos.map(memo => (
              <button
                key={memo.id}
                className={`memo-item ${selectedMemo?.id === memo.id ? 'active' : ''}`}
                onClick={() => handleSelectMemo(memo)}
              >
                <div className="memo-item-title">{memo.title}</div>
                <div className="memo-item-date">{formatDate(memo.updatedAt)}</div>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="memo-editor">
        <div className="memo-editor-header">
          <input
            type="text"
            placeholder="제목을 입력하세요"
            value={memoTitle}
            onChange={(e) => setMemoTitle(e.target.value)}
            className="memo-title-input"
          />
          <div className="memo-editor-actions">
            <button className="btn-save" onClick={handleSaveMemo}>
              <FiSave />
              저장
            </button>
            {selectedMemo && (
              <button className="btn-delete" onClick={handleDeleteMemo}>
                <FiTrash2 />
                삭제
              </button>
            )}
          </div>
        </div>

        <textarea
          placeholder="메모 내용을 입력하세요"
          value={memoContent}
          onChange={(e) => setMemoContent(e.target.value)}
          className="memo-content-textarea"
        />
      </div>
    </div>
  )
}
