import { session } from '../../utils/storageUtils'
import { formatFileSize as _formatFileSize } from '../../utils/fileUtils'

export const mailboxConfig = {
  'mail-compose': { title: '메일 작성', empty: '' },
  'mail-inbox': { title: '받은 메일함', empty: '받은 메일이 없습니다.' },
  'mail-sent': { title: '보낸 메일함', empty: '보낸 메일이 없습니다.' },
  'mail-drafts': { title: '임시보관함', empty: '임시저장된 메일이 없습니다.' },
  'mail-important': { title: '중요 메일함', empty: '중요 표시한 메일이 없습니다.' },
  'mail-trash': { title: '휴지통', empty: '휴지통에 메일이 없습니다.' },
}

const KOREA_TIME_ZONE = 'Asia/Seoul'
const KOREA_TIME_OFFSET_MS = 9 * 60 * 60 * 1000

export const getInitial = (name) => name?.charAt(0) || '?'
export const getResponseData = (response) => response?.data?.data ?? response?.data ?? []
export const normalizeMailboxId = (id) => (id === 'mail-draft' ? 'mail-drafts' : id)
export const getMailKey = (mail) => `${mail.box}-${mail.id}`

export const getStoredUserEmpNo = () => session.getUserEmpNo()

export { _formatFileSize as formatFileSize }

const parseMailDateTime = (value) => {
  if (!value) return null
  const hasTimeZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)
  if (hasTimeZone || typeof value !== 'string') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3})\d*)?)?/)
  const date = match
    ? new Date(Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4]),
      Number(match[5]),
      Number(match[6] || 0),
      Number((match[7] || '0').padEnd(3, '0')),
    ) - KOREA_TIME_OFFSET_MS)
    : new Date(value.replace(' ', 'T'))

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

export const sortMailsLatestFirst = (mails) => [...mails].sort((first, second) => (
  (second.timestamp || 0) - (first.timestamp || 0)
))

export const getReadStatusLabel = (mail) => {
  if (mail.box === 'inbox') return mail.unread ? '안읽음' : '읽음'
  if (mail.box !== 'sent' || !mail.readStatuses) return ''
  if (mail.readStatuses.length === 0) return '안읽음'

  const readCount = mail.readStatuses.filter(item => item.read).length
  if (readCount === 0) return '안읽음'
  if (readCount === mail.readStatuses.length) return '읽음'
  return `일부 읽음 (${readCount}/${mail.readStatuses.length})`
}

export const mapRecipientSelection = (recipient) => ({
  empNo: recipient.empNo || recipient.recipientEmpNo,
  name: recipient.name || recipient.recipientName || recipient.empNo || recipient.recipientEmpNo,
})

export const mapSummary = (mail, box, importantIds = []) => {
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

export const mergeDetail = (mail, detail) => {
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
