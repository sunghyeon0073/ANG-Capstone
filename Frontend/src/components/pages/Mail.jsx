import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  FiArchive,
  FiCornerUpLeft,
  FiDownload,
  FiEdit3,
  FiFileText,
  FiPaperclip,
  FiRefreshCcw,
  FiSearch,
  FiSend,
  FiStar,
  FiTrash2,
  FiX,
} from 'react-icons/fi'
import {
  deleteInboxMail,
  deleteSentMail,
  cancelMail,
  getDraftMails,
  getInboxMails,
  getMailDetail,
  getMailReadStatus,
  getSentMails,
  saveMailDraft,
  sendMail,
} from '../../api/mailApi'

const mailboxConfig = {
  'mail-compose': { title: '메일 작성', empty: '' },
  'mail-inbox': { title: '받은 메일함', empty: '받은 메일이 없습니다.' },
  'mail-sent': { title: '보낸 메일함', empty: '보낸 메일이 없습니다.' },
  'mail-drafts': { title: '임시보관함', empty: '임시저장된 메일이 없습니다.' },
  'mail-important': { title: '중요 메일함', empty: '중요 표시한 메일이 없습니다.' },
  'mail-trash': { title: '휴지통', empty: '휴지통 API가 아직 없어 삭제된 메일은 목록에서 제거됩니다.' },
}

const getInitial = (name) => name?.charAt(0) || '?'
const getResponseData = (response) => response?.data?.data ?? response?.data ?? []
const normalizeMailboxId = (id) => (id === 'mail-draft' ? 'mail-drafts' : id)

