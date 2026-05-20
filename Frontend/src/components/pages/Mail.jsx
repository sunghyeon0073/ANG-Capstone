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
  deleteDraftMail,
  cancelMail,
  getDraftMails,
  getFavoriteMails,
  getInboxMails,
  getInboxTrashMails,
  getMailDetail,
  getMailReadStatus,
  getSentMails,
  getSentTrashMails,
  restoreInboxMail,
  restoreSentMail,
  saveMailDraft,
  sendMail,
  toggleInboxFavorite,
  toggleSentFavorite,
} from '../../api/mailApi'
import { searchUsers } from '../../api/userApi'

// 사이드바에서 넘어오는 currentSubPage 값별로 화면 제목과 빈 상태 문구를 정리해둔 설정입니다.
const mailboxConfig = {
  'mail-compose': { title: '메일 작성', empty: '' },
  'mail-inbox': { title: '받은 메일함', empty: '받은 메일이 없습니다.' },
  'mail-sent': { title: '보낸 메일함', empty: '보낸 메일이 없습니다.' },
  'mail-drafts': { title: '임시보관함', empty: '임시저장된 메일이 없습니다.' },
  'mail-important': { title: '중요 메일함', empty: '중요 표시한 메일이 없습니다.' },
  'mail-trash': { title: '휴지통', empty: '휴지통에 메일이 없습니다.' },
}

// 백엔드/브라우저 데이터를 화면에서 쓰기 쉬운 형태로 바꾸기 위한 작은 유틸 함수들입니다.
const getInitial = (name) => name?.charAt(0) || '?'
const getResponseData = (response) => response?.data?.data ?? response?.data ?? []
const normalizeMailboxId = (id) => (id === 'mail-draft' ? 'mail-drafts' : id)
const getStoredUserEmpNo = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}')?.empNo
  } catch {
    return undefined
  }
}

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

// 목록 API 응답은 본문/수신자 정보가 부족하므로, 일단 목록에 필요한 최소 데이터만 화면용 객체로 변환합니다.
const mapSummary = (mail, box, importantIds = []) => {
  const { date, time } = formatDateTime(mail.sentAt || mail.createdAt)
  const id = mail.mailId
  const isFavorite = mail.favorite ?? mail.isFavorite
  const isRead = mail.read ?? mail.isRead

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
    important: Boolean(isFavorite) || importantIds.includes(String(id)),
    unread: box === 'inbox' ? !isRead : false,
    attachments: [],
    recipients: [],
    isDetailLoaded: false,
  }
}

