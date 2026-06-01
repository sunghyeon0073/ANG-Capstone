import {
  FiArchive,
  FiArrowLeft,
  FiCornerUpLeft,
  FiDownload,
  FiEdit3,
  FiFileText,
  FiSend,
  FiStar,
  FiTrash2,
  FiX,
} from 'react-icons/fi'

export default function MailDetail({
  selectedMail,
  currentBox,
  isSubmitting,
  onBack,
  onRestore,
  onPermanentDelete,
  onMoveToTrash,
  onOpenDraft,
  onSendSavedDraft,
  onToggleImportant,
  onCancelSentMail,
  onReply,
  onDownloadAttachment,
  getInitial,
}) {
  return (
    <section className="mail-detail-panel">
      <button type="button" className="mail-back-btn" onClick={onBack}>
        <FiArrowLeft />
        목록으로
      </button>
      {selectedMail ? (
        <>
          <div className="mail-detail-head">
            <div>
              <h2>{selectedMail.subject}</h2>
              <div className="mail-sender">
                <div className="mail-detail-avatar">
                  {getInitial(['sent', 'draft'].includes(selectedMail.box) ? selectedMail.to : selectedMail.from)}
                </div>
                <div>
                  <strong>{['sent', 'draft'].includes(selectedMail.box) ? selectedMail.to : selectedMail.from}</strong>
                  <span>
                    {['sent', 'draft'].includes(selectedMail.box) ? `받는 사람: ${selectedMail.to}` : `보낸 사람: ${selectedMail.from}`} · {selectedMail.date} · {selectedMail.time}
                  </span>
                </div>
              </div>
            </div>
            <div className="mail-actions">
              {currentBox === 'mail-trash' ? (
                <>
                  <button onClick={() => onRestore(selectedMail.id)} aria-label="복원" title="복원">
                    <FiArchive />
                  </button>
                  <button onClick={() => onPermanentDelete(selectedMail.id)} aria-label="완전 삭제" title="완전 삭제">
                    <FiTrash2 />
                  </button>
                </>
              ) : selectedMail.box === 'draft' ? (
                <>
                  <button onClick={() => onMoveToTrash(selectedMail.id)} aria-label="삭제" title="삭제">
                    <FiTrash2 />
                  </button>
                  <button onClick={() => onOpenDraft(selectedMail)} aria-label="이어쓰기" title="이어쓰기">
                    <FiEdit3 />
                  </button>
                  <button
                    onClick={() => onSendSavedDraft(selectedMail.id)}
                    aria-label="바로 보내기"
                    title="바로 보내기"
                    disabled={isSubmitting}
                  >
                    <FiSend />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => onToggleImportant(selectedMail.id)}
                    aria-label="중요 표시"
                    title={selectedMail.important ? '중요 해제' : '중요 표시'}
                  >
                    <FiStar className={selectedMail.important ? 'mail-star-active' : ''} />
                  </button>
                  <button onClick={() => onMoveToTrash(selectedMail.id)} aria-label="삭제" title="삭제">
                    <FiTrash2 />
                  </button>
                  {selectedMail.box === 'sent' && selectedMail.status === 'SENT' && (
                    <button onClick={() => onCancelSentMail(selectedMail.id)} aria-label="발송취소" title="발송취소">
                      <FiX />
                    </button>
                  )}
                  {selectedMail.box !== 'sent' && (
                    <button aria-label="답장" title="답장" onClick={onReply}>
                      <FiCornerUpLeft />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="mail-body">
            {selectedMail.isDetailLoaded ? selectedMail.body || '내용 없음' : '메일 내용을 불러오는 중입니다.'}
          </div>

          {selectedMail.attachments.length > 0 && (
            <div className="mail-attachments">
              {selectedMail.attachments.map(file => (
                <div className="mail-attachment" key={file.attachmentId}>
                  <div className="mail-file-icon">
                    <FiFileText />
                  </div>
                  <div>
                    <strong>{file.fileName}</strong>
                  </div>
                  <button type="button" onClick={() => onDownloadAttachment(file)}>
                    <FiDownload />
                    다운로드
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="mail-detail-empty">확인할 메일을 선택해주세요.</div>
      )}
    </section>
  )
}
