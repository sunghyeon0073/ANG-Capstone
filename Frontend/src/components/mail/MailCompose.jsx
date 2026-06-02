import {
  FiDownload,
  FiFileText,
  FiPaperclip,
  FiX,
} from 'react-icons/fi'

export default function MailCompose({
  draft,
  selectedRecipients,
  recipientQuery,
  isRecipientListOpen,
  isRecipientLoading,
  recipientErrorMessage,
  availableRecipientOptions,
  savedDraftAttachments,
  draftAttachments,
  isSubmitting,
  onSubmit,
  onSaveDraft,
  onDraftChange,
  onRecipientQueryChange,
  onRecipientFocus,
  onAddRecipient,
  onRemoveRecipient,
  onAttachmentSelect,
  onRemoveAttachment,
  onDownloadAttachment,
  getInitial,
  formatFileSize,
}) {
  return (
    <form className="mail-compose-panel" onSubmit={onSubmit}>
      <label className="mail-compose-row mail-recipient-row">
        받는 사람
        <div className="mail-recipient-input-shell">
          {selectedRecipients.map(recipient => (
            <span className="mail-recipient-chip" key={recipient.empNo}>
              {recipient.name}
              <button
                type="button"
                onClick={() => onRemoveRecipient(recipient.empNo)}
                aria-label={`${recipient.name} 수신자 제거`}
              >
                <FiX />
              </button>
            </span>
          ))}
          <input
            className="mail-recipient-input"
            value={recipientQuery}
            onFocus={onRecipientFocus}
            onChange={(event) => onRecipientQueryChange(event.target.value)}
            placeholder={selectedRecipients.length === 0 ? '이름 또는 사번으로 검색하세요' : '수신자 추가'}
          />
        </div>
        {isRecipientListOpen && (
          <div className="mail-recipient-dropdown">
            {isRecipientLoading ? (
              <div className="mail-recipient-empty">검색 중입니다.</div>
            ) : recipientErrorMessage ? (
              <div className="mail-recipient-empty">{recipientErrorMessage}</div>
            ) : availableRecipientOptions.length > 0 ? (
              availableRecipientOptions.map(recipient => (
                <button
                  key={recipient.empNo}
                  type="button"
                  className="mail-recipient-option"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onAddRecipient(recipient)}
                >
                  <span className="mail-recipient-avatar">{getInitial(recipient.name)}</span>
                  <span>
                    <strong>{recipient.name}</strong>
                    <em>
                      {recipient.empNo}
                      {recipient.position ? ` · ${recipient.position}` : ''}
                      {recipient.departments?.[0]?.scopeName ? ` · ${recipient.departments[0].scopeName}` : ''}
                    </em>
                  </span>
                </button>
              ))
            ) : recipientQuery.trim() ? (
              <div className="mail-recipient-empty">검색 결과가 없습니다.</div>
            ) : (
              <div className="mail-recipient-empty">추가할 멤버가 없습니다.</div>
            )}
          </div>
        )}
      </label>

      <label className="mail-compose-row">
        제목
        <input
          value={draft.subject}
          onChange={(event) => onDraftChange(prev => ({ ...prev, subject: event.target.value }))}
          placeholder="제목을 입력하세요"
        />
      </label>

      <label className="mail-compose-row mail-compose-body-row">
        내용
        <textarea
          value={draft.body}
          onChange={(event) => onDraftChange(prev => ({ ...prev, body: event.target.value }))}
          placeholder="메일 내용을 입력하세요"
        />
      </label>

      <div className="mail-compose-attachments">
        <label className="mail-attach-btn">
          <FiPaperclip />
          파일 첨부
          <input type="file" multiple onChange={onAttachmentSelect} />
        </label>
        <span className="mail-attach-hint">
          선택한 파일은 메일 저장 또는 발송 시 함께 업로드됩니다.
        </span>

        {savedDraftAttachments.length > 0 && (
          <div className="mail-attach-list">
            {savedDraftAttachments.map(file => (
              <div className="mail-attach-item" key={file.attachmentId}>
                <div className="mail-file-icon">
                  <FiFileText />
                </div>
                <div>
                  <strong>{file.fileName}</strong>
                  <span>저장된 첨부 파일</span>
                </div>
                <button type="button" onClick={() => onDownloadAttachment(file)} aria-label="첨부 다운로드">
                  <FiDownload />
                </button>
              </div>
            ))}
          </div>
        )}

        {draftAttachments.length > 0 && (
          <div className="mail-attach-list">
            {draftAttachments.map((file, index) => (
              <div className="mail-attach-item" key={`${file.name}-${file.size}-${file.lastModified}`}>
                <div className="mail-file-icon">
                  <FiFileText />
                </div>
                <div>
                  <strong>{file.name}</strong>
                  <span>{formatFileSize(file.size)}</span>
                </div>
                <button type="button" onClick={() => onRemoveAttachment(index)} aria-label="첨부 제거">
                  <FiX />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mail-compose-footer">
        <button type="button" className="btn btn-secondary" onClick={onSaveDraft} disabled={isSubmitting}>
          {isSubmitting ? '처리 중...' : '임시저장'}
        </button>
        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? '처리 중...' : '보내기'}
        </button>
      </div>
    </form>
  )
}
