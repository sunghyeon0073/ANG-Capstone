/**
 * 범용 모달 — .modal-overlay / .modal-content 전역 CSS 사용
 *
 * <Modal open={open} onClose={() => setOpen(false)} title="제목" minWidth={400}>
 *   ...content...
 *   <Modal.Footer>
 *     <button onClick={onClose}>취소</button>
 *   </Modal.Footer>
 * </Modal>
 */
function Modal({ open, onClose, title, children, minWidth = 360 }) {
  if (!open) return null
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ minWidth }}>
        {title && <h3 style={{ marginBottom: 16 }}>{title}</h3>}
        {children}
      </div>
    </div>
  )
}

Modal.Footer = function ModalFooter({ children }) {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 24 }}>
      {children}
    </div>
  )
}

export default Modal
