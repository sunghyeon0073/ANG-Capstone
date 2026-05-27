import { useState, useEffect } from 'react'
import { FiPlus, FiTrash2, FiSave, FiEdit3 } from 'react-icons/fi'
import { getMemos, createMemo, updateMemo, deleteMemo } from '../../api/memoApi'

export default function Memo() {
  const [memos, setMemos] = useState([])
  const [selectedMemo, setSelectedMemo] = useState(null)
  const [memoContent, setMemoContent] = useState('')
  const [memoTitle, setMemoTitle] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    fetchMemos()
  }, [])

  const fetchMemos = async () => {
    try {
      setIsLoading(true)
      const res = await getMemos()
      setMemos(res.data?.data || [])
    } catch (error) {
      console.error('메모 로드 실패', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleNewMemo = () => {
    setSelectedMemo(null)
    setMemoTitle('')
    setMemoContent('')
    setIsEditing(true)
  }

  const handleSelectMemo = (memo) => {
    setSelectedMemo(memo)
    setMemoTitle(memo.title)
    setMemoContent(memo.content)
    setIsEditing(false)
  }

  const handleStartEdit = () => {
    setIsEditing(true)
  }

  const handleSaveMemo = async () => {
    if (!memoTitle.trim()) {
      alert('제목을 입력해주세요.')
      return
    }

    try {
      if (selectedMemo) {
        // 기존 메모 수정
        const res = await updateMemo(selectedMemo.id, {
          title: memoTitle,
          content: memoContent
        })
        const updatedMemo = res.data?.data
        setMemos(memos.map(memo => memo.id === selectedMemo.id ? updatedMemo : memo))
        setSelectedMemo(updatedMemo)
        setIsEditing(false)
      } else {
        // 새 메모 작성
        const res = await createMemo({
          title: memoTitle,
          content: memoContent
        })
        const newMemo = res.data?.data
        setMemos([newMemo, ...memos])
        setSelectedMemo(newMemo)
        setIsEditing(false)
      }
    } catch (error) {
      alert('메모 저장에 실패했습니다.')
      console.error(error)
    }
  }

  const handleDeleteMemo = async (memoToDelete = selectedMemo) => {
    if (!memoToDelete) return

    if (window.confirm('이 메모를 삭제하시겠습니까?')) {
      try {
        await deleteMemo(memoToDelete.id)
        setMemos(memos.filter(memo => memo.id !== memoToDelete.id))
        
        if (selectedMemo?.id === memoToDelete.id) {
          setSelectedMemo(null)
          setMemoTitle('')
          setMemoContent('')
          setIsEditing(false)
        }
      } catch (error) {
        alert('메모 삭제에 실패했습니다.')
        console.error(error)
      }
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    // 한국 시간(KST) 강제 설정
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Seoul'
    }).format(date)
  }

  return (
    <div className="memo-container">
      <div className="memo-sidebar">
        <button className="memo-new-btn" onClick={handleNewMemo}>
          <FiPlus />
          <span>새 메모</span>
        </button>

        <div className="memo-list">
          {isLoading ? (
            <div className="memo-empty">불러오는 중...</div>
          ) : memos.length === 0 ? (
            <div className="memo-empty">메모가 없습니다</div>
          ) : (
            memos.map(memo => (
              <div
                key={memo.id}
                className={`memo-item ${selectedMemo?.id === memo.id ? 'active' : ''}`}
                onClick={() => handleSelectMemo(memo)}
              >
                <div className="memo-item-info">
                  <div className="memo-item-title">{memo.title}</div>
                  <div className="memo-item-date">{formatDate(memo.updatedAt)}</div>
                </div>
                <button 
                  className="memo-item-delete" 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteMemo(memo);
                  }}
                  title="삭제"
                >
                  <FiTrash2 />
                </button>
              </div>
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
            readOnly={!isEditing}
          />
          <div className="memo-editor-actions">
            {!isEditing && selectedMemo && (
              <button className="btn-edit" onClick={handleStartEdit}>
                <FiEdit3 />
                수정
              </button>
            )}
            {isEditing && (
              <>
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
              </>
            )}
          </div>
        </div>

        <textarea
          placeholder="메모 내용을 입력하세요"
          value={memoContent}
          onChange={(e) => setMemoContent(e.target.value)}
          className="memo-content-textarea"
          readOnly={!isEditing}
        />
      </div>
    </div>
  )
}
