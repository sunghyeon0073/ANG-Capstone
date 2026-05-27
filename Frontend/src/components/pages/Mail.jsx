import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  FiArrowLeft,
  FiArchive,
  FiCornerUpLeft,
  FiDownload,
  FiEdit3,
  FiFileText,
  FiMail,
  FiPaperclip,
  FiRefreshCcw,
  FiSearch,
  FiStar,
  FiTrash2,
  FiX,
} from 'react-icons/fi'
import {
  deleteInboxMail,
  deleteSentMail,
  deleteDraftMail,
  cancelMail,
  downloadMailFile,
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
  sendMailDraft,
  toggleInboxFavorite,
  toggleSentFavorite,
  updateMailDraft,
  uploadMailFile,
} from '../../api/mailApi'
import { searchUsers } from '../../api/userApi'

// 메일함 메뉴별 화면 제목과 빈 목록 안내 문구입니다.
const mailboxConfig = {
  'mail-compose': { title: '메일 작성', empty: '' },
  'mail-inbox': { title: '받은 메일함', empty: '받은 메일이 없습니다.' },
  'mail-sent': { title: '보낸 메일함', empty: '보낸 메일이 없습니다.' },
  'mail-drafts': { title: '임시보관함', empty: '임시저장된 메일이 없습니다.' },
  'mail-important': { title: '중요 메일함', empty: '중요 표시한 메일이 없습니다.' },
  'mail-trash': { title: '휴지통', empty: '휴지통에 메일이 없습니다.' },
}

// API 응답과 날짜/파일 정보를 화면에서 사용할 형태로 바꾸는 공통 함수입니다.
const getInitial = (name) => name?.charAt(0) || '?'
const getResponseData = (response) => response?.data?.data ?? response?.data ?? []
const normalizeMailboxId = (id) => (id === 'mail-draft' ? 'mail-drafts' : id)
const KOREA_TIME_ZONE = 'Asia/Seoul'
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

const parseMailDateTime = (value) => {
  if (!value) return null
  const hasTimeZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)
  const date = new Date(hasTimeZone ? value : `${value}Z`)

  return Number.isNaN(date.getTime()) ? null : date
}

const formatDateTime = (value) => {
  const date = parseMailDateTime(value)
  if (!date) return { date: '-', time: '-' }

  return {
    date: date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'numeric', day: 'numeric', timeZone: KOREA_TIME_ZONE }),
    time: date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', timeZone: KOREA_TIME_ZONE }),
  }
}

const sortMailsLatestFirst = (mails) => [...mails].sort((first, second) => (
  (second.timestamp || 0) - (first.timestamp || 0)
))

const getReadStatusLabel = (mail) => {
  if (mail.box === 'inbox') return mail.unread ? '안읽음' : '읽음'
  if (mail.box !== 'sent' || !mail.readStatuses) return ''
  if (mail.readStatuses.length === 0) return '안읽음'

  const readCount = mail.readStatuses.filter(item => item.read).length
  if (readCount === 0) return '안읽음'
  if (readCount === mail.readStatuses.length) return '읽음'
  return `일부 읽음 (${readCount}/${mail.readStatuses.length})`
}

const mapRecipientSelection = (recipient) => ({
  empNo: recipient.empNo || recipient.recipientEmpNo,
  name: recipient.name || recipient.recipientName || recipient.empNo || recipient.recipientEmpNo,
})

// 목록 API 응답을 왼쪽 메일 목록에서 표시할 기본 데이터로 변환합니다.
const mapSummary = (mail, box, importantIds = []) => {
  const dateValue = mail.sentAt || mail.createdAt
  const { date, time } = formatDateTime(dateValue)
  const id = mail.mailId
  const isFavorite = mail.favorite ?? mail.isFavorite
  const isRead = mail.read ?? mail.isRead

  return {
    id,
    box,
    from: mail.senderName || mail.senderEmpNo || '알 수 없음',
    to: ['sent', 'draft'].includes(box) ? '수신자 불러오는 중' : '',
    subject: mail.title || '(제목 없음)',
    preview: mail.status === 'CANCELLED' ? '발송 취소된 메일입니다.' : (mail.body || ''),
    body: '',
    time,
    date,
    timestamp: parseMailDateTime(dateValue)?.getTime() || 0,
    status: mail.status,
    important: Boolean(isFavorite) || importantIds.includes(String(id)),
    unread: box === 'inbox' ? !isRead : false,
    attachments: [],
    recipients: [],
    readStatuses: null,
    isDetailLoaded: false,
  }
}

