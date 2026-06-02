import { useCallback, useEffect, useMemo, useState } from 'react'
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
  permanentDeleteInboxTrashMail,
  permanentDeleteSentTrashMail,
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
import MailCompose from '../mail/MailCompose'
import MailDetail from '../mail/MailDetail'
import MailList from '../mail/MailList'
import {
  formatFileSize,
  getInitial,
  getMailKey,
  getReadStatusLabel,
  getResponseData,
  getStoredUserEmpNo,
  mailboxConfig,
  mapRecipientSelection,
  mapSummary,
  mergeDetail,
  normalizeMailboxId,
  sortMailsLatestFirst,
} from '../mail/mailUtils'

const MAIL_PAGE_SIZE = 15

const emptyPageInfo = {
  page: 0,
  size: MAIL_PAGE_SIZE,
  totalElements: 0,
  totalPages: 1,
}

const toFiniteNumber = (value, fallback) => {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : fallback
}

const getMailTimeValue = (mail) => {
  const dateValue = mail?.sentAt || mail?.createdAt || mail?.updatedAt
  if (!dateValue) return 0

  const hasTimeZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(dateValue)
  const date = new Date(hasTimeZone ? dateValue : `${dateValue}Z`)
  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}

const getObjectValue = (value, keys) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return keys.find(key => value[key] !== undefined)
}

const pickArrayValue = (value) => {
  if (Array.isArray(value)) return value
  if (!value || typeof value !== 'object') return []

  const arrayKey = getObjectValue(value, ['content', 'items', 'mails', 'mailList', 'list', 'rows', 'records', 'result', 'results', 'data'])
  const candidate = arrayKey ? value[arrayKey] : undefined

  if (Array.isArray(candidate)) return candidate
  if (candidate && typeof candidate === 'object') return pickArrayValue(candidate)

  return []
}

const pickPageValue = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value

  const hasPageShape = ['content', 'items', 'mails', 'mailList', 'list', 'rows', 'records', 'totalElements', 'totalCount', 'total', 'totalPages']
    .some(key => value[key] !== undefined)

  if (hasPageShape) return value

  const nestedKey = getObjectValue(value, ['data', 'result', 'results', 'page', 'mailPage', 'mailList', 'mails'])
  return nestedKey ? pickPageValue(value[nestedKey]) : value
}

const normalizePageResult = (response, fallbackPage = 0, fallbackSize = MAIL_PAGE_SIZE) => {
  const data = pickPageValue(getResponseData(response))
  if (Array.isArray(data)) {
    const size = fallbackSize || MAIL_PAGE_SIZE
    const sortedData = [...data].sort((first, second) => getMailTimeValue(second) - getMailTimeValue(first))
    const totalElements = sortedData.length
    const totalPages = Math.max(Math.ceil(totalElements / size), 1)
    const startIndex = fallbackPage * size
    const items = totalElements > size ? sortedData.slice(startIndex, startIndex + size) : sortedData

    return {
      items,
      pageInfo: {
        ...emptyPageInfo,
        page: fallbackPage,
        size,
        totalElements,
        totalPages,
      },
    }
  }

  const pageData = data && typeof data === 'object' ? data : {}
  const items = pickArrayValue(pageData)
  const page = toFiniteNumber(
    pageData.number ?? pageData.pageNumber ?? pageData.currentPage ?? pageData.page?.number ?? pageData.page?.pageNumber ?? pageData.page,
    fallbackPage
  )
  const size = toFiniteNumber(
    pageData.size ?? pageData.pageSize ?? pageData.pageable?.pageSize ?? pageData.page?.size ?? pageData.page?.pageSize,
    fallbackSize
  )
  const totalElements = toFiniteNumber(
    pageData.totalElements ?? pageData.totalCount ?? pageData.total ?? pageData.page?.totalElements ?? pageData.page?.totalCount,
    items.length
  )
  const totalPages = Math.max(
    toFiniteNumber(pageData.totalPages ?? pageData.page?.totalPages, Math.ceil(totalElements / (size || MAIL_PAGE_SIZE))),
    1
  )

  return {
    items,
    pageInfo: {
      page,
      size,
      totalElements,
      totalPages,
    },
  }
}

