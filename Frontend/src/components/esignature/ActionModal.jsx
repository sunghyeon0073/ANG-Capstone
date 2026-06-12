import { useState } from 'react'
import { FiCheck, FiX } from 'react-icons/fi'
import { SignatureImg } from './SignaturePage'

const normalizeText = (value) => String(value || '').toLowerCase()

const META = {
  approve: { title: '승인', color: '#16a34a', confirmLabel: '승인하기' },
  reject:  { title: '반려', color: '#dc2626', confirmLabel: '반려하기' },
  delegate: { title: '대리결재', color: '#7c3aed', confirmLabel: '대리결재 지정' },
}

export default function ActionModal({ type, users, signatures, onConfirm, onClose, onGoToSignature }) {
  const [comment, setComment] = useState('')
  const [reason, setReason] = useState('')
  const [delegateSearch, setDelegateSearch] = useState('')
  const [delegateTarget, setDelegateTarget] = useState(null)
  const [selectedSignId, setSelectedSignId] = useState(null)
  const [loading, setLoading] = useState(false)

  const filtered = delegateSearch.trim()
    ? users.filter((u) =>
        normalizeText(u.name).includes(normalizeText(delegateSearch)) ||
        normalizeText(u.empNo).includes(normalizeText(delegateSearch))
      ).slice(0, 8)
    : []

  const handleSubmit = async () => {
    if (type === 'reject' && !reason.trim()) return
    if (type === 'delegate' && !delegateTarget) return
    if (type === 'approve' && signatures && signatures.length > 0 && !selectedSignId) return
    setLoading(true)
    try {
      await onConfirm({
        comment: comment.trim(),
        reason: reason.trim(),
        delegateeId: delegateTarget?.id,
        delegateeName: delegateTarget?.name,
        signatureId: selectedSignId,
      })
    } finally {
      setLoading(false)
    }
  }

  const meta = META[type]

  return (
    <div className="esig-modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="esig-modal">
        <div className="esig-modal-header" style={{ borderColor: meta.color }}>
          <h3 className="esig-modal-title" style={{ color: meta.color }}>{meta.title}</h3>
          <button className="esig-icon-btn" onClick={onClose}><FiX size={18} /></button>
        </div>

        <div className="esig-modal-body">
          {type === 'approve' && (
            <>
              <div className="esig-field">
                <label>서명 선택 <span className="esig-modal-required">*</span></label>
                {signatures && signatures.length > 0 ? (
                  <div className="esig-sign-picker">
                    {signatures.map((sig) => (
                      <button
                        key={sig.id}
                        type="button"
                        className={`esig-sign-picker-item ${selectedSignId === sig.id ? 'active' : ''}`}
                        onClick={() => setSelectedSignId(sig.id)}
                      >
                        <SignatureImg signId={sig.id} alt={sig.label} />
                        <span>{sig.label || '서명'}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="esig-sign-empty-notice">
                    <span>등록된 서명이 없습니다. </span>
                    <button type="button" className="esig-sign-manage-link" onClick={() => { onClose(); onGoToSignature?.() }}>
                      서명 관리 페이지로 이동
                    </button>
                    <span>해서 서명을 등록해 주세요.</span>
                  </div>
                )}
              </div>
              <div className="esig-field">
                <label>승인 의견 <span className="esig-modal-optional">(선택)</span></label>
                <textarea
                  className="esig-modal-textarea"
                  placeholder="승인 의견을 입력하세요."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={4}
                  autoFocus={!signatures || signatures.length === 0}
                />
              </div>
            </>
          )}

          {type === 'reject' && (
            <div className="esig-field">
              <label>반려 사유 <span className="esig-modal-required">*</span></label>
              <textarea
                className="esig-modal-textarea"
                placeholder="반려 사유를 입력하세요."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                autoFocus
              />
            </div>
          )}

          {type === 'delegate' && (
            <>
              <div className="esig-field">
                <label>대리결재자 검색 <span className="esig-modal-required">*</span></label>
                <input
                  type="text"
                  placeholder="이름 또는 사번 입력"
                  value={delegateSearch}
                  onChange={(e) => { setDelegateSearch(e.target.value); setDelegateTarget(null) }}
                  autoFocus
                />
                {filtered.length > 0 && !delegateTarget && (
                  <div className="esig-modal-user-list">
                    {filtered.map((u) => (
                      <button
                        key={u.id}
                        className="esig-modal-user-row"
                        onClick={() => { setDelegateTarget(u); setDelegateSearch(u.name) }}
                      >
                        <strong>{u.name}</strong>
                        <span>{u.position || ''} · {u.empNo}</span>
                      </button>
                    ))}
                  </div>
                )}
                {delegateTarget && (
                  <div className="esig-modal-selected">
                    <FiCheck size={13} style={{ color: '#16a34a' }} />
                    <span>{delegateTarget.name} {delegateTarget.position || ''}</span>
                    <button className="esig-icon-btn" onClick={() => { setDelegateTarget(null); setDelegateSearch('') }}><FiX size={12} /></button>
                  </div>
                )}
              </div>
              <div className="esig-field">
                <label>대리결재 사유 <span className="esig-modal-optional">(선택)</span></label>
                <textarea
                  className="esig-modal-textarea"
                  placeholder="대리결재 사유를 입력하세요."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                />
              </div>
            </>
          )}
        </div>

        <div className="esig-modal-footer">
          <button className="esig-btn esig-btn-ghost" onClick={onClose} disabled={loading}>취소</button>
          {(() => {
            const isDisabled =
              loading ||
              (type === 'reject' && !reason.trim()) ||
              (type === 'delegate' && !delegateTarget) ||
              (type === 'approve' && signatures && signatures.length > 0 && !selectedSignId) ||
              (type === 'approve' && (!signatures || signatures.length === 0))

            const tooltip =
              type === 'approve' && (!signatures || signatures.length === 0)
                ? '서명을 먼저 등록해야 승인할 수 있습니다.'
                : type === 'approve' && !selectedSignId
                ? '서명을 선택해야 승인할 수 있습니다.'
                : null

            return (
              <span className={tooltip ? 'esig-btn-tooltip-wrap' : undefined} data-tooltip={tooltip || undefined}>
                <button
                  className="esig-btn esig-btn-primary"
                  style={{ background: meta.color, borderColor: meta.color }}
                  onClick={handleSubmit}
                  disabled={isDisabled}
                >
                  {loading ? '처리 중...' : meta.confirmLabel}
                </button>
              </span>
            )
          })()}
        </div>
      </div>
    </div>
  )
}