const formatFileSize = (bytes) => {
  if (!Number.isFinite(bytes)) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

const formatDateTime = (value) => {
  if (!value) return { date: '-', time: '-' }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return { date: '-', time: '-' }

  return {
    date: date.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' }),
    time: date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
  }
}

const parseRecipients = (value) => (
  value
    .split(/[\s,;]+/)
    .map(item => item.trim())
    .filter(Boolean)
)

const mapSummary = (mail, box, importantIds = []) => {
  const { date, time } = formatDateTime(mail.sentAt || mail.createdAt)
  const id = mail.mailId

  return {
    id,
    box,
    from: mail.senderName || mail.senderEmpNo || '알 수 없음',
    to: ['sent', 'draft'].includes(box) ? '수신자 확인' : '',
    subject: mail.title || '(제목 없음)',
    preview: mail.status === 'CANCELLED' ? '발송 취소된 메일입니다.' : '메일을 선택하면 내용을 확인할 수 있습니다.',
    body: '',
    time,
    date,
    status: mail.status,
    important: importantIds.includes(String(id)),
    unread: box === 'inbox' ? !mail.read : false,
    attachments: [],
    recipients: [],
    isDetailLoaded: false,
  }
}

const mergeDetail = (mail, detail) => {
  const { date, time } = formatDateTime(detail.sentAt || detail.createdAt)
  const recipients = detail.recipients || []
  const recipientText = recipients
    .map(item => item.recipientName || item.recipientEmpNo)
    .filter(Boolean)
    .join(', ')

  return {
    ...mail,
    from: detail.senderName || detail.senderEmpNo || mail.from,
    to: recipientText || mail.to || '-',
    subject: detail.title || mail.subject,
    preview: detail.body || mail.preview,
    body: detail.body || '',
    status: detail.status || mail.status,
    date,
    time,
    recipients,
    unread: false,
    isDetailLoaded: true,
  }
}

export default function Mail({ currentSubPage = 'mail-inbox', user }) {
  const [activeBox, setActiveBox] = useState(normalizeMailboxId(currentSubPage || 'mail-inbox'))
  const [mails, setMails] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState({ to: '', subject: '', body: '' })
  const [draftAttachments, setDraftAttachments] = useState([])
  const [importantIds, setImportantIds] = useState(() => (
    JSON.parse(localStorage.getItem('mailImportantIds') || '[]')
  ))
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [readStatuses, setReadStatuses] = useState([])
  const [isReadStatusOpen, setIsReadStatusOpen] = useState(false)
  const [isReadStatusLoading, setIsReadStatusLoading] = useState(false)

  const currentBox = activeBox
  const config = mailboxConfig[currentBox] || mailboxConfig['mail-inbox']
  const isComposePage = currentBox === 'mail-compose'

  useEffect(() => {
    setActiveBox(normalizeMailboxId(currentSubPage || 'mail-inbox'))
  }, [currentSubPage])

  const persistImportantIds = (nextIds) => {
    setImportantIds(nextIds)
    localStorage.setItem('mailImportantIds', JSON.stringify(nextIds))
  }

  const loadMails = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage('')

    try {
      if (currentBox === 'mail-compose' || currentBox === 'mail-trash') {
        setMails([])
        setSelectedId(null)
        return
      }

      const loaders = currentBox === 'mail-sent'
        ? [getSentMails().then(res => getResponseData(res).map(mail => mapSummary(mail, 'sent', importantIds)))]
        : currentBox === 'mail-drafts'
          ? [getDraftMails().then(res => getResponseData(res).map(mail => mapSummary(mail, 'draft', importantIds)))]
        : currentBox === 'mail-important'
          ? [
              getInboxMails().then(res => getResponseData(res).map(mail => mapSummary(mail, 'inbox', importantIds))),
              getSentMails().then(res => getResponseData(res).map(mail => mapSummary(mail, 'sent', importantIds))),
              getDraftMails().then(res => getResponseData(res).map(mail => mapSummary(mail, 'draft', importantIds))),
            ]
          : [getInboxMails().then(res => getResponseData(res).map(mail => mapSummary(mail, 'inbox', importantIds)))]

      const loaded = (await Promise.all(loaders)).flat()
      const filtered = currentBox === 'mail-important'
        ? loaded.filter(mail => mail.important)
        : loaded

      setMails(filtered)
      setSelectedId(filtered[0]?.id || null)
      setReadStatuses([])
      setIsReadStatusOpen(false)
    } catch (error) {
      console.error('메일 목록 로드 실패', error)
      setMails([])
      setSelectedId(null)
      setErrorMessage('메일 목록을 불러오지 못했습니다.')
    } finally {
      setIsLoading(false)
    }
  }, [currentBox, importantIds])

  useEffect(() => {
    loadMails()
  }, [loadMails])

  const visibleMails = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return mails.filter(mail => {
      if (!normalizedQuery) return true
      return [mail.subject, mail.from, mail.to, mail.preview, mail.body]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery)
    })
  }, [mails, query])

  const selectedMail = useMemo(() => {
    const currentSelected = visibleMails.find(mail => mail.id === selectedId)
    return currentSelected || visibleMails[0] || null
  }, [visibleMails, selectedId])

  const selectMail = async (id) => {
    setSelectedId(id)
    setErrorMessage('')
    setReadStatuses([])
    setIsReadStatusOpen(false)

    const target = mails.find(mail => mail.id === id)
    if (!target || target.isDetailLoaded) return

    try {
      const response = await getMailDetail(id)
      const detail = getResponseData(response)
      setMails(prev => prev.map(mail => (
        mail.id === id ? mergeDetail(mail, detail) : mail
      )))
    } catch (error) {
      console.error('메일 상세 로드 실패', error)
      setErrorMessage('메일 내용을 불러오지 못했습니다.')
    }
  }

  useEffect(() => {
    if (selectedMail && !selectedMail.isDetailLoaded) {
      selectMail(selectedMail.id)
    }
  }, [selectedMail?.id])

  const toggleImportant = (id) => {
    const key = String(id)
    const nextIds = importantIds.includes(key)
      ? importantIds.filter(item => item !== key)
      : [...importantIds, key]

    persistImportantIds(nextIds)
    setMails(prev => prev.map(mail => (
      mail.id === id ? { ...mail, important: !mail.important } : mail
    )))
  }

  const openDraft = (mail) => {
    setDraft({
      to: mail.recipients?.map(item => item.recipientEmpNo).filter(Boolean).join(', ') || '',
      subject: mail.subject === '(제목 없음)' ? '' : mail.subject,
      body: mail.body || '',
    })
    setDraftAttachments([])
    setActiveBox('mail-compose')
  }

  const handleAttachmentSelect = (event) => {
    const selectedFiles = Array.from(event.target.files || [])
    if (selectedFiles.length === 0) return

    setDraftAttachments(prev => {
      const existingKeys = new Set(prev.map(file => `${file.name}-${file.size}-${file.lastModified}`))
      const uniqueFiles = selectedFiles.filter(file => !existingKeys.has(`${file.name}-${file.size}-${file.lastModified}`))
      return [...prev, ...uniqueFiles]
    })
    event.target.value = ''
  }

  const removeAttachment = (index) => {
    setDraftAttachments(prev => prev.filter((_, fileIndex) => fileIndex !== index))
  }

  const moveToTrash = async (id) => {
    const target = mails.find(mail => mail.id === id)
    if (!target) return

    setErrorMessage('')

    try {
      if (target.box === 'draft') {
        setErrorMessage('임시저장 메일 삭제 API가 없어 삭제는 아직 지원되지 않습니다.')
        return
      }

      if (target.box === 'sent') {
        await deleteSentMail(id)
      } else {
        await deleteInboxMail(id)
      }

      setMails(prev => prev.filter(mail => mail.id !== id))
      setSelectedId(prev => (prev === id ? null : prev))
    } catch (error) {
      console.error('메일 삭제 실패', error)
      setErrorMessage('메일을 삭제하지 못했습니다.')
    }
  }

  const restoreMail = () => {
    setErrorMessage('백엔드에 휴지통 복원 API가 없어 복원은 아직 지원되지 않습니다.')
  }

  const saveDraft = async () => {
    const recipientEmpNos = parseRecipients(draft.to)

    if (!draft.subject.trim() && !draft.body.trim() && recipientEmpNos.length === 0) {
      setErrorMessage('임시저장할 내용을 입력해주세요.')
      return
    }

    setErrorMessage('')

    try {
      await saveMailDraft({
        title: draft.subject.trim(),
        body: draft.body,
        recipientEmpNos,
      })

      setDraft({ to: '', subject: '', body: '' })
      setDraftAttachments([])
      setActiveBox('mail-drafts')
    } catch (error) {
      console.error('메일 임시저장 실패', error)
      setErrorMessage('메일을 임시저장하지 못했습니다. 수신자 사번을 확인해주세요.')
    }
  }

  const submitDraft = async (event) => {
    event.preventDefault()

    const recipientEmpNos = parseRecipients(draft.to)
    if (recipientEmpNos.length === 0 || !draft.subject.trim()) {
      setErrorMessage('받는 사람 사번과 제목을 입력해주세요.')
      return
    }

    setErrorMessage('')

    try {
      await sendMail({
        title: draft.subject.trim(),
        body: draft.body,
        recipientEmpNos,
      })

      setDraft({ to: '', subject: '', body: '' })
      setDraftAttachments([])
      await loadMails()
      setActiveBox('mail-sent')
    } catch (error) {
      console.error('메일 발송 실패', error)
      setErrorMessage('메일을 발송하지 못했습니다. 수신자 사번을 확인해주세요.')
    }
  }

  const cancelSentMail = async (id) => {
    setErrorMessage('')

    try {
      await cancelMail(id)
      await loadMails()
    } catch (error) {
      console.error('발송 취소 실패', error)
      setErrorMessage('메일을 발송 취소하지 못했습니다. 이미 읽은 수신자가 있으면 취소할 수 없습니다.')
    }
  }

  const loadReadStatus = async (id) => {
    setErrorMessage('')
    setIsReadStatusOpen(true)
    setIsReadStatusLoading(true)

    try {
      const response = await getMailReadStatus(id)
      setReadStatuses(getResponseData(response))
    } catch (error) {
      console.error('수신 확인 로드 실패', error)
      setReadStatuses([])
      setErrorMessage('수신 확인 정보를 불러오지 못했습니다.')
    } finally {
      setIsReadStatusLoading(false)
    }
  }

  return (
    <div className="mail-page">
      <div className="mail-header">
        <div>
          <div className="mail-eyebrow">MAIL</div>
          <h1>{config.title}</h1>
        </div>
      </div>

      {errorMessage && <div className="mail-error">{errorMessage}</div>}

      {isComposePage ? (
        <form className="mail-compose-panel" onSubmit={submitDraft}>
          <label className="mail-compose-row">
            받는 사람 사번
            <input
              value={draft.to}
              onChange={(event) => setDraft(prev => ({ ...prev, to: event.target.value }))}
              placeholder="예: manager 또는 emp001, emp002"
            />
          </label>
          <label className="mail-compose-row">
            제목
            <input
              value={draft.subject}
              onChange={(event) => setDraft(prev => ({ ...prev, subject: event.target.value }))}
              placeholder="제목을 입력하세요"
            />
          </label>
          <label className="mail-compose-row mail-compose-body-row">
            내용
            <textarea
              value={draft.body}
              onChange={(event) => setDraft(prev => ({ ...prev, body: event.target.value }))}
              placeholder="메일 내용을 입력하세요"
            />
          </label>
          <div className="mail-compose-attachments">
            <label className="mail-attach-btn">
              <FiPaperclip />
              파일 첨부
              <input type="file" multiple onChange={handleAttachmentSelect} />
            </label>
            <span className="mail-attach-hint">
              현재 선택한 파일은 작성 화면에만 표시됩니다. 메일 첨부 저장은 백엔드 API 추가가 필요합니다.
            </span>
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
                    <button type="button" onClick={() => removeAttachment(index)} aria-label="첨부 제거">
                      <FiX />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="mail-compose-footer">
            <button type="button" className="btn btn-secondary" onClick={saveDraft}>
              임시저장
            </button>
            <button type="submit" className="btn btn-primary">
              <FiSend />
              보내기
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="mail-toolbar">
            <div className="mail-search">
              <FiSearch />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="메일 검색"
              />
            </div>
            <button className="mail-icon-btn" aria-label="새로고침" onClick={loadMails}>
              <FiRefreshCcw />
            </button>
          </div>

          <div className="mail-shell">
            <section className="mail-list-panel">
              <div className="mail-list-title">
                <h2>{config.title}</h2>
                <span>{visibleMails.length}</span>
              </div>

              {isLoading ? (
                <div className="mail-empty">메일을 불러오는 중입니다.</div>
              ) : visibleMails.length === 0 ? (
                <div className="mail-empty">{config.empty}</div>
              ) : (
                <div className="mail-list">
                  {visibleMails.map(mail => (
                    <button
                      key={`${mail.box}-${mail.id}`}
                      className={`mail-list-item ${selectedMail?.id === mail.id ? 'active' : ''} ${mail.unread ? 'unread' : ''}`}
                      onClick={() => selectMail(mail.id)}
                    >
                      <div className="mail-list-avatar">{getInitial(['sent', 'draft'].includes(mail.box) ? mail.to : mail.from)}</div>
                      <div className="mail-list-main">
                        <div className="mail-list-top">
                          <strong>{['sent', 'draft'].includes(mail.box) ? mail.to : mail.from}</strong>
                          <span>{mail.time}</span>
                        </div>
                        <div className="mail-list-subject">{mail.subject}</div>
                        <p>{mail.preview}</p>
                        <div className="mail-list-meta">
                          {mail.attachments.length > 0 && <FiPaperclip />}
                          {mail.important && <FiStar />}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="mail-detail-panel">
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
                      <button onClick={() => toggleImportant(selectedMail.id)} aria-label="중요 표시">
                        <FiStar className={selectedMail.important ? 'mail-star-active' : ''} />
                      </button>
                      {currentBox === 'mail-trash' ? (
                        <button onClick={restoreMail} aria-label="복원">
                          <FiArchive />
                        </button>
                      ) : (
                        <button onClick={() => moveToTrash(selectedMail.id)} aria-label="삭제">
                          <FiTrash2 />
                        </button>
                      )}
                      {selectedMail.box === 'draft' && (
                        <button onClick={() => openDraft(selectedMail)} aria-label="임시저장 이어쓰기">
                          <FiEdit3 />
                        </button>
                      )}
                      {selectedMail.box === 'sent' && selectedMail.status === 'SENT' && (
                        <button onClick={() => cancelSentMail(selectedMail.id)} aria-label="발송취소">
                          <FiX />
                        </button>
                      )}
                      {selectedMail.box === 'sent' && (
                        <button onClick={() => loadReadStatus(selectedMail.id)} aria-label="수신확인">
                          <FiArchive />
                        </button>
                      )}
                      <button aria-label="답장" onClick={() => setActiveBox('mail-compose')}>
                        <FiCornerUpLeft />
                      </button>
                    </div>
                  </div>

                  <div className="mail-body">
                    {selectedMail.isDetailLoaded ? selectedMail.body || '내용 없음' : '메일 내용을 불러오는 중입니다.'}
                  </div>

                  {isReadStatusOpen && (
                    <div className="mail-read-status">
                      <div className="mail-read-status-head">
                        <h3>수신 확인</h3>
                        <button type="button" onClick={() => setIsReadStatusOpen(false)}>
                          <FiX />
                        </button>
                      </div>
                      {isReadStatusLoading ? (
                        <div className="mail-read-empty">수신 확인 정보를 불러오는 중입니다.</div>
                      ) : readStatuses.length === 0 ? (
                        <div className="mail-read-empty">수신 확인 정보가 없습니다.</div>
                      ) : (
                        <div className="mail-read-list">
                          {readStatuses.map(item => {
                            const readTime = formatDateTime(item.readAt)
                            return (
                              <div className="mail-read-item" key={item.recipientEmpNo}>
                                <div>
                                  <strong>{item.recipientName || item.recipientEmpNo}</strong>
                                  <span>{item.recipientEmpNo}</span>
                                </div>
                                <em className={item.read ? 'read' : 'unread'}>
                                  {item.read ? `${readTime.date} ${readTime.time}` : '안 읽음'}
                                </em>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {selectedMail.attachments.length > 0 && (
                    <div className="mail-attachments">
                      {selectedMail.attachments.map(file => (
                        <div className="mail-attachment" key={file.name}>
                          <div className="mail-file-icon">
                            <FiFileText />
                          </div>
                          <div>
                            <strong>{file.name}</strong>
                            <span>{file.size}</span>
                          </div>
                          <button>
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
          </div>
        </>
      )}

    </div>
  )
}