// 상세 응답의 본문, 수신자, 첨부파일을 선택된 메일 데이터에 합칩니다.
const mergeDetail = (mail, detail) => {
  const dateValue = detail.sentAt || detail.createdAt
  const { date, time } = formatDateTime(dateValue)
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
    timestamp: parseMailDateTime(dateValue)?.getTime() || mail.timestamp,
    attachments: detail.attachments || [],
    recipients,
    unread: false,
    isDetailLoaded: true,
  }
}

export default function Mail({ currentSubPage = 'mail-inbox', user, contactRequest, onContactRequestHandled, onSubPageChange }) {
  const organizationContact = contactRequest?.channel === 'mail' ? contactRequest.contact : null
  const organizationRecipient = organizationContact?.empNo || ''
  // 현재 열린 메일함과 오른쪽 상세 화면에서 선택된 메일을 관리합니다.
  const [activeBox, setActiveBox] = useState(normalizeMailboxId(currentSubPage || 'mail-inbox'))
  const [viewMode, setViewMode] = useState('list')
  const [mails, setMails] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [query, setQuery] = useState('')
  // 작성 폼의 제목, 내용, 수신자 정보를 관리합니다.
  const [draft, setDraft] = useState({ subject: '', body: '' })
  const [selectedRecipients, setSelectedRecipients] = useState(() => (
    organizationRecipient ? [mapRecipientSelection(organizationContact)] : []
  ))
  // 새 첨부는 저장/발송 시 업로드하고, 기존 임시저장 첨부는 그대로 유지합니다.
  const [draftAttachments, setDraftAttachments] = useState([])
  const [savedDraftAttachments, setSavedDraftAttachments] = useState([])
  const [draftMailId, setDraftMailId] = useState(null)
  // 수신자 검색창과 검색 결과 드롭다운 상태입니다.
  const [recipientQuery, setRecipientQuery] = useState('')
  const [recipientOptions, setRecipientOptions] = useState([])
  const [isRecipientListOpen, setIsRecipientListOpen] = useState(false)
  const [isRecipientLoading, setIsRecipientLoading] = useState(false)
  const [recipientErrorMessage, setRecipientErrorMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [attachmentMessage, setAttachmentMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const currentBox = activeBox
  const config = mailboxConfig[currentBox] || mailboxConfig['mail-inbox']
  const isComposePage = currentBox === 'mail-compose'
  const currentEmpNo = user?.empNo || getStoredUserEmpNo()
  const availableRecipientOptions = recipientOptions.filter(option => (
    option.empNo !== currentEmpNo
    &&
    !selectedRecipients.some(recipient => recipient.empNo === option.empNo)
  ))

  // 사이드바에서 선택한 메일 메뉴를 현재 화면에 반영합니다.
  useEffect(() => {
    setActiveBox(normalizeMailboxId(currentSubPage || 'mail-inbox'))
    setViewMode('list')
    setSelectedId(null)
  }, [currentSubPage])

  useEffect(() => {
    if (!organizationRecipient) return undefined

    const timerId = window.setTimeout(() => onContactRequestHandled?.(), 0)
    return () => window.clearTimeout(timerId)
  }, [organizationRecipient, onContactRequestHandled])

  // 이름 또는 사번으로 검색한 사용자를 받는 사람 후보로 표시합니다.
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
      if (event.target.closest('.mail-recipient-input-shell, .mail-recipient-dropdown')) return
      setIsRecipientListOpen(false)
    }

    document.addEventListener('mousedown', closeRecipientList)

    return () => {
      document.removeEventListener('mousedown', closeRecipientList)
    }
  }, [isRecipientListOpen])

  // 선택한 메일함에 맞는 목록을 조회하고 첫 메일을 기본 선택합니다.
  const loadMails = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage('')

    try {
      // 작성 화면에서는 메일 목록을 표시하지 않습니다.
      if (currentBox === 'mail-compose') {
        setMails([])
        setSelectedId(null)
        return
      }

      // 받은/보낸/임시/중요/휴지통 메뉴별 API를 선택합니다.
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
      const filtered = await Promise.all(loaded.map(async mail => {
        let enrichedMail = mail

        // 받은 메일 상세 조회는 읽음 처리되므로, 이미 읽은 메일만 목록 미리보기를 채웁니다.
        const canLoadPreviewWithoutChangingReadState = ['sent', 'draft'].includes(mail.box)
          || (mail.box === 'inbox' && !mail.unread)

        if (canLoadPreviewWithoutChangingReadState) {
          try {
            const response = await getMailDetail(mail.id)
            enrichedMail = mergeDetail(mail, getResponseData(response))
          } catch (error) {
            console.error('수신자 정보 로드 실패', error)
          }
        }

        if (mail.box !== 'sent') return enrichedMail

        try {
          const response = await getMailReadStatus(mail.id)
          return { ...enrichedMail, readStatuses: getResponseData(response) }
        } catch (error) {
          console.error('수신 확인 로드 실패', error)
          return enrichedMail
        }
      }))

      const sortedMails = sortMailsLatestFirst(filtered)
      setMails(sortedMails)
      setSelectedId(null)
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

  // 입력한 검색어로 현재 목록의 제목, 보낸 사람, 본문을 필터링합니다.
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

  // 선택된 메일이 없으면 목록의 첫 메일을 상세 화면에 보여줍니다.
  const selectedMail = useMemo(() => {
    return visibleMails.find(mail => mail.id === selectedId) || null
  }, [visibleMails, selectedId])

  // 메일 선택 시 아직 가져오지 않은 본문과 첨부파일 상세를 조회합니다.
  const selectMail = async (id, refreshDetail = false) => {
    setSelectedId(id)
    setErrorMessage('')

    const target = mails.find(mail => mail.id === id)
    if (!target || (target.isDetailLoaded && !refreshDetail)) return

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

  const openMailDetail = (id) => {
    setViewMode('detail')
    selectMail(id, true)
  }

  const returnToMailList = () => {
    setViewMode('list')
    setSelectedId(null)
    setErrorMessage('')
  }

  useEffect(() => {
    if (viewMode === 'detail' && selectedMail && !selectedMail.isDetailLoaded) {
      selectMail(selectedMail.id)
    }
  }, [viewMode, selectedMail?.id, selectedMail?.isDetailLoaded])

  // 별표 클릭 시 받은/보낸 메일에 맞는 중요 메일 상태를 저장합니다.
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
        setViewMode('list')
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

  // 임시저장 메일을 이어 쓸 때 기존 내용과 첨부파일을 작성 화면에 불러옵니다.
  const openDraft = (mail) => {
    setDraft({
      subject: mail.subject === '(제목 없음)' ? '' : mail.subject,
      body: mail.body || '',
    })
    setSelectedRecipients((mail.recipients || []).map(mapRecipientSelection))
    setDraftAttachments([])
    setSavedDraftAttachments(mail.attachments || [])
    setDraftMailId(mail.id)
    setRecipientQuery('')
    setRecipientOptions([])
    setIsRecipientListOpen(false)
    setRecipientErrorMessage('')
    setActiveBox('mail-compose')
    setViewMode('list')
    onSubPageChange?.('mail-compose')
  }

  // 선택한 수신자는 칩으로 표시하고, 발송 요청에는 사번을 전달합니다.
  const addRecipient = (recipient) => {
    setSelectedRecipients(prev => (
      prev.some(item => item.empNo === recipient.empNo)
        ? prev
        : [...prev, mapRecipientSelection(recipient)]
    ))

    setRecipientQuery('')
    setIsRecipientListOpen(true)
    setRecipientErrorMessage('')
  }

  const removeRecipient = (empNo) => {
    setSelectedRecipients(prev => prev.filter(recipient => recipient.empNo !== empNo))
  }

  // 사용자가 선택한 새 파일을 중복 없이 작성 중 첨부 목록에 추가합니다.
  const handleAttachmentSelect = (event) => {
    const selectedFiles = Array.from(event.target.files || [])
    if (selectedFiles.length === 0) return

    setAttachmentMessage('')
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

  // 메일이 먼저 저장되어 생성된 mailId에 새 첨부파일을 연결합니다.
  const uploadAttachments = async (mailId) => {
    if (draftAttachments.length === 0) {
      setAttachmentMessage('')
      return true
    }

    const results = await Promise.allSettled(
      draftAttachments.map(file => uploadMailFile(mailId, file))
    )
    const failedUploads = results.filter(result => result.status === 'rejected')

    failedUploads.forEach(result => {
      console.error('첨부 파일 업로드 실패', result.reason?.response?.data || result.reason)
    })

    if (failedUploads.length > 0) {
      const serverMessage = failedUploads[0].reason?.response?.data?.message
      setAttachmentMessage(
        serverMessage
          ? `첨부 파일 업로드 실패: ${serverMessage}`
          : '메일은 저장되었지만 첨부 파일 업로드에 실패했습니다. 개발자 도구의 Network에서 /mail/files 응답을 확인해주세요.'
      )
    } else {
      setAttachmentMessage('')
    }

    return failedUploads.length === 0
  }

  // 첨부파일을 blob으로 받아 브라우저 다운로드를 시작합니다.
  const downloadAttachment = async (file) => {
    setErrorMessage('')

    try {
      const response = await downloadMailFile(file.attachmentId)
      const url = window.URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = url
      link.download = file.fileName || 'attachment'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('첨부 파일 다운로드 실패', error)
      setErrorMessage('첨부 파일을 다운로드하지 못했습니다.')
    }
  }

  // 메일 종류에 맞는 삭제 API를 호출해 목록에서 제거합니다.
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
      setViewMode('list')
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
      setViewMode('list')
    } catch (error) {
      console.error('메일 복원 실패', error)
      setErrorMessage('메일을 복원하지 못했습니다.')
    }
  }

  // 새 작성은 임시저장하고, 이어 쓰는 임시메일은 기존 mailId로 수정 저장합니다.
  const saveDraft = async () => {
    const recipientEmpNos = selectedRecipients.map(recipient => recipient.empNo)

    if (!draft.subject.trim() && !draft.body.trim() && recipientEmpNos.length === 0 && draftAttachments.length === 0) {
      setErrorMessage('임시저장할 내용을 입력해주세요.')
      return
    }

    setErrorMessage('')
    setIsSubmitting(true)

    try {
      const payload = {
        title: draft.subject.trim(),
        body: draft.body,
        recipientEmpNos,
      }
      const response = draftMailId
        ? await updateMailDraft(draftMailId, payload)
        : await saveMailDraft(payload)
      const mailId = getResponseData(response)
      await uploadAttachments(mailId)

      setDraft({ subject: '', body: '' })
      setSelectedRecipients([])
      setDraftAttachments([])
      setSavedDraftAttachments([])
      setDraftMailId(null)
      setRecipientQuery('')
      setRecipientOptions([])
      setIsRecipientListOpen(false)
      setRecipientErrorMessage('')
      setActiveBox('mail-drafts')
      setViewMode('list')
      onSubPageChange?.('mail-drafts')
    } catch (error) {
      console.error('메일 임시저장 실패', error)
      setErrorMessage('메일을 임시저장하지 못했습니다. 수신자 사번을 확인해주세요.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 작성 화면에서 보낸 메일을 생성한 뒤, 응답받은 mailId에 새 첨부파일을 연결합니다.
  const submitDraft = async (event) => {
    event.preventDefault()

    const recipientEmpNos = selectedRecipients.map(recipient => recipient.empNo)
    if (recipientEmpNos.length === 0 || !draft.subject.trim()) {
      setErrorMessage('받는 사람과 제목을 입력해주세요.')
      return
    }

    setErrorMessage('')
    setIsSubmitting(true)

    try {
      const payload = {
        title: draft.subject.trim(),
        body: draft.body,
        recipientEmpNos,
      }
      let mailId

      if (draftMailId) {
        const response = await updateMailDraft(draftMailId, payload)
        mailId = getResponseData(response)
      } else {
        const response = await sendMail(payload)
        mailId = getResponseData(response)
      }

      await uploadAttachments(mailId)
      if (draftMailId) {
        await sendMailDraft(mailId)
      }

      setDraft({ subject: '', body: '' })
      setSelectedRecipients([])
      setDraftAttachments([])
      setSavedDraftAttachments([])
      setDraftMailId(null)
      setRecipientQuery('')
      setRecipientOptions([])
      setIsRecipientListOpen(false)
      setRecipientErrorMessage('')
      await loadMails()
      setActiveBox('mail-sent')
      setViewMode('list')
      onSubPageChange?.('mail-sent')
    } catch (error) {
      console.error('메일 발송 실패', error)
      setErrorMessage('메일을 발송하지 못했습니다. 수신자 사번을 확인해주세요.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 아직 읽은 수신자가 없는 보낸 메일은 발송을 취소할 수 있습니다.
  const cancelSentMail = async (id) => {
    setErrorMessage('')

    try {
      await cancelMail(id)
      await loadMails()
      setViewMode('list')
    } catch (error) {
      console.error('발송 취소 실패', error)
      setErrorMessage('메일을 발송 취소하지 못했습니다. 이미 읽은 수신자가 있으면 취소할 수 없습니다.')
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
      {attachmentMessage && <div className="mail-error">{attachmentMessage}</div>}

      {isComposePage ? (
        <form className="mail-compose-panel" onSubmit={submitDraft}>
          <label className="mail-compose-row mail-recipient-row">
            받는 사람
            <div className="mail-recipient-input-shell">
              {selectedRecipients.map(recipient => (
                <span className="mail-recipient-chip" key={recipient.empNo}>
                  {recipient.name}
                  <button
                    type="button"
                    onClick={() => removeRecipient(recipient.empNo)}
                    aria-label={`${recipient.name} 수신자 제거`}
                  >
                    <FiX />
                  </button>
                </span>
              ))}
              <input
                className="mail-recipient-input"
                value={recipientQuery}
                onFocus={() => setIsRecipientListOpen(true)}
                onChange={(event) => {
                  setRecipientQuery(event.target.value)
                  setIsRecipientListOpen(true)
                }}
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
                  <div className="mail-recipient-empty">추가할 멤버가 없습니다.</div>
                )}
              </div>
            )}
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
                    <button type="button" onClick={() => downloadAttachment(file)} aria-label="첨부 다운로드">
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
                    <button type="button" onClick={() => removeAttachment(index)} aria-label="첨부 제거">
                      <FiX />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="mail-compose-footer">
            <button type="button" className="btn btn-secondary" onClick={saveDraft} disabled={isSubmitting}>
              {isSubmitting ? '처리 중...' : '임시저장'}
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? '처리 중...' : '보내기'}
            </button>
          </div>
        </form>
      ) : (
        <>
          {viewMode === 'list' && (
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
          )}

          <div className={`mail-shell mail-${viewMode}-view`}>
            {viewMode === 'list' && (
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
                    <div
                      key={`${mail.box}-${mail.id}`}
                      className={`mail-list-item ${mail.unread ? 'unread' : ''}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => openMailDetail(mail.id)}
                      onKeyDown={(event) => {
                        if (event.target !== event.currentTarget) return
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          openMailDetail(mail.id)
                        }
                      }}
                    >
                      <button
                        type="button"
                        className={`mail-list-star ${mail.important ? 'active' : ''}`}
                        onClick={(event) => {
                          event.stopPropagation()
                          toggleImportant(mail.id)
                        }}
                        disabled={mail.box === 'draft'}
                        aria-label={mail.important ? '중요 표시 해제' : '중요 표시'}
                        title={mail.important ? '중요 표시 해제' : '중요 표시'}
                      >
                        <FiStar />
                      </button>
                      {getReadStatusLabel(mail) ? (
                        <span
                          className={`mail-list-read ${getReadStatusLabel(mail).includes('안읽음') ? 'unread' : 'read'}`}
                          aria-label={getReadStatusLabel(mail)}
                          title={getReadStatusLabel(mail)}
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
                  ))}
                </div>
              )}
              </section>
            )}

            {viewMode === 'detail' && (
              <section className="mail-detail-panel">
                <button type="button" className="mail-back-btn" onClick={returnToMailList}>
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
                      <button
                        aria-label="답장"
                        title="답장"
                        onClick={() => {
                          setActiveBox('mail-compose')
                          setViewMode('list')
                          onSubPageChange?.('mail-compose')
                        }}
                      >
                        <FiCornerUpLeft />
                      </button>
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
                          <button type="button" onClick={() => downloadAttachment(file)}>
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
            )}
          </div>
        </>
      )}

    </div>
  )
}
