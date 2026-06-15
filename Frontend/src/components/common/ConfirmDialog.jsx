import Modal from './Modal'

/**
 * 확인/취소 다이얼로그 — window.confirm() 대체
 *
 * <ConfirmDialog
 *   open={!!confirmState}
 *   title="퇴사 처리"
 *   message={<>정말 <strong>[홍길동]</strong>을 퇴사 처리하시겠습니까?</>}
 *   confirmLabel="퇴사 처리"
 *   dangerous
 *   onConfirm={handleDelete}
 *   onClose={() => setConfirmState(null)}
 * />
 */
export default function ConfirmDialog({
  open,
  onClose,
  title,
  message,
  confirmLabel = '확인',
  dangerous = false,
  onConfirm,
}) {
  if (!open) return null

  const handleConfirm = () => {
    onConfirm?.()
    onClose?.()
  }

  return (
    <Modal open={open} onClose={onClose} title={title} minWidth={360}>
      {message && (
        <p style={{ fontSize: 14, color: '#555', marginBottom: 0, lineHeight: 1.6 }}>
          {message}
        </p>
      )}
      <Modal.Footer>
        <button className="btn btn-secondary" onClick={onClose}>취소</button>
        <button
          className={dangerous ? 'btn btn-danger' : 'btn btn-primary'}
          onClick={handleConfirm}
        >
          {confirmLabel}
        </button>
      </Modal.Footer>
    </Modal>
  )
}