export default function Mail({ currentSubPage = 'mail-inbox', user, contactRequest, onContactRequestHandled, onSubPageChange }) {
  const organizationContact = contactRequest?.channel === 'mail' ? contactRequest.contact : null
  const organizationRecipient = organizationContact?.empNo || ''

  // 화면 상태: 현재 메일함, 목록/상세 모드, 선택 메일, 검색어를 관리합니다.
  const [activeBox, setActiveBox] = useState(normalizeMailboxId(currentSubPage || 'mail-inbox'))
  const [viewMode, setViewMode] = useState('list')
  const [mails, setMails] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [selectedMailKeys, setSelectedMailKeys] = useState([])
  const [query, setQuery] = useState('')
  const [mailPage, setMailPage] = useState(0)
  const [pageInfo, setPageInfo] = useState(emptyPageInfo)

  // 작성 폼 상태: 제목, 본문, 선택된 수신자를 관리합니다.
  const [draft, setDraft] = useState({ subject: '', body: '' })
  const [selectedRecipients, setSelectedRecipients] = useState(() => (
    organizationRecipient ? [mapRecipientSelection(organizationContact)] : []
  ))

  // 첨부 상태: 새로 선택한 파일과 이미 서버에 저장된 임시메일 첨부를 나눠 관리합니다.
  const [draftAttachments, setDraftAttachments] = useState([])
  const [savedDraftAttachments, setSavedDraftAttachments] = useState([])
  const [draftMailId, setDraftMailId] = useState(null)

  // 수신자 검색 상태: 검색어, 검색 결과, 드롭다운 열림 여부, 로딩/에러를 관리합니다.
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
  const selectedMailKeySet = useMemo(() => new Set(selectedMailKeys), [selectedMailKeys])

  const changeMailPage = (nextPage) => {
    const maxPage = Math.max((pageInfo.totalPages || 1) - 1, 0)
    setMailPage(Math.min(Math.max(nextPage, 0), maxPage))
    setSelectedId(null)
    setSelectedMailKeys([])
  }

  // 사이드바 메뉴가 바뀌면 현재 메일함을 바꾸고 목록 화면으로 초기화합니다.
  useEffect(() => {
    setActiveBox(normalizeMailboxId(currentSubPage || 'mail-inbox'))
    setViewMode('list')
    setSelectedId(null)
    setSelectedMailKeys([])
    setMailPage(0)
    setPageInfo(emptyPageInfo)
  }, [currentSubPage])

  // 조직도에서 "메일 보내기"로 넘어온 수신자가 있으면 한 번만 작성 폼에 반영합니다.
  useEffect(() => {
    if (!organizationRecipient) return undefined

    const timerId = window.setTimeout(() => onContactRequestHandled?.(), 0)
    return () => window.clearTimeout(timerId)
  }, [organizationRecipient, onContactRequestHandled])

  // 수신자 검색: 이름 또는 사번으로 멤버를 조회해 드롭다운 후보에 표시합니다.
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

  // 작성 화면에서 수신자 드롭다운이 열려 있을 때 검색어 변경을 약간 지연해 API 호출합니다.
  useEffect(() => {
    if (!isComposePage || !isRecipientListOpen) return

    const timer = window.setTimeout(() => {
      loadRecipientOptions(recipientQuery)
    }, 200)

    return () => window.clearTimeout(timer)
  }, [isComposePage, isRecipientListOpen, recipientQuery, loadRecipientOptions])

  // 수신자 드롭다운 바깥을 클릭하면 드롭다운을 닫습니다.
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

  // 메일 목록 조회: 현재 메일함에 맞는 API를 호출하고 최신순으로 정렬합니다.
  const loadMails = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage('')

    try {
      // 작성 화면에서는 메일 목록을 표시하지 않습니다.
      if (currentBox === 'mail-compose') {
        setMails([])
        setSelectedId(null)
        setPageInfo(emptyPageInfo)
        return
      }

      // 받은/보낸/임시/중요/휴지통마다 사용하는 API가 달라서 여기서 분기합니다.
      const pageInfoParts = []
      const mapPageItems = (response, mapper) => {
        const page = normalizePageResult(response, mailPage, MAIL_PAGE_SIZE)
        pageInfoParts.push(page.pageInfo)
        return page.items.map(mapper)
      }

      const loaders = currentBox === 'mail-sent'
        ? [getSentMails(mailPage, MAIL_PAGE_SIZE).then(res => mapPageItems(res, mail => mapSummary(mail, 'sent')))]
        : currentBox === 'mail-drafts'
          ? [getDraftMails(mailPage, MAIL_PAGE_SIZE).then(res => mapPageItems(res, mail => mapSummary(mail, 'draft')))]
        : currentBox === 'mail-important'
          ? [getFavoriteMails(mailPage, MAIL_PAGE_SIZE).then(res => mapPageItems(res, mail => {
              const box = currentEmpNo && mail.senderEmpNo === currentEmpNo ? 'sent' : 'inbox'
              return mapSummary(mail, box, [String(mail.mailId)])
            }))]
        : currentBox === 'mail-trash'
          ? [
              getInboxTrashMails(mailPage, MAIL_PAGE_SIZE).then(res => mapPageItems(res, mail => mapSummary(mail, 'inbox'))),
              getSentTrashMails(mailPage, MAIL_PAGE_SIZE).then(res => mapPageItems(res, mail => mapSummary(mail, 'sent'))),
            ]
          : [getInboxMails(mailPage, MAIL_PAGE_SIZE).then(res => mapPageItems(res, mail => mapSummary(mail, 'inbox')))]

      const loaded = (await Promise.all(loaders)).flat()
      const nextPageInfo = pageInfoParts.length > 1
        ? pageInfoParts.reduce((acc, page) => ({
            page: mailPage,
            size: MAIL_PAGE_SIZE,
            totalElements: acc.totalElements + page.totalElements,
            totalPages: Math.max(acc.totalPages, page.totalPages),
          }), { ...emptyPageInfo, page: mailPage, totalElements: 0 })
        : (pageInfoParts[0] || emptyPageInfo)
      const filtered = await Promise.all(loaded.map(async mail => {
        let enrichedMail = mail

        // 받은 메일 상세 조회는 읽음 처리되므로, 안읽은 받은메일은 목록 미리보기를 강제로 불러오지 않습니다.
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
      setPageInfo(nextPageInfo)
      setSelectedId(null)
      setSelectedMailKeys([])
    } catch (error) {
      console.error('메일 목록 로드 실패', error)
      setMails([])
      setPageInfo(emptyPageInfo)
      setSelectedId(null)
      setSelectedMailKeys([])
      setErrorMessage('메일 목록을 불러오지 못했습니다.')
    } finally {
      setIsLoading(false)
    }
  }, [currentBox, currentEmpNo, mailPage])

  useEffect(() => {
    loadMails()
  }, [loadMails])

  // 목록 검색: 제목, 보낸 사람, 받는 사람, 미리보기, 본문을 기준으로 필터링합니다.
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

  const selectedMails = useMemo(() => (
    visibleMails.filter(mail => selectedMailKeySet.has(getMailKey(mail)))
  ), [visibleMails, selectedMailKeySet])
  const hasSelectedMails = selectedMails.length > 0
  const canBulkMoveToTrash = hasSelectedMails && currentBox !== 'mail-trash'
  const canBulkToggleImportant = selectedMails.some(mail => mail.box !== 'draft' && currentBox !== 'mail-trash')
  const canBulkCancelSent = selectedMails.some(mail => mail.box === 'sent' && mail.status === 'SENT' && currentBox !== 'mail-trash')
  const canBulkRestore = hasSelectedMails && currentBox === 'mail-trash'
  const canBulkPermanentDelete = hasSelectedMails && currentBox === 'mail-trash'

  // 현재 선택된 메일을 계산합니다. 선택된 메일이 없으면 상세 화면에서 안내만 보여줍니다.
  const selectedMail = useMemo(() => {
    return visibleMails.find(mail => mail.id === selectedId) || null
  }, [visibleMails, selectedId])

  const toggleMailSelection = (event, mail) => {
    event.stopPropagation()
    const mailKey = getMailKey(mail)

    setSelectedMailKeys(prev => (
      event.target.checked
        ? [...new Set([...prev, mailKey])]
        : prev.filter(key => key !== mailKey)
    ))
  }

  const removeSelectedKeys = (keysToRemove) => {
    const removeSet = new Set(keysToRemove)
    setSelectedMailKeys(prev => prev.filter(key => !removeSet.has(key)))
  }

  // 메일 상세 조회: 목록에는 없는 본문, 수신자, 첨부파일 정보를 필요할 때 불러옵니다.
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

  // 중요 표시: 받은메일과 보낸메일이 서로 다른 API를 쓰므로 메일 종류에 따라 분기합니다.
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

  // 임시메일 이어쓰기: 기존 제목/본문/수신자/첨부를 작성 화면에 다시 채웁니다.
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

  // 수신자 선택/삭제: 화면에는 이름 칩을 보여주고, 요청에는 empNo만 전달합니다.
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

  // 파일 선택: 브라우저에서 고른 새 파일을 중복 없이 작성 중 첨부 목록에 추가합니다.
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

  // 파일 업로드: 백엔드는 mailId가 있어야 파일을 연결하므로 저장된 메일 ID에 새 파일을 업로드합니다.
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

  // 파일 다운로드: attachmentId로 파일 blob을 받아 브라우저 다운로드를 시작합니다.
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

  // 삭제 처리: 메일 종류에 맞는 삭제 API를 호출하고 목록에서 제거합니다.
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

  // 휴지통 복원: 받은메일/보낸메일 휴지통 API가 달라서 box 기준으로 분기합니다.
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

  // 휴지통 완전삭제: 복원할 수 없는 삭제 API를 호출합니다.
  const permanentlyDeleteMail = async (id) => {
    const target = mails.find(mail => mail.id === id)
    if (!target || currentBox !== 'mail-trash') return
    if (!window.confirm('이 메일을 완전히 삭제하시겠습니까? 삭제 후에는 복원할 수 없습니다.')) return

    setErrorMessage('')

    try {
      if (target.box === 'sent') {
        await permanentDeleteSentTrashMail(id)
      } else {
        await permanentDeleteInboxTrashMail(id)
      }

      setMails(prev => prev.filter(mail => mail.id !== id))
      setSelectedId(null)
      setViewMode('list')
    } catch (error) {
      console.error('메일 완전 삭제 실패', error)
      setErrorMessage('메일을 완전히 삭제하지 못했습니다.')
    }
  }

  // 체크박스로 선택한 메일들을 현재 보관함에 맞는 일괄 액션으로 처리합니다.
  const moveSelectedToTrash = async () => {
    const targets = currentBox !== 'mail-trash' ? selectedMails : []
    if (targets.length === 0) return

    setErrorMessage('')

    try {
      await Promise.all(targets.map(mail => {
        if (mail.box === 'draft') return deleteDraftMail(mail.id)
        if (mail.box === 'sent') return deleteSentMail(mail.id)
        return deleteInboxMail(mail.id)
      }))

      const removedKeys = targets.map(getMailKey)
      setMails(prev => prev.filter(mail => !removedKeys.includes(getMailKey(mail))))
      removeSelectedKeys(removedKeys)
      setSelectedId(prev => (targets.some(mail => mail.id === prev) ? null : prev))
    } catch (error) {
      console.error('선택 메일 삭제 실패', error)
      setErrorMessage('선택한 메일을 삭제하지 못했습니다.')
    }
  }

  const toggleSelectedImportant = async () => {
    const targets = selectedMails.filter(mail => mail.box !== 'draft' && currentBox !== 'mail-trash')
    if (targets.length === 0) return

    setErrorMessage('')

    try {
      const results = await Promise.all(targets.map(async mail => {
        const response = mail.box === 'sent'
          ? await toggleSentFavorite(mail.id)
          : await toggleInboxFavorite(mail.id)

        return [getMailKey(mail), Boolean(getResponseData(response))]
      }))
      const nextImportantByKey = new Map(results)

      setMails(prev => {
        const updated = prev.map(mail => (
          nextImportantByKey.has(getMailKey(mail))
            ? { ...mail, important: nextImportantByKey.get(getMailKey(mail)) }
            : mail
        ))

        return currentBox === 'mail-important'
          ? updated.filter(mail => !nextImportantByKey.has(getMailKey(mail)) || mail.important)
          : updated
      })
      removeSelectedKeys(targets.map(getMailKey))
    } catch (error) {
      console.error('선택 메일 중요 표시 실패', error)
      setErrorMessage('선택한 메일의 중요 표시를 변경하지 못했습니다.')
    }
  }

  const cancelSelectedSentMails = async () => {
    const targets = selectedMails.filter(mail => mail.box === 'sent' && mail.status === 'SENT' && currentBox !== 'mail-trash')
    if (targets.length === 0) return

    setErrorMessage('')

    try {
      await Promise.all(targets.map(mail => cancelMail(mail.id)))
      setSelectedMailKeys([])
      await loadMails()
    } catch (error) {
      console.error('선택 메일 발송 취소 실패', error)
      setErrorMessage('선택한 메일을 발송 취소하지 못했습니다. 이미 읽은 수신자가 있으면 취소할 수 없습니다.')
    }
  }

  const restoreSelectedMails = async () => {
    const targets = currentBox === 'mail-trash' ? selectedMails : []
    if (targets.length === 0) return

    setErrorMessage('')

    try {
      await Promise.all(targets.map(mail => (
        mail.box === 'sent' ? restoreSentMail(mail.id) : restoreInboxMail(mail.id)
      )))

      const restoredKeys = targets.map(getMailKey)
      setMails(prev => prev.filter(mail => !restoredKeys.includes(getMailKey(mail))))
      removeSelectedKeys(restoredKeys)
      setSelectedId(prev => (targets.some(mail => mail.id === prev) ? null : prev))
    } catch (error) {
      console.error('선택 메일 복원 실패', error)
      setErrorMessage('선택한 메일을 복원하지 못했습니다.')
    }
  }

  const permanentlyDeleteSelectedMails = async () => {
    const targets = currentBox === 'mail-trash' ? selectedMails : []
    if (targets.length === 0) return
    if (!window.confirm('선택한 메일을 완전히 삭제하시겠습니까? 삭제 후에는 복원할 수 없습니다.')) return

    setErrorMessage('')

    try {
      await Promise.all(targets.map(mail => (
        mail.box === 'sent'
          ? permanentDeleteSentTrashMail(mail.id)
          : permanentDeleteInboxTrashMail(mail.id)
      )))

      const removedKeys = targets.map(getMailKey)
      setMails(prev => prev.filter(mail => !removedKeys.includes(getMailKey(mail))))
      removeSelectedKeys(removedKeys)
      setSelectedId(prev => (targets.some(mail => mail.id === prev) ? null : prev))
    } catch (error) {
      console.error('선택 메일 완전 삭제 실패', error)
      setErrorMessage('선택한 메일을 완전히 삭제하지 못했습니다.')
    }
  }

  // 임시저장: 새 메일은 draft로 만들고, 기존 임시메일은 같은 mailId로 수정 저장합니다.
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

  // 보내기: 첨부가 없으면 바로 발송하고, 첨부가 있으면 draft 생성 -> 파일 업로드 -> 발송 순서로 처리합니다.
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
      } else if (draftAttachments.length > 0) {
        const response = await saveMailDraft(payload)
        mailId = getResponseData(response)
        setDraftMailId(mailId)
      } else {
        const response = await sendMail(payload)
        mailId = getResponseData(response)
      }

      const shouldSendSavedDraft = Boolean(draftMailId) || draftAttachments.length > 0
      const isUploadSuccessful = await uploadAttachments(mailId)

      if (!isUploadSuccessful) return

      if (shouldSendSavedDraft) {
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

  // 발송 취소: 아직 읽은 수신자가 없는 보낸 메일만 취소할 수 있습니다.
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

  // 임시보관함 바로 보내기: 저장된 draft를 수정 없이 발송합니다.
  const sendSavedDraft = async (id) => {
    setErrorMessage('')
    setIsSubmitting(true)

    try {
      await sendMailDraft(id)
      await loadMails()
      setSelectedId(null)
      setActiveBox('mail-sent')
      setViewMode('list')
      onSubPageChange?.('mail-sent')
    } catch (error) {
      console.error('임시메일 발송 실패', error)
      setErrorMessage('임시저장 메일을 발송하지 못했습니다. 수신자와 저장 내용을 확인해주세요.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 화면 렌더링: 작성 화면과 목록/상세 화면을 현재 메일함 상태에 맞춰 나눠 보여줍니다.
  return (
    <div className={`mail-page ${isComposePage ? 'mail-compose-page' : ''}`}>
      {errorMessage && <div className="mail-error">{errorMessage}</div>}
      {attachmentMessage && <div className="mail-error">{attachmentMessage}</div>}

      {isComposePage ? (
        <MailCompose
          draft={draft}
          selectedRecipients={selectedRecipients}
          recipientQuery={recipientQuery}
          isRecipientListOpen={isRecipientListOpen}
          isRecipientLoading={isRecipientLoading}
          recipientErrorMessage={recipientErrorMessage}
          availableRecipientOptions={availableRecipientOptions}
          savedDraftAttachments={savedDraftAttachments}
          draftAttachments={draftAttachments}
          isSubmitting={isSubmitting}
          onSubmit={submitDraft}
          onSaveDraft={saveDraft}
          onDraftChange={setDraft}
          onRecipientQueryChange={(value) => {
            setRecipientQuery(value)
            setIsRecipientListOpen(true)
          }}
          onRecipientFocus={() => setIsRecipientListOpen(true)}
          onAddRecipient={addRecipient}
          onRemoveRecipient={removeRecipient}
          onAttachmentSelect={handleAttachmentSelect}
          onRemoveAttachment={removeAttachment}
          onDownloadAttachment={downloadAttachment}
          getInitial={getInitial}
          formatFileSize={formatFileSize}
        />
      ) : (
        <div className={`mail-shell mail-${viewMode}-view`}>
          {viewMode === 'list' && (
            <MailList
              config={config}
              mails={mails}
              visibleMails={visibleMails}
              query={query}
              selectedMails={selectedMails}
              selectedMailKeySet={selectedMailKeySet}
              isLoading={isLoading}
              pageInfo={pageInfo}
              hasSelectedMails={hasSelectedMails}
              canBulkMoveToTrash={canBulkMoveToTrash}
              canBulkToggleImportant={canBulkToggleImportant}
              canBulkCancelSent={canBulkCancelSent}
              canBulkRestore={canBulkRestore}
              canBulkPermanentDelete={canBulkPermanentDelete}
              onQueryChange={setQuery}
              onRefresh={loadMails}
              onPageChange={changeMailPage}
              onMoveSelectedToTrash={moveSelectedToTrash}
              onToggleSelectedImportant={toggleSelectedImportant}
              onCancelSelectedSentMails={cancelSelectedSentMails}
              onRestoreSelectedMails={restoreSelectedMails}
              onPermanentlyDeleteSelectedMails={permanentlyDeleteSelectedMails}
              onOpenMailDetail={openMailDetail}
              onToggleMailSelection={toggleMailSelection}
              onToggleImportant={toggleImportant}
              getMailKey={getMailKey}
              getReadStatusLabel={getReadStatusLabel}
            />
          )}

          {viewMode === 'detail' && (
            <MailDetail
              selectedMail={selectedMail}
              currentBox={currentBox}
              isSubmitting={isSubmitting}
              onBack={returnToMailList}
              onRestore={restoreMail}
              onPermanentDelete={permanentlyDeleteMail}
              onMoveToTrash={moveToTrash}
              onOpenDraft={openDraft}
              onSendSavedDraft={sendSavedDraft}
              onToggleImportant={toggleImportant}
              onCancelSentMail={cancelSentMail}
              onReply={() => {
                setActiveBox('mail-compose')
                setViewMode('list')
                onSubPageChange?.('mail-compose')
              }}
              onDownloadAttachment={downloadAttachment}
              getInitial={getInitial}
            />
          )}
        </div>
      )}

    </div>
  )
}
