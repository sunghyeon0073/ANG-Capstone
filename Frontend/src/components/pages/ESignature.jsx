import { useState, useEffect } from 'react'
import { FiCheck, FiX, FiArrowLeft, FiPlus } from 'react-icons/fi'

export default function ESignature({ currentSubPage }) {
  const [approvals, setApprovals] = useState([])
  const [selectedApproval, setSelectedApproval] = useState(null)
  const [isCreating, setIsCreating] = useState(false)
  const [newApprovalForm, setNewApprovalForm] = useState({
    title: '',
    description: ''
  })

  useEffect(() => {
    setSelectedApproval(null)
  }, [currentSubPage])

  const getSubPageLabel = (subPage) => {
    switch (subPage) {
      case 'esignature-waiting':
        return '결재대기'
      case 'esignature-completed':
        return '완료'
      case 'esignature-rejected':
        return '반려'
      case 'esignature-my':
        return '내가 요청'
      default:
        return '결재대기'
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return '#FFC107'
      case 'approved':
        return '#28A745'
      case 'rejected':
        return '#DC3545'
      default:
        return '#6C757D'
    }
  }

  const getStatusLabel = (status) => {
    switch (status) {
      case 'pending':
        return '대기'
      case 'approved':
        return '승인'
      case 'rejected':
        return '반려'
      default:
        return '진행중'
    }
  }

  const filterApprovals = (tab) => {
    return approvals.filter(approval => {
      if (tab === 'esignature-waiting') return approval.status === 'pending'
      if (tab === 'esignature-completed') return approval.status === 'approved'
      if (tab === 'esignature-rejected') return approval.status === 'rejected'
      if (tab === 'esignature-my') return approval.requestedBy === 'current-user'
      return true
    })
  }

  const handleApprove = (approval) => {
    const updated = approvals.map(a =>
      a.id === approval.id ? { ...a, status: 'approved', updatedAt: new Date().toISOString() } : a
    )
    setApprovals(updated)
    setSelectedApproval({ ...approval, status: 'approved', updatedAt: new Date().toISOString() })
    // 나중에 백엔드 API: PUT /api/approvals/:id
  }

  const handleReject = (approval) => {
    const rejectReason = prompt('반려 사유를 입력해주세요.')
    if (rejectReason) {
      const updated = approvals.map(a =>
        a.id === approval.id
          ? { ...a, status: 'rejected', rejectReason, updatedAt: new Date().toISOString() }
          : a
      )
      setApprovals(updated)
      setSelectedApproval({ ...approval, status: 'rejected', rejectReason, updatedAt: new Date().toISOString() })
      // 나중에 백엔드 API: PUT /api/approvals/:id
    }
  }

  const handleCreateApproval = () => {
    if (!newApprovalForm.title.trim()) {
      alert('제목을 입력해주세요.')
      return
    }

    const newApproval = {
      id: Date.now().toString(),
      title: newApprovalForm.title,
      description: newApprovalForm.description,
      status: 'pending',
      requestedBy: 'current-user',
      requestedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      requestedByName: '이상영',
      requestedByRole: '주임'
    }

    setApprovals([newApproval, ...approvals])
    setNewApprovalForm({ title: '', description: '' })
    setIsCreating(false)
    // 나중에 백엔드 API: POST /api/approvals
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
  }

  const filteredApprovals = filterApprovals(currentSubPage)

  if (selectedApproval) {
    return (
      <div className="esignature-detail">
        <button className="back-button" onClick={() => setSelectedApproval(null)}>
          <FiArrowLeft />
          돌아가기
        </button>

        <div className="detail-header">
          <h1>{selectedApproval.title}</h1>
          <div className="detail-meta">
            <span className="meta-item">
              <strong>신청자:</strong> {selectedApproval.requestedByName} ({selectedApproval.requestedByRole})
            </span>
            <span className="meta-item">
              <strong>신청일:</strong> {formatDate(selectedApproval.requestedAt)}
            </span>
            <span
              className="status-badge"
              style={{ backgroundColor: getStatusColor(selectedApproval.status) }}
            >
              {getStatusLabel(selectedApproval.status)}
            </span>
          </div>
        </div>

        <div className="detail-content">
          <div className="content-section">
            <h3>설명</h3>
            <p>{selectedApproval.description || '추가 설명 없음'}</p>
          </div>

          {selectedApproval.rejectReason && (
            <div className="content-section reject-reason">
              <h3>반려 사유</h3>
              <p>{selectedApproval.rejectReason}</p>
            </div>
          )}

          {selectedApproval.status === 'pending' && (
            <div className="action-buttons">
              <button className="btn-approve" onClick={() => handleApprove(selectedApproval)}>
                <FiCheck />
                승인
              </button>
              <button className="btn-reject" onClick={() => handleReject(selectedApproval)}>
                <FiX />
                반려
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="esignature-page">
        <div className="esignature-header">
          <h1>전자결재 ({getSubPageLabel(currentSubPage)})</h1>
          <div className="header-actions">
            <button className="btn-designated">대리 결재인 지정</button>
            <button className="btn-create" onClick={() => setIsCreating(true)}>
              <FiPlus />
              결재 요청
            </button>
          </div>
        </div>

        <div className="esignature-list">
          {filteredApprovals.length === 0 ? (
            <div className="empty-state">
              <p>결재 항목이 없습니다</p>
            </div>
          ) : (
            filteredApprovals.map(approval => (
              <div
                key={approval.id}
                className="approval-item"
                onClick={() => setSelectedApproval(approval)}
              >
                <div className="approval-info">
                  <div className="approval-title">{approval.title}</div>
                  <div className="approval-id">ID {approval.id}</div>
                </div>

                <div className="approval-meta">
                  <span className="requester">{approval.requestedByName}</span>
                  <span className="role">{approval.requestedByRole}</span>
                </div>

                <div className="approval-date">{formatDate(approval.requestedAt)}</div>

                <span
                  className="status-button"
                  style={{ backgroundColor: getStatusColor(approval.status) }}
                >
                  {getStatusLabel(approval.status)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {isCreating && (
        <div className="modal-overlay" onClick={() => setIsCreating(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>결재 요청</h2>

            <form className="approval-form" onSubmit={(e) => {
              e.preventDefault()
              handleCreateApproval()
            }}>
              <div className="form-group">
                <label>제목</label>
                <input
                  type="text"
                  placeholder="결재 제목을 입력하세요"
                  value={newApprovalForm.title}
                  onChange={(e) => setNewApprovalForm({ ...newApprovalForm, title: e.target.value })}
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label>설명</label>
                <textarea
                  placeholder="상세 내용을 입력하세요"
                  value={newApprovalForm.description}
                  onChange={(e) => setNewApprovalForm({ ...newApprovalForm, description: e.target.value })}
                  rows={8}
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn-cancel" onClick={() => setIsCreating(false)}>취소</button>
                <button type="submit" className="btn-submit">작성하기</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
