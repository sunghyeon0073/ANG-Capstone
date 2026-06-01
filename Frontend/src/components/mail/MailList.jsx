import {
  FiArchive,
  FiMail,
  FiPaperclip,
  FiRefreshCcw,
  FiSearch,
  FiStar,
  FiTrash2,
  FiX,
} from 'react-icons/fi'

const SKELETON_ROWS = 9

function MailListSkeleton() {
  return (
    <div className="mail-list">
      {Array.from({ length: SKELETON_ROWS }).map((_, index) => (
        <div className="mail-list-item mail-list-skeleton" key={index}>
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      ))}
    </div>
  )
}

export default function MailList({
  config,
  mails,
  visibleMails,
  query,
  selectedMails,
  selectedMailKeySet,
  isLoading,
  hasSelectedMails,
  canBulkMoveToTrash,
  canBulkToggleImportant,
  canBulkCancelSent,
  canBulkRestore,
  canBulkPermanentDelete,
  onQueryChange,
  onRefresh,
  onMoveSelectedToTrash,
  onToggleSelectedImportant,
  onCancelSelectedSentMails,
  onRestoreSelectedMails,
  onPermanentlyDeleteSelectedMails,
  onOpenMailDetail,
  onToggleMailSelection,
  onToggleImportant,
  getMailKey,
  getReadStatusLabel,
}) {
  return (
    <section className="mail-list-panel">
      <div className="mail-list-title">
        <div className="mail-list-heading">
          <h2>{config.title}</h2>
          <span>{visibleMails.length}</span>
        </div>
        <div className="mail-list-controls">
          {hasSelectedMails && (
            <div className="mail-selection-actions" aria-label="선택 메일 작업">
              <span>{selectedMails.length}개 선택</span>
              {canBulkMoveToTrash && (
                <button type="button" onClick={onMoveSelectedToTrash} aria-label="선택 메일 삭제" title="삭제">
                  <FiTrash2 />
                </button>
              )}
              {canBulkToggleImportant && (
                <button type="button" onClick={onToggleSelectedImportant} aria-label="선택 메일 중요 표시" title="중요 표시">
                  <FiStar />
                </button>
              )}
              {canBulkCancelSent && (
                <button type="button" onClick={onCancelSelectedSentMails} aria-label="선택 메일 발송취소" title="발송취소">
                  <FiX />
                </button>
              )}
              {canBulkRestore && (
                <button type="button" onClick={onRestoreSelectedMails} aria-label="선택 메일 복원" title="복원">
                  <FiArchive />
                </button>
              )}
              {canBulkPermanentDelete && (
                <button type="button" onClick={onPermanentlyDeleteSelectedMails} aria-label="선택 메일 완전 삭제" title="완전 삭제">
                  <FiTrash2 />
                </button>
              )}
            </div>
          )}
          <div className="mail-search">
            <FiSearch />
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="메일 검색"
            />
          </div>
          <span className="mail-list-total">전체 {mails.length}개</span>
          <button className="mail-icon-btn" aria-label="새로고침" onClick={onRefresh}>
            <FiRefreshCcw />
          </button>
        </div>
      </div>

      {isLoading ? (
        <MailListSkeleton />
      ) : visibleMails.length === 0 ? (
        <div className="mail-empty">{config.empty}</div>
      ) : (
        <div className="mail-list">
          {visibleMails.map(mail => {
            const readStatusLabel = getReadStatusLabel(mail)
            const mailKey = getMailKey(mail)

            return (
              <div
                key={mailKey}
                className={`mail-list-item ${mail.unread ? 'unread' : ''} ${selectedMailKeySet.has(mailKey) ? 'selected' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => onOpenMailDetail(mail.id)}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) return
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onOpenMailDetail(mail.id)
                  }
                }}
              >
                <label className="mail-list-check" onClick={(event) => event.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedMailKeySet.has(mailKey)}
                    onChange={(event) => onToggleMailSelection(event, mail)}
                    aria-label={`${mail.subject} 선택`}
                  />
                </label>
                <button
                  type="button"
                  className={`mail-list-star ${mail.important ? 'active' : ''}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    onToggleImportant(mail.id)
                  }}
                  disabled={mail.box === 'draft'}
                  aria-label={mail.important ? '중요 표시 해제' : '중요 표시'}
                  title={mail.important ? '중요 표시 해제' : '중요 표시'}
                >
                  <FiStar />
                </button>
                {readStatusLabel ? (
                  <span
                    className={`mail-list-read ${readStatusLabel.includes('안읽음') ? 'unread' : 'read'}`}
                    aria-label={readStatusLabel}
                    title={readStatusLabel}
                  >
                    <FiMail />
                  </span>
                ) : (
                  <span className="mail-list-read" />
                )}
                <strong className="mail-list-sender">
                  {['sent', 'draft'].includes(mail.box) ? mail.to : mail.from}
                </strong>
                <div className="mail-list-subject">
                  <span>{mail.subject}</span>
                  {mail.preview && (
                    <span className="mail-list-preview">- {mail.preview}</span>
                  )}
                  {mail.attachments.length > 0 && <FiPaperclip aria-label="첨부파일 있음" />}
                </div>
                <time className="mail-list-date">{`${mail.date} ${mail.time}`}</time>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