// 상세 API 응답을 기존 목록 객체에 합쳐서, 오른쪽 상세 패널에서 쓸 수 있는 데이터로 만듭니다.
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
  // activeBox는 현재 메일 화면 모드입니다. 예: 메일작성, 받은메일, 보낸메일, 임시보관함 등.
  const [activeBox, setActiveBox] = useState(normalizeMailboxId(currentSubPage || 'mail-inbox'))
  // mails는 현재 선택된 메일함의 목록 데이터입니다.
  const [mails, setMails] = useState([])
  // selectedId는 오른쪽 상세 패널에 보여줄 메일의 ID입니다.
  const [selectedId, setSelectedId] = useState(null)
  const [query, setQuery] = useState('')
  // draft는 메일 작성 화면에서 입력 중인 값입니다.
  const [draft, setDraft] = useState({ to: '', subject: '', body: '' })
  // 현재 백엔드에 메일 첨부 API가 없어서, 선택 파일은 프론트 화면에서만 임시로 들고 있습니다.
  const [draftAttachments, setDraftAttachments] = useState([])
  // 받는 사람 검색창과 검색 결과 드롭다운 상태입니다.
  const [recipientQuery, setRecipientQuery] = useState('')
  const [recipientOptions, setRecipientOptions] = useState([])
  const [isRecipientListOpen, setIsRecipientListOpen] = useState(false)
  const [isRecipientLoading, setIsRecipientLoading] = useState(false)
  const [recipientErrorMessage, setRecipientErrorMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [readStatuses, setReadStatuses] = useState([])
  const [isReadStatusOpen, setIsReadStatusOpen] = useState(false)
  const [isReadStatusLoading, setIsReadStatusLoading] = useState(false)

  const currentBox = activeBox
  const config = mailboxConfig[currentBox] || mailboxConfig['mail-inbox']
  const isComposePage = currentBox === 'mail-compose'

  // 사이드바에서 다른 메일 메뉴를 클릭하면 currentSubPage가 바뀌고, 그 값을 내부 activeBox에 반영합니다.
  useEffect(() => {
    setActiveBox(normalizeMailboxId(currentSubPage || 'mail-inbox'))
  }, [currentSubPage])

  // 이름이나 사번을 입력하면 백엔드 사용자 검색 API에서 수신자 후보를 가져옵니다.
  const loadRecipientOptions = useCallback(async (keyword) => {
    const trimmedKeyword = keyword.trim()

    setIsRecipientLoading(true)
    setRecipientErrorMessage('')

    try {
      const response = await searchUsers(trimmedKeyword)
      setRecipientOptions(getResponseData(response))
    } catch (error) {
      console.error('수신자 검색 실패', error)
      setRecipientOptions([])
      setRecipientErrorMessage(
        error.response?.status === 401 || error.response?.status === 403
          ? '로그인 인증이 필요해서 멤버를 불러오지 못했습니다.'
          : '멤버 검색 API 호출에 실패했습니다.'
      )
    } finally {
      setIsRecipientLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isComposePage || !isRecipientListOpen) return

    const timer = window.setTimeout(() => {
      loadRecipientOptions(recipientQuery)
    }, 200)

    return () => window.clearTimeout(timer)
  }, [isComposePage, isRecipientListOpen, recipientQuery, loadRecipientOptions])

  useEffect(() => {
    if (!isRecipientListOpen) return

    const closeRecipientList = (event) => {
      if (event.target.closest('.mail-recipient-input, .mail-recipient-dropdown')) return
      setIsRecipientListOpen(false)
    }

    document.addEventListener('mousedown', closeRecipientList)

    return () => {
      document.removeEventListener('mousedown', closeRecipientList)
    }
  }, [isRecipientListOpen])

  // 현재 메일함(activeBox)에 맞는 백엔드 목록 API를 호출해서 mails 상태를 채웁니다.
  const loadMails = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage('')

    try {
      // 작성 화면은 목록이 필요 없어서 빈 상태로 처리합니다.
      if (currentBox === 'mail-compose') {
        setMails([])
        setSelectedId(null)
        return
      }

      // 메일함 종류에 맞춰 백엔드 목록 API를 호출합니다.
      const currentEmpNo = user?.empNo || getStoredUserEmpNo()
      const loaders = currentBox === 'mail-sent'
        ? [getSentMails().then(res => getResponseData(res).map(mail => mapSummary(mail, 'sent')))]
        : currentBox === 'mail-drafts'
          ? [getDraftMails().then(res => getResponseData(res).map(mail => mapSummary(mail, 'draft')))]
        : currentBox === 'mail-important'
          ? [getFavoriteMails().then(res => getResponseData(res).map(mail => {
              const box = currentEmpNo && mail.senderEmpNo === currentEmpNo ? 'sent' : 'inbox'
              return mapSummary(mail, box, [String(mail.mailId)])
            }))]
        : currentBox === 'mail-trash'
          ? [
              getInboxTrashMails().then(res => getResponseData(res).map(mail => mapSummary(mail, 'inbox'))),
              getSentTrashMails().then(res => getResponseData(res).map(mail => mapSummary(mail, 'sent'))),
            ]
          : [getInboxMails().then(res => getResponseData(res).map(mail => mapSummary(mail, 'inbox')))]

      const loaded = (await Promise.all(loaders)).flat()
      const filtered = loaded

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
  }, [currentBox, user?.empNo])

  useEffect(() => {
    loadMails()
  }, [loadMails])

  // 검색어가 있을 때 현재 메일 목록에서 제목/보낸사람/본문 등을 기준으로 필터링합니다.
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

  // 선택된 메일이 없으면 첫 번째 메일을 기본 상세 대상으로 잡습니다.
  const selectedMail = useMemo(() => {
    const currentSelected = visibleMails.find(mail => mail.id === selectedId)
    return currentSelected || visibleMails[0] || null
  }, [visibleMails, selectedId])

  // 메일을 클릭하면 상세 API를 호출해서 오른쪽 본문 영역에 보여줄 데이터를 가져옵니다.
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

  // 중요 표시는 백엔드 즐겨찾기 API와 연결합니다.
  const toggleImportant = async (id) => {
    const target = mails.find(mail => mail.id === id)
    if (!target || target.box === 'draft') return

    setErrorMessage('')

    try {
      const response = target.box === 'sent'
        ? await toggleSentFavorite(id)
        : await toggleInboxFavorite(id)
      const nextImportant = Boolean(getResponseData(response))

      if (currentBox === 'mail-important' && !nextImportant) {
        setMails(prev => prev.filter(mail => mail.id !== id))
        setSelectedId(prev => (prev === id ? null : prev))
        return
      }

      setMails(prev => prev.map(mail => (
        mail.id === id ? { ...mail, important: nextImportant } : mail
      )))
    } catch (error) {
      console.error('중요 메일 설정 실패', error)
      setErrorMessage('중요 메일 설정에 실패했습니다.')
    }
  }

  // 임시저장 목록에서 다시 작성할 때, 저장된 내용을 작성 폼으로 옮깁니다.
  const openDraft = (mail) => {
    setDraft({
      to: mail.recipients?.map(item => item.recipientEmpNo).filter(Boolean).join(', ') || '',
      subject: mail.subject === '(제목 없음)' ? '' : mail.subject,
      body: mail.body || '',
    })
    setDraftAttachments([])
    setRecipientQuery('')
    setRecipientOptions([])
    setIsRecipientListOpen(false)
    setRecipientErrorMessage('')
    setActiveBox('mail-compose')
  }

  // 드롭다운에서 멤버를 선택하면 실제 발송에 필요한 사번을 받는 사람 칸에 추가합니다.
  const addRecipient = (recipient) => {
    const currentRecipients = parseRecipients(draft.to)

    if (!currentRecipients.includes(recipient.empNo)) {
      setDraft(prev => ({
        ...prev,
        to: [...currentRecipients, recipient.empNo].join(', '),
      }))
    }

    setRecipientQuery('')
    setRecipientOptions([])
    setIsRecipientListOpen(false)
    setRecipientErrorMessage('')
  }

  // 파일 첨부 UI용 함수입니다. 아직 메일 전송 API에는 파일을 같이 보내지 않습니다.
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

  // 받은메일/보낸메일 삭제 API를 호출합니다. 임시저장 삭제 API는 백엔드에 없어 안내만 합니다.
  const moveToTrash = async (id) => {
    const target = mails.find(mail => mail.id === id)
    if (!target) return

    setErrorMessage('')

    try {
      if (target.box === 'draft') {
        await deleteDraftMail(id)
      } else if (target.box === 'sent') {
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

  const restoreMail = async (id) => {
    const target = mails.find(mail => mail.id === id)
    if (!target) return

    setErrorMessage('')

    try {
      if (target.box === 'sent') {
        await restoreSentMail(id)
      } else {
        await restoreInboxMail(id)
      }

      setMails(prev => prev.filter(mail => mail.id !== id))
      setSelectedId(prev => (prev === id ? null : prev))
    } catch (error) {
      console.error('메일 복원 실패', error)
      setErrorMessage('메일을 복원하지 못했습니다.')
    }
  }

  // 작성 중인 메일을 백엔드 임시저장 API로 저장합니다.
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
      setRecipientQuery('')
      setRecipientOptions([])
      setIsRecipientListOpen(false)
      setRecipientErrorMessage('')
      setActiveBox('mail-drafts')
    } catch (error) {
      console.error('메일 임시저장 실패', error)
      setErrorMessage('메일을 임시저장하지 못했습니다. 수신자 사번을 확인해주세요.')
    }
  }

  // 작성 폼 제출 시 실제 메일 발송 API를 호출합니다.
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
      setRecipientQuery('')
      setRecipientOptions([])
      setIsRecipientListOpen(false)
      setRecipientErrorMessage('')
      await loadMails()
      setActiveBox('mail-sent')
    } catch (error) {
      console.error('메일 발송 실패', error)
      setErrorMessage('메일을 발송하지 못했습니다. 수신자 사번을 확인해주세요.')
    }
  }

  // 보낸 메일은 아무도 읽지 않았을 때 백엔드에서 발송 취소할 수 있습니다.
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

  // 보낸 메일의 수신자별 읽음 여부를 가져와 상세 화면 아래에 보여줍니다.
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
            받는 사람
            <input
              className="mail-recipient-input"
              value={draft.to}
              onFocus={() => {
                const lastKeyword = parseRecipients(draft.to).at(-1) || ''

                setRecipientQuery(lastKeyword)
                setIsRecipientListOpen(true)
              }}
              onChange={(event) => {
                const nextValue = event.target.value
                const lastKeyword = parseRecipients(nextValue).at(-1) || ''

                setDraft(prev => ({ ...prev, to: nextValue }))
                setRecipientQuery(lastKeyword)
                setIsRecipientListOpen(true)
              }}
              placeholder='사번 또는 이름으로 검색하여 수신자를 추가하세요'
            />
          </label>
          {isRecipientListOpen && (
            <div className="mail-recipient-dropdown">
              {isRecipientLoading ? (
                <div className="mail-recipient-empty">검색 중입니다.</div>
              ) : recipientErrorMessage ? (
                <div className="mail-recipient-empty">{recipientErrorMessage}</div>
              ) : recipientOptions.length > 0 ? (
                recipientOptions.map(recipient => (
                  <button
                    key={recipient.empNo}
                    type="button"
                    className="mail-recipient-option"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => addRecipient(recipient)}
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
                <div className="mail-recipient-empty">표시할 멤버가 없습니다.</div>
              )}
            </div>
          )}
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
                      <button
                        onClick={() => toggleImportant(selectedMail.id)}
                        aria-label="중요 표시"
                        title={selectedMail.important ? '중요 해제' : '중요 표시'}
                      >
                        <FiStar className={selectedMail.important ? 'mail-star-active' : ''} />
                      </button>
                      {currentBox === 'mail-trash' ? (
                        <button onClick={() => restoreMail(selectedMail.id)} aria-label="복원" title="복원">
                          <FiArchive />
                        </button>
                      ) : (
                        <button onClick={() => moveToTrash(selectedMail.id)} aria-label="삭제" title="삭제">
                          <FiTrash2 />
                        </button>
                      )}
                      {selectedMail.box === 'draft' && (
                        <button onClick={() => openDraft(selectedMail)} aria-label="임시저장 이어쓰기" title="임시저장 이어쓰기">
                          <FiEdit3 />
                        </button>
                      )}
                      {selectedMail.box === 'sent' && selectedMail.status === 'SENT' && (
                        <button onClick={() => cancelSentMail(selectedMail.id)} aria-label="발송취소" title="발송취소">
                          <FiX />
                        </button>
                      )}
                      {selectedMail.box === 'sent' && (
                        <button onClick={() => loadReadStatus(selectedMail.id)} aria-label="수신확인" title="수신확인">
                          <FiArchive />
                        </button>
                      )}
                      <button aria-label="답장" title="답장" onClick={() => setActiveBox('mail-compose')}>
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
