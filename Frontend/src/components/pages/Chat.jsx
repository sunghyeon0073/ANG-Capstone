import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  FiDownload,
  FiEdit2,
  FiFile,
  FiLock,
  FiLogOut,
  FiMessageCircle,
  FiPaperclip,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiSend,
  FiUserPlus,
  FiUsers,
  FiUnlock,
  FiX,
} from 'react-icons/fi'
import {
  createGroupChatRoom,
  createPrivateChatRoom,
  downloadChatFile,
  getChatMemberCandidates,
  getChatMessages,
  getChatRoomMembers,
  getChatRooms,
  inviteChatMembers,
  leaveChatRoom,
  markChatRoomAsRead,
  updateChatRoomName,
  uploadChatFile,
} from '../../api/chatApi'
import '../../style/chat.css'

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}')
  } catch {
    return {}
  }
}

const CHAT_SOCKET_ERROR_MESSAGE = '실시간 채팅 서버에 연결하지 못했습니다. 다른 기능은 정상적으로 사용할 수 있습니다.'

const getBackendWsBase = () => {
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const host = window.location.hostname
  const port = window.location.port

  if (port && port !== '9090') return `${protocol}://${host}:9090/api/ws`
  return `${protocol}://${window.location.host}/api/ws`
}

const getSockJsHttpBases = () => {
  if (import.meta.env.VITE_CHAT_HTTP_URL) return [import.meta.env.VITE_CHAT_HTTP_URL.replace(/\/$/, '')]

  const apiUrl = import.meta.env.VITE_API_URL
  if (apiUrl?.startsWith('http')) {
    const normalizedApiUrl = apiUrl.replace(/\/$/, '')
    return [`${normalizedApiUrl}/ws`]
  }

  return [getBackendWsBase().replace(/^ws/, 'http')]
}

const formatChatTime = value => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

const normalizeMessage = message => ({
  ...message,
  messageId: message.messageId ?? `${message.roomId || 'temp'}-${message.sentAt || Date.now()}-${message.content || message.fileName || ''}`,
})

const isSameMessage = (left, right) => {
  if (left.messageId === right.messageId) return true

  const leftTime = new Date(left.sentAt || 0).getTime()
  const rightTime = new Date(right.sentAt || 0).getTime()
  return left.senderEmpNo === right.senderEmpNo
    && left.content === right.content
    && left.fileUrl === right.fileUrl
    && Math.abs(leftTime - rightTime) <= 1500
}

const normalizeRoomId = value => {
  const roomId = typeof value === 'object'
    ? value?.roomId ?? value?.id ?? value?.chatRoomId ?? value?.data
    : value
  const numericRoomId = Number(roomId)
  return Number.isFinite(numericRoomId) ? numericRoomId : null
}

const CHAT_AUTH_ERROR_MESSAGE = '채팅 인증이 만료되었거나 권한이 없습니다. 다시 로그인 후 확인해주세요.'
const CHAT_SERVER_ERROR_MESSAGE = '채팅 서버에서 오류가 발생했습니다. 백엔드 채팅 API 응답을 확인해주세요.'

const getChatRequestErrorMessage = error => {
  const status = error?.response?.status
  if (status === 401 || status === 403) return CHAT_AUTH_ERROR_MESSAGE
  if (status >= 500) return CHAT_SERVER_ERROR_MESSAGE
  return '채팅 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'
}

const getPositionAvatarClass = position => {
  const normalizedPosition = String(position || '').replace(/\s/g, '')

  if (normalizedPosition.includes('원장')) return 'position-director'
  if (
    normalizedPosition.includes('센터장')
    || normalizedPosition.includes('부서장')
    || normalizedPosition.includes('본부장')
  ) return 'position-center-head'
  if (normalizedPosition.includes('팀장')) return 'position-team-head'
  if (
    normalizedPosition.includes('사원')
    || normalizedPosition.includes('직원')
    || normalizedPosition.includes('주임')
    || normalizedPosition.includes('대리')
  ) return 'position-staff'
  return 'position-default'
}

const POSITION_AVATAR_COLORS = {
  'position-director': '#f05d4e',
  'position-center-head': '#7457c7',
  'position-team-head': '#397bd6',
  'position-staff': '#159a95',
  'position-default': '#788894',
}

const getGroupAvatarBackground = (members, memberCandidates, currentUser) => {
  const activeMembers = Array.isArray(members) ? members : []
  if (activeMembers.length === 0) return undefined

  const positionByEmpNo = new Map(
    memberCandidates.map(member => [member.empNo, member.position])
  )
  if (currentUser?.empNo) {
    positionByEmpNo.set(currentUser.empNo, currentUser.position)
  }

  const colorCounts = new Map()
  activeMembers.forEach(member => {
    const position = member.position || positionByEmpNo.get(member.empNo)
    const positionClass = getPositionAvatarClass(position)
    const color = POSITION_AVATAR_COLORS[positionClass]
    colorCounts.set(color, (colorCounts.get(color) || 0) + 1)
  })

  let accumulated = 0
  const segments = Array.from(colorCounts.entries()).map(([color, count]) => {
    const start = accumulated
    accumulated += (count / activeMembers.length) * 100
    return `${color} ${start}% ${accumulated}%`
  })

  return `conic-gradient(${segments.join(', ')})`
}

const mergeMessages = messages => {
  const merged = []
  messages.forEach(message => {
    const normalized = normalizeMessage(message)
    if (!merged.some(item => isSameMessage(item, normalized))) {
      merged.push(normalized)
    }
  })
  return sortOldestFirst(merged)
}

const sortOldestFirst = messages => [...messages]
  .sort((a, b) => new Date(a.sentAt || 0).getTime() - new Date(b.sentAt || 0).getTime())
  .map(normalizeMessage)

const getRoomDisplayName = (room, currentEmpNo) => {
  const activeMembers = Array.isArray(room.members) ? room.members : []
  const visibleMembers = activeMembers.filter(member => member.empNo !== currentEmpNo)
  const memberNames = visibleMembers
    .map(member => member.name)
    .filter(Boolean)

  if (room.type === 'GROUP' && room.name?.trim()) return room.name.trim()
  if (memberNames.length > 0) return memberNames.join(', ')
  return room.name || '채팅방'
}

const getCompactRoomHeaderName = (room, members = [], currentEmpNo) => {
  const roomName = room?.name?.trim()
  const activeMembers = Array.isArray(members) && members.length > 0
    ? members
    : Array.isArray(room?.members)
      ? room.members
      : []
  const memberNames = activeMembers
    .filter(member => member.empNo !== currentEmpNo)
    .map(member => member.name)
    .filter(Boolean)
  const commaNames = roomName?.includes(',')
    ? roomName.split(',').map(name => name.trim()).filter(Boolean)
    : []
  const names = commaNames.length > 0 ? commaNames : memberNames

  if (names.length > 2 && (!roomName || commaNames.length > 0)) {
    return `${names.slice(0, 2).join(', ')} ...`
  }

  return roomName || names.join(', ') || '채팅방'
}

const normalizeChatRooms = (rooms, currentEmpNo) => {
  const roomMap = new Map()

  rooms.forEach(room => {
    const normalizedRoom = {
      ...room,
      name: getRoomDisplayName(room, currentEmpNo),
    }
    const otherMemberKey = room.type === 'PRIVATE'
      ? room.members
        ?.filter(member => member.empNo !== currentEmpNo)
        .map(member => member.empNo)
        .sort()
        .join(',')
      : ''
    const key = room.type === 'PRIVATE'
      ? `PRIVATE:${otherMemberKey || room.name || room.roomId}`
      : `ROOM:${room.roomId}`
    const previous = roomMap.get(key)

    if (!previous) {
      roomMap.set(key, normalizedRoom)
      return
    }

    const previousTime = new Date(previous.lastMessageAt || 0).getTime()
    const currentTime = new Date(room.lastMessageAt || 0).getTime()
    if (currentTime >= previousTime) roomMap.set(key, normalizedRoom)
  })

  return Array.from(roomMap.values()).sort((left, right) => {
    const leftTime = new Date(left.lastMessageAt || left.createdAt || 0).getTime()
    const rightTime = new Date(right.lastMessageAt || right.createdAt || 0).getTime()

    if (rightTime !== leftTime) return rightTime - leftTime
    return (normalizeRoomId(right.roomId) || 0) - (normalizeRoomId(left.roomId) || 0)
  })
}

const getInitialWindowPosition = () => {
  if (typeof window === 'undefined') return { x: 420, y: 82 }
  return {
    x: Math.max(24, window.innerWidth - 434),
    y: 82,
  }
}

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

function ChatRoomWindow({
  room: originalRoom,
  index,
  messages,
  members,
  currentEmpNo,
  isConnected,
  onClose,
  onLeave,
  onOpenInvite,
  onRename,
  onLoadOlder,
  onSend,
  onUploadFile,
  onDownloadFile,
  hasOlderMessages,
  isLoadingOlder,
  isUploading,
}) {
  const [content, setContent] = useState('')
  const [showMembers, setShowMembers] = useState(false)
  const [isPositionLocked, setIsPositionLocked] = useState(false)
  const [position, setPosition] = useState(() => ({
    x: Math.max(24, window.innerWidth - 400 - index * 28),
    y: Math.max(24, window.innerHeight - 570 - index * 24),
  }))
  const [size, setSize] = useState({ width: 350, height: 520 })
  const popupRef = useRef(null)
  const fileInputRef = useRef(null)
  const messageEndRef = useRef(null)
  const room = {
    ...originalRoom,
    originalName: originalRoom?.name,
    name: getCompactRoomHeaderName(originalRoom, members, currentEmpNo),
  }

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const submitMessage = () => {
    const trimmed = content.trim()
    if (!trimmed) return
    onSend(room.roomId, { content: trimmed })
    setContent('')
  }

  const handleKeyDown = event => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submitMessage()
    }
  }

  const handleFileChange = event => {
    const file = event.target.files?.[0]
    if (file) onUploadFile(room.roomId, file)
    event.target.value = ''
  }

  const handleLeaveClick = event => {
    event.stopPropagation()
    onLeave(room.roomId)
  }

  const handleCloseClick = event => {
    event.stopPropagation()
    onClose(room.roomId)
  }

  const startPopupDrag = event => {
    if (isPositionLocked || event.button !== 0 || event.target.closest('button')) return

    event.preventDefault()
    const popupRect = popupRef.current?.getBoundingClientRect()
    if (!popupRect) return

    const startX = event.clientX
    const startY = event.clientY
    const startLeft = popupRect.left
    const startTop = popupRect.top
    const width = popupRect.width
    const height = popupRect.height

    const handleMouseMove = moveEvent => {
      const nextLeft = clamp(startLeft + moveEvent.clientX - startX, 8, window.innerWidth - width - 8)
      const nextTop = clamp(startTop + moveEvent.clientY - startY, 8, window.innerHeight - height - 8)

      setPosition({
        x: nextLeft,
        y: nextTop,
      })
    }

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  const startPopupResize = (event, direction) => {
    if (event.button !== 0) return

    event.preventDefault()
    event.stopPropagation()

    const startX = event.clientX
    const startY = event.clientY
    const startWidth = size.width
    const startHeight = size.height
    const startLeft = position.x
    const startTop = position.y

    const handleMouseMove = moveEvent => {
      const deltaX = moveEvent.clientX - startX
      const deltaY = moveEvent.clientY - startY
      let nextWidth = startWidth
      let nextHeight = startHeight
      let nextLeft = startLeft
      let nextTop = startTop

      if (direction.includes('right')) {
        nextWidth = clamp(startWidth + deltaX, 310, window.innerWidth - startLeft - 8)
      }

      if (direction.includes('left')) {
        nextWidth = clamp(startWidth - deltaX, 310, startWidth + startLeft - 8)
        nextLeft = startLeft + startWidth - nextWidth
      }

      if (direction.includes('bottom')) {
        nextHeight = clamp(startHeight + deltaY, 360, window.innerHeight - startTop - 8)
      }

      if (direction.includes('top')) {
        nextHeight = clamp(startHeight - deltaY, 360, startHeight + startTop - 8)
        nextTop = startTop + startHeight - nextHeight
      }

      setSize({ width: nextWidth, height: nextHeight })
      setPosition({ x: nextLeft, y: nextTop })
    }

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  return (
    <section
      ref={popupRef}
      className={`chat-popup ${isPositionLocked ? 'position-locked' : ''}`}
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
        zIndex: 30 + index,
      }}
    >
      <header className="chat-popup-header" onMouseDown={startPopupDrag}>
        <div>
          <strong>{room.name || '채팅방'}</strong>
          <span>{room.type === 'GROUP' ? `${room.members?.length || 0}명` : '1:1 채팅'}</span>
        </div>
        <div className="chat-popup-actions">
          <button
            type="button"
            onClick={() => setIsPositionLocked(prev => !prev)}
            title={isPositionLocked ? '채팅창 고정 해제' : '채팅창 위치 고정'}
            className={isPositionLocked ? 'active' : ''}
          >
            {isPositionLocked ? <FiLock /> : <FiUnlock />}
          </button>
          <button type="button" onClick={() => onRename(room)} title="채팅방 이름 변경">
            <FiEdit2 />
          </button>
          <button type="button" onClick={() => setShowMembers(prev => !prev)} title="채팅방 멤버">
            <FiUsers />
          </button>
          <button type="button" onClick={() => onOpenInvite(room.roomId)} title="인원 추가">
            <FiUserPlus />
          </button>
          <button type="button" onClick={handleLeaveClick} title="채팅방 나가기">
            <FiLogOut />
          </button>
          <button type="button" onClick={handleCloseClick} title="창 닫기">
            <FiX />
          </button>
        </div>
      </header>

      {showMembers && (
        <div className="chat-popup-members">
          <strong>채팅방 멤버 {members.length}명</strong>
          <div>
            {members.map(member => (
              <span key={member.empNo || member.userId}>
                <i className={getPositionAvatarClass(member.position)}>
                  {member.name?.[0] || '?'}
                </i>
                {member.name || member.empNo}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="chat-message-list">
        {hasOlderMessages && (
          <button
            type="button"
            className="chat-load-older"
            onClick={() => onLoadOlder(room.roomId)}
            disabled={isLoadingOlder}
          >
            {isLoadingOlder ? '불러오는 중...' : '이전 메시지 더보기'}
          </button>
        )}
        {messages.length === 0 ? (
          <div className="chat-empty-small">아직 대화가 없습니다.</div>
        ) : (
          messages.map(message => {
            const isMine = message.senderEmpNo === currentEmpNo
            const isSystem = message.messageType === 'SYSTEM'
            const isFile = message.messageType === 'FILE' || message.fileUrl

            if (isSystem) {
              return (
                <div className="chat-system-message" key={message.messageId}>
                  {message.content}
                </div>
              )
            }

            return (
              <div className={`chat-bubble-row ${isMine ? 'mine' : 'theirs'}`} key={message.messageId}>
                {!isMine && <span className="chat-avatar">{message.senderName?.[0] || '?'}</span>}
                <div className="chat-bubble-wrap">
                  {!isMine && <span className="chat-sender">{message.senderName || '알 수 없음'}</span>}
                  <div className={`chat-bubble ${isMine ? 'mine' : 'theirs'}`}>
                    {isFile ? (
                      <button
                        type="button"
                        className="chat-file-message"
                        onClick={() => onDownloadFile(message.fileUrl, message.fileName)}
                      >
                        <FiFile />
                        <span>{message.fileName || '첨부 파일'}</span>
                        <FiDownload />
                      </button>
                    ) : (
                      message.content
                    )}
                  </div>
                  <span className="chat-time">{formatChatTime(message.sentAt)}</span>
                </div>
              </div>
            )
          })
        )}
        <div ref={messageEndRef} />
      </div>

      <footer className="chat-input-area">
        <input ref={fileInputRef} type="file" hidden onChange={handleFileChange} />
        <button
          type="button"
          className="chat-icon-button"
          onClick={() => fileInputRef.current?.click()}
          disabled={!isConnected || isUploading}
          title={isUploading ? '파일 업로드 중' : '파일 첨부'}
        >
          <FiPaperclip />
        </button>
        <textarea
          value={content}
          onChange={event => setContent(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isConnected ? '메시지를 입력하세요.' : '실시간 연결 중입니다.'}
          rows={1}
        />
        <button type="button" className="chat-send-button" onClick={submitMessage} disabled={!isConnected}>
          <FiSend />
        </button>
      </footer>
      <span
        className="chat-resize-handle top"
        onMouseDown={event => startPopupResize(event, 'top')}
        aria-hidden="true"
      />
      <span
        className="chat-resize-handle left"
        onMouseDown={event => startPopupResize(event, 'left')}
        aria-hidden="true"
      />
      <span
        className="chat-resize-handle right"
        onMouseDown={event => startPopupResize(event, 'right')}
        aria-hidden="true"
      />
      <span
        className="chat-resize-handle bottom"
        onMouseDown={event => startPopupResize(event, 'bottom')}
        aria-hidden="true"
      />
      <span
        className="chat-resize-handle corner top-left"
        onMouseDown={event => startPopupResize(event, 'top-left')}
        aria-hidden="true"
      />
      <span
        className="chat-resize-handle corner top-right"
        onMouseDown={event => startPopupResize(event, 'top-right')}
        aria-hidden="true"
      />
      <span
        className="chat-resize-handle corner bottom-left"
        onMouseDown={event => startPopupResize(event, 'bottom-left')}
        aria-hidden="true"
      />
      <span
        className="chat-resize-handle corner bottom-right"
        onMouseDown={event => startPopupResize(event, 'right-bottom')}
        aria-hidden="true"
      />
    </section>
  )
}

export default function Chat({
  user,
  windowMode = false,
  onCloseChatWindow,
  contactRequest,
  onContactRequestHandled,
}) {
  const storedUser = useMemo(getStoredUser, [])
  const currentUser = user || storedUser
  const currentEmpNo = currentUser?.empNo

  const [rooms, setRooms] = useState([])
  const [messagesByRoom, setMessagesByRoom] = useState({})
  const [messagePageByRoom, setMessagePageByRoom] = useState({})
  const [hasOlderMessagesByRoom, setHasOlderMessagesByRoom] = useState({})
  const [loadingOlderRoomIds, setLoadingOlderRoomIds] = useState([])
  const [uploadingRoomIds, setUploadingRoomIds] = useState([])
  const [roomMembersByRoom, setRoomMembersByRoom] = useState({})
  const [openRoomIds, setOpenRoomIds] = useState([])
  const [leavingRoomIds, setLeavingRoomIds] = useState([])
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [inviteRoomId, setInviteRoomId] = useState(null)
  const [memberInput, setMemberInput] = useState('')
  const [memberCandidates, setMemberCandidates] = useState([])
  const [memberSearch, setMemberSearch] = useState('')
  const [selectedMemberEmpNos, setSelectedMemberEmpNos] = useState([])
  const [modalRoomName, setModalRoomName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [socketStatus, setSocketStatus] = useState('disconnected')
  const [windowPosition, setWindowPosition] = useState(getInitialWindowPosition)
  const [windowSize, setWindowSize] = useState(() => ({
    width: Math.min(400, window.innerWidth - 32),
    height: Math.min(630, window.innerHeight - 48),
  }))

  const stompClientRef = useRef(null)
  const chatWindowRef = useRef(null)
  const subscribedRoomsRef = useRef(new Map())
  const openRoomIdsRef = useRef([])
  const processedContactRequestRef = useRef(null)

  const loadRooms = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getChatRooms()
      const normalizedRooms = normalizeChatRooms(data, currentEmpNo)
      setRooms(normalizedRooms)
      setRoomMembersByRoom(prev => {
        const next = { ...prev }
        normalizedRooms.forEach(room => {
          if (Array.isArray(room.members)) next[normalizeRoomId(room.roomId)] = room.members
        })
        return next
      })
      return normalizedRooms
    } catch (err) {
      console.error('채팅방 목록 조회 실패', err)
      setError(getChatRequestErrorMessage(err))
      return []
    } finally {
      setLoading(false)
    }
  }, [currentEmpNo])

  const loadMessages = useCallback(async roomId => {
    const normalizedRoomId = normalizeRoomId(roomId)
    if (!normalizedRoomId) return

    try {
      const data = await getChatMessages(normalizedRoomId, 0, 30)
      setMessagesByRoom(prev => ({
        ...prev,
        [normalizedRoomId]: mergeMessages(data),
      }))
      setMessagePageByRoom(prev => ({ ...prev, [normalizedRoomId]: 0 }))
      setHasOlderMessagesByRoom(prev => ({ ...prev, [normalizedRoomId]: data.length === 30 }))
      await markChatRoomAsRead(normalizedRoomId)
      loadRooms()
    } catch (err) {
      console.error('채팅 메시지 조회 실패', err)
      setError(getChatRequestErrorMessage(err))
    }
  }, [loadRooms])

  const loadOlderMessages = async roomId => {
    const normalizedRoomId = normalizeRoomId(roomId)
    if (!normalizedRoomId || loadingOlderRoomIds.includes(normalizedRoomId)) return

    const nextPage = (messagePageByRoom[normalizedRoomId] || 0) + 1
    setLoadingOlderRoomIds(prev => [...prev, normalizedRoomId])

    try {
      const data = await getChatMessages(normalizedRoomId, nextPage, 30)
      setMessagesByRoom(prev => ({
        ...prev,
        [normalizedRoomId]: mergeMessages([
          ...(prev[normalizedRoomId] || []),
          ...data,
        ]),
      }))
      setMessagePageByRoom(prev => ({ ...prev, [normalizedRoomId]: nextPage }))
      setHasOlderMessagesByRoom(prev => ({ ...prev, [normalizedRoomId]: data.length === 30 }))
    } catch (err) {
      console.error('이전 채팅 메시지 조회 실패', err)
      setError(getChatRequestErrorMessage(err))
    } finally {
      setLoadingOlderRoomIds(prev => prev.filter(id => id !== normalizedRoomId))
    }
  }

  const loadRoomMembers = useCallback(async roomId => {
    const normalizedRoomId = normalizeRoomId(roomId)
    if (!normalizedRoomId) return []

    try {
      const members = await getChatRoomMembers(normalizedRoomId)
      setRoomMembersByRoom(prev => ({ ...prev, [normalizedRoomId]: members }))
      return members
    } catch (err) {
      console.error('채팅방 멤버 조회 실패', err)
      setError(getChatRequestErrorMessage(err))
      return roomMembersByRoom[normalizedRoomId] || []
    }
  }, [roomMembersByRoom])

  const subscribeRoom = useCallback(roomId => {
    const normalizedRoomId = normalizeRoomId(roomId)
    if (!normalizedRoomId || subscribedRoomsRef.current.has(normalizedRoomId)) return

    const client = stompClientRef.current
    if (!client?.connected) return

    const subscription = client.subscribe(`/topic/room.${normalizedRoomId}`, messageFrame => {
      try {
        const payload = JSON.parse(messageFrame.body)
        const message = normalizeMessage({ ...payload, roomId: normalizedRoomId })

        setMessagesByRoom(prev => {
          const current = prev[normalizedRoomId] || []
          if (current.some(item => isSameMessage(item, message))) return prev
          return { ...prev, [normalizedRoomId]: [...current, message] }
        })
        markChatRoomAsRead(normalizedRoomId).catch(() => {})
        loadRooms()
      } catch (err) {
        console.error('채팅 메시지 수신 실패', err)
        loadRooms()
      }
    }, { id: `room-${normalizedRoomId}` })

    subscribedRoomsRef.current.set(normalizedRoomId, subscription)
  }, [loadRooms])

  const connectStompSocket = useCallback(async () => {
    if (stompClientRef.current?.active) return

    const token = localStorage.getItem('token')
    if (!token) {
      setSocketStatus('disconnected')
      return
    }

    const socketUrl = getSockJsHttpBases()[0]

    try {
      if (typeof globalThis !== 'undefined' && !globalThis.global) {
        globalThis.global = globalThis
      }

      const [{ Client }, sockJsModule] = await Promise.all([
        import('@stomp/stompjs'),
        import('sockjs-client'),
      ])
      const SockJS = sockJsModule.default || sockJsModule.SockJS || sockJsModule

      const client = new Client({
        connectHeaders: { Authorization: `Bearer ${token}` },
        reconnectDelay: 3000,
        heartbeatIncoming: 10000,
        heartbeatOutgoing: 10000,
        webSocketFactory: () => new SockJS(socketUrl),
        onConnect: () => {
          subscribedRoomsRef.current.clear()
          setSocketStatus('connected')
          setError('')

          client.subscribe('/user/queue/invite', () => {
            loadRooms()
          }, { id: 'chat-invite' })

          openRoomIdsRef.current.forEach(subscribeRoom)
        },
        onStompError: frame => {
          console.error('채팅 STOMP 오류', frame.headers?.message, frame.body)
          setSocketStatus('error')
          setError(CHAT_SOCKET_ERROR_MESSAGE)
        },
        onWebSocketError: event => {
          console.error(`채팅 웹소켓 연결 실패: ${socketUrl}`, event)
          setSocketStatus('error')
          setError(CHAT_SOCKET_ERROR_MESSAGE)
        },
        onWebSocketClose: () => {
          subscribedRoomsRef.current.clear()
          setSocketStatus(stompClientRef.current?.active ? 'connecting' : 'disconnected')
        },
      })

      stompClientRef.current = client
      setSocketStatus('connecting')
      client.activate()
    } catch (err) {
      console.error(`채팅 웹소켓 초기화 실패: ${socketUrl}`, err)
      setSocketStatus('error')
      setError(CHAT_SOCKET_ERROR_MESSAGE)
    }
  }, [loadRooms, subscribeRoom])

  useEffect(() => {
    loadRooms()
    connectStompSocket()

    return () => {
      stompClientRef.current?.deactivate()
      stompClientRef.current = null
      subscribedRoomsRef.current.clear()
    }
  }, [connectStompSocket, loadRooms])

  useEffect(() => {
    openRoomIdsRef.current = openRoomIds
  }, [openRoomIds])

  useEffect(() => {
    if (socketStatus !== 'connected') return
    openRoomIds.forEach(subscribeRoom)
  }, [openRoomIds, socketStatus, subscribeRoom])

  const filteredRooms = rooms

  const openRoom = useCallback(async room => {
    const roomId = normalizeRoomId(room.roomId ?? room)
    if (!roomId) {
      setError('채팅방 정보를 확인하지 못했습니다.')
      return
    }

    setOpenRoomIds(prev => (prev.includes(roomId) ? prev : [...prev, roomId]))
    subscribeRoom(roomId)
    loadRoomMembers(roomId)

    if (!messagesByRoom[roomId]?.length) {
      await loadMessages(roomId)
    } else {
      loadMessages(roomId).catch(() => {})
    }
  }, [loadMessages, loadRoomMembers, messagesByRoom, subscribeRoom])

  useEffect(() => {
    const requestId = contactRequest?.requestId
    const contact = contactRequest?.contact
    const recipientEmpNo = contact?.empNo ?? contact?.employeeNo ?? contact?.userEmpNo

    if (!requestId || processedContactRequestRef.current === requestId) return
    processedContactRequestRef.current = requestId

    if (!recipientEmpNo) {
      setError('채팅 상대의 사번을 확인할 수 없습니다.')
      onContactRequestHandled?.()
      return
    }

    if (recipientEmpNo === currentEmpNo) {
      setError('본인과의 1:1 채팅은 시작할 수 없습니다.')
      onContactRequestHandled?.()
      return
    }

    const startPrivateChat = async () => {
      try {
        const currentRooms = await loadRooms()
        const existingRoom = currentRooms.find(room => (
          room.type === 'PRIVATE'
          && room.members?.some(member => member.empNo === recipientEmpNo)
        ))

        if (existingRoom) {
          await openRoom(existingRoom)
          return
        }

        const roomId = await createPrivateChatRoom(recipientEmpNo)
        await loadRooms()
        await openRoom({
          roomId,
          name: contact?.name || recipientEmpNo,
          type: 'PRIVATE',
          members: [contact],
        })
      } catch (err) {
        console.error('조직도 1:1 채팅 시작 실패', err)
        setError(getChatRequestErrorMessage(err))
      } finally {
        onContactRequestHandled?.()
      }
    }

    startPrivateChat()
  }, [
    contactRequest,
    currentEmpNo,
    loadRooms,
    onContactRequestHandled,
    openRoom,
  ])

  const closeRoom = roomId => {
    const normalizedRoomId = normalizeRoomId(roomId)
    if (!normalizedRoomId) return
    setOpenRoomIds(prev => prev.filter(id => id !== normalizedRoomId))
  }

  const normalizeCandidate = candidate => {
    const primaryDepartment = candidate.departments?.[0] || {}
    return {
      empNo: candidate.empNo || candidate.employeeNo || candidate.username || candidate.userEmpNo,
      name: candidate.name || candidate.userName || candidate.employeeName || candidate.empNo || candidate.employeeNo,
      department: candidate.department
        || candidate.dept
        || candidate.departmentName
        || primaryDepartment.departmentName
        || primaryDepartment.name
        || '',
      position: candidate.position
        || candidate.rank
        || candidate.roleName
        || primaryDepartment.position
        || primaryDepartment.positionName
        || '',
    }
  }

  const loadMemberCandidates = async ({ silent = false } = {}) => {
    try {
      const data = await getChatMemberCandidates()
      const candidates = data
        .map(normalizeCandidate)
        .filter(candidate => candidate.empNo && candidate.empNo !== currentEmpNo)
      setMemberCandidates(candidates)
    } catch (err) {
      console.error('채팅 인원 목록 조회 실패', err)
      if (!silent) setError(getChatRequestErrorMessage(err))
    }
  }

  useEffect(() => {
    loadMemberCandidates({ silent: true })
  }, [currentEmpNo])

  const closeMemberModal = () => {
    setIsCreateModalOpen(false)
    setInviteRoomId(null)
    setMemberInput('')
    setMemberSearch('')
    setSelectedMemberEmpNos([])
    setModalRoomName('')
  }

  const openCreateMemberModal = () => {
    setInviteRoomId(null)
    setMemberInput('')
    setMemberSearch('')
    setSelectedMemberEmpNos([])
    setModalRoomName('')
    setIsCreateModalOpen(true)
    loadMemberCandidates()
  }

  const openInviteMemberModal = async roomId => {
    const normalizedRoomId = normalizeRoomId(roomId)
    if (!normalizedRoomId) return

    setInviteRoomId(normalizedRoomId)
    setMemberInput('')
    setMemberSearch('')
    setSelectedMemberEmpNos([])
    setModalRoomName('')
    setIsCreateModalOpen(true)
    await Promise.all([
      loadMemberCandidates(),
      loadRoomMembers(normalizedRoomId),
    ])
  }

  const toggleMemberSelection = empNo => {
    setSelectedMemberEmpNos(prev => (
      prev.includes(empNo)
        ? prev.filter(item => item !== empNo)
        : [...prev, empNo]
    ))
  }

  const getInputEmpNos = () => {
    const typedEmpNos = memberInput
      .split(/[,\s]+/)
      .map(value => value.trim())
      .filter(Boolean)

    return Array.from(new Set([...selectedMemberEmpNos, ...typedEmpNos]))
  }

  const inviteRoom = rooms.find(room => normalizeRoomId(room.roomId) === normalizeRoomId(inviteRoomId))

  const submitMemberModal = async event => {
    event.preventDefault()
    const empNos = getInputEmpNos()
    if (empNos.length === 0) return

    try {
      if (inviteRoomId) {
        await inviteChatMembers(inviteRoomId, empNos, modalRoomName)
        await loadRooms()
        await loadRoomMembers(inviteRoomId)
        await loadMessages(inviteRoomId)
        closeMemberModal()
        return
      }

      if (empNos.length === 1) {
        const roomId = await createPrivateChatRoom(empNos[0])
        await loadRooms()
        await openRoom({ roomId, name: empNos[0], type: 'PRIVATE', members: [] })
        closeMemberModal()
        return
      }

      const selectedNames = empNos.map(empNo => (
        memberCandidates.find(candidate => candidate.empNo === empNo)?.name || empNo
      ))
      const roomName = modalRoomName.trim()
        || [currentUser?.name, ...selectedNames].filter(Boolean).join(', ')
      const roomId = await createGroupChatRoom({ name: roomName, memberEmpNos: empNos })
      await loadRooms()
      await openRoom({ roomId, name: roomName, type: 'GROUP', members: [] })
      closeMemberModal()
    } catch (err) {
      console.error(inviteRoomId ? '채팅방 인원 추가 실패' : '채팅방 생성 실패', err)
      setError(getChatRequestErrorMessage(err))
    }
  }

  const renameRoom = async room => {
    const roomId = normalizeRoomId(room.roomId)
    if (!roomId) return

    const name = window.prompt(
      '채팅방 이름을 입력하세요. 비워두면 기본 이름으로 돌아갑니다.',
      room.originalName || room.name || ''
    )
    if (name === null) return

    try {
      await updateChatRoomName(roomId, name)
      const nextName = name.trim()
      setRooms(prev => prev.map(item => (
        normalizeRoomId(item.roomId) === roomId
          ? { ...item, name: nextName || getRoomDisplayName({ ...item, name: '' }, currentEmpNo) }
          : item
      )))
      await loadRooms()
    } catch (err) {
      console.error('채팅방 이름 변경 실패', err)
      setError(getChatRequestErrorMessage(err))
    }
  }

  const sendMessage = (roomId, payload) => {
    const client = stompClientRef.current
    const sent = Boolean(client?.connected)
    const normalizedRoomId = normalizeRoomId(roomId)
    const isActiveRoom = rooms.some(room => normalizeRoomId(room.roomId) === normalizedRoomId)
    const isLeavingRoom = leavingRoomIds.includes(normalizedRoomId)

    if (!normalizedRoomId || !isActiveRoom || isLeavingRoom) {
      setError('채팅방 정보를 확인하지 못했습니다. 채팅방을 다시 열어주세요.')
      return
    }

    if (sent) {
      try {
        client.publish({
          destination: '/app/chat.send',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ roomId: normalizedRoomId, ...payload }),
        })
      } catch (err) {
        console.error('채팅 메시지 발송 실패', err)
        setError('메시지를 보내지 못했습니다. STOMP 전송 경로와 백엔드 메시지 수신 로그를 확인해주세요.')
      }
    }

    if (!sent) setError('실시간 연결이 아직 준비되지 않았습니다.')
  }

  const uploadFile = async (roomId, file) => {
    const normalizedRoomId = normalizeRoomId(roomId)
    if (!normalizedRoomId || uploadingRoomIds.includes(normalizedRoomId)) return

    setUploadingRoomIds(prev => [...prev, normalizedRoomId])
    try {
      const uploaded = await uploadChatFile(normalizedRoomId, file)
      if (!uploaded?.fileUrl) {
        throw new Error('파일 업로드 응답에 fileUrl이 없습니다.')
      }
      sendMessage(normalizedRoomId, {
        content: uploaded.fileName || file.name,
        fileUrl: uploaded.fileUrl,
        fileName: uploaded.fileName || file.name,
      })
    } catch (err) {
      console.error('채팅 파일 업로드 실패', err)
      setError(getChatRequestErrorMessage(err))
    } finally {
      setUploadingRoomIds(prev => prev.filter(id => id !== normalizedRoomId))
    }
  }

  const downloadFile = async (fileUrl, fileName) => {
    if (!fileUrl) {
      setError('다운로드할 파일 정보가 없습니다.')
      return
    }

    try {
      const response = await downloadChatFile(fileUrl)
      const blobUrl = window.URL.createObjectURL(response.data)
      const anchor = document.createElement('a')
      anchor.href = blobUrl
      anchor.download = fileName || fileUrl?.split('/').pop() || 'download'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.URL.revokeObjectURL(blobUrl)
    } catch (err) {
      console.error('채팅 파일 다운로드 실패', err)
      setError(getChatRequestErrorMessage(err))
    }
  }

  const leaveRoom = async roomId => {
    if (!window.confirm('채팅방에서 나가시겠습니까?')) return

    const normalizedRoomId = normalizeRoomId(roomId)
    if (!normalizedRoomId) return
    setLeavingRoomIds(prev => (prev.includes(normalizedRoomId) ? prev : [...prev, normalizedRoomId]))

    try {
      await leaveChatRoom(normalizedRoomId)
      subscribedRoomsRef.current.get(normalizedRoomId)?.unsubscribe()
      subscribedRoomsRef.current.delete(normalizedRoomId)
      closeRoom(normalizedRoomId)
      setRooms(prev => prev.filter(room => normalizeRoomId(room.roomId) !== normalizedRoomId))
      setMessagesByRoom(prev => {
        const next = { ...prev }
        delete next[normalizedRoomId]
        return next
      })
      setMessagePageByRoom(prev => {
        const next = { ...prev }
        delete next[normalizedRoomId]
        return next
      })
      setHasOlderMessagesByRoom(prev => {
        const next = { ...prev }
        delete next[normalizedRoomId]
        return next
      })
      setRoomMembersByRoom(prev => {
        const next = { ...prev }
        delete next[normalizedRoomId]
        return next
      })
      await loadRooms()
    } catch (err) {
      console.error('채팅방 나가기 실패', err)
      setError(getChatRequestErrorMessage(err))
    } finally {
      setLeavingRoomIds(prev => prev.filter(id => id !== normalizedRoomId))
    }
  }

  const currentRoomMemberEmpNos = new Set(
    (roomMembersByRoom[normalizeRoomId(inviteRoomId)] || []).map(member => member.empNo)
  )

  const filteredMemberCandidates = memberCandidates.filter(candidate => {
    if (inviteRoomId && currentRoomMemberEmpNos.has(candidate.empNo)) return false
    const keyword = memberSearch.trim().toLowerCase()
    if (!keyword) return true

    return candidate.name?.toLowerCase().includes(keyword)
      || candidate.empNo?.toLowerCase().includes(keyword)
      || candidate.department?.toLowerCase().includes(keyword)
      || candidate.position?.toLowerCase().includes(keyword)
  })

  const allVisibleMembersSelected = filteredMemberCandidates.length > 0
    && filteredMemberCandidates.every(candidate => selectedMemberEmpNos.includes(candidate.empNo))

  const toggleAllVisibleMembers = () => {
    const visibleEmpNos = filteredMemberCandidates.map(candidate => candidate.empNo)
    setSelectedMemberEmpNos(prev => (
      allVisibleMembersSelected
        ? prev.filter(empNo => !visibleEmpNos.includes(empNo))
        : Array.from(new Set([...prev, ...visibleEmpNos]))
    ))
  }

  const selectedMemberCandidates = selectedMemberEmpNos
    .map(empNo => memberCandidates.find(candidate => candidate.empNo === empNo) || { empNo, name: empNo })

  const getRoomLastMessage = room => {
    const roomId = normalizeRoomId(room.roomId)
    const messages = messagesByRoom[roomId] || []
    return messages[messages.length - 1] || null
  }

  const openRooms = openRoomIds
    .map(roomId => {
      const normalizedRoomId = normalizeRoomId(roomId)
      return rooms.find(room => normalizeRoomId(room.roomId) === normalizedRoomId)
        || { roomId: normalizedRoomId, name: '채팅방', members: [] }
    })
    .filter(room => normalizeRoomId(room.roomId))
    .slice(-4)

  const startWindowDrag = useCallback(event => {
    if (!windowMode || event.button !== 0 || event.target.closest('button')) return

    event.preventDefault()
    const startX = event.clientX
    const startY = event.clientY
    const startPosition = { ...windowPosition }
    const rect = chatWindowRef.current?.getBoundingClientRect()
    const width = rect?.width || 400
    const height = rect?.height || 630

    const handleMouseMove = moveEvent => {
      const nextX = startPosition.x + moveEvent.clientX - startX
      const nextY = startPosition.y + moveEvent.clientY - startY

      setWindowPosition({
        x: clamp(nextX, 8, window.innerWidth - width - 8),
        y: clamp(nextY, 8, window.innerHeight - Math.min(height, window.innerHeight - 16) - 8),
      })
    }

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }, [windowMode, windowPosition])

  const startWindowResize = useCallback((event, direction) => {
    if (!windowMode || event.button !== 0) return

    event.preventDefault()
    event.stopPropagation()

    const startX = event.clientX
    const startY = event.clientY
    const startWidth = windowSize.width
    const startHeight = windowSize.height
    const startLeft = windowPosition.x
    const startTop = windowPosition.y

    const handleMouseMove = moveEvent => {
      const deltaX = moveEvent.clientX - startX
      const deltaY = moveEvent.clientY - startY
      let nextWidth = startWidth
      let nextHeight = startHeight
      let nextLeft = startLeft
      let nextTop = startTop

      if (direction.includes('right')) {
        nextWidth = clamp(startWidth + deltaX, 340, window.innerWidth - startLeft - 8)
      }

      if (direction.includes('left')) {
        nextWidth = clamp(startWidth - deltaX, 340, startWidth + startLeft - 8)
        nextLeft = startLeft + startWidth - nextWidth
      }

      if (direction.includes('bottom')) {
        nextHeight = clamp(startHeight + deltaY, 420, window.innerHeight - startTop - 8)
      }

      if (direction.includes('top')) {
        nextHeight = clamp(startHeight - deltaY, 420, startHeight + startTop - 8)
        nextTop = startTop + startHeight - nextHeight
      }

      setWindowSize({ width: nextWidth, height: nextHeight })
      setWindowPosition({ x: nextLeft, y: nextTop })
    }

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }, [windowMode, windowPosition, windowSize])

  return (
    <div
      ref={chatWindowRef}
      className={`${windowMode ? 'chat-window-mode' : 'page-content'} chat-page`}
      style={windowMode ? {
        left: windowPosition.x,
        top: windowPosition.y,
        right: 'auto',
        width: windowSize.width,
        height: windowSize.height,
      } : undefined}
    >
      {windowMode ? (
        <div className="chat-window-titlebar" onMouseDown={startWindowDrag}>
          <div className="chat-window-brand">
            ANG
          </div>
          <strong>채팅</strong>
          <div className="chat-window-controls">
            <button type="button" onClick={loadRooms} title="새로고침">
              <FiRefreshCw />
            </button>
            <button type="button" onClick={onCloseChatWindow} title="닫기">
              <FiX />
            </button>
          </div>
        </div>
      ) : (
        <div className="chat-page-header">
          <div>
            <span className="section-label">CHAT</span>
            <h1>채팅</h1>
            <p>백엔드 채팅 API와 연결된 채팅방 목록입니다.</p>
          </div>
          <button type="button" className="chat-refresh-button" onClick={loadRooms}>
            <FiRefreshCw />
            새로고침
          </button>
        </div>
      )}

      {error && (
        <div className="chat-error">
          {error}
          <button type="button" onClick={() => setError('')}>
            <FiX />
          </button>
        </div>
      )}

      {isCreateModalOpen && (
        <div className="chat-member-modal-backdrop" onMouseDown={closeMemberModal}>
          <form className="chat-member-modal" onSubmit={submitMemberModal} onMouseDown={event => event.stopPropagation()}>
            <div className="chat-member-modal-header">
              <strong>{inviteRoomId ? '인원 추가' : '새 채팅'}</strong>
              <button type="button" onClick={closeMemberModal}>
                <FiX />
              </button>
            </div>
            {(!inviteRoomId || inviteRoom?.type === 'PRIVATE') && (
              <input
                value={modalRoomName}
                onChange={event => setModalRoomName(event.target.value)}
                placeholder={inviteRoomId ? '전환할 그룹 채팅방 이름 (선택)' : '그룹 채팅방 이름 (선택)'}
              />
            )}
            <div className="chat-member-search">
              <FiSearch />
              <input
                value={memberSearch}
                onChange={event => setMemberSearch(event.target.value)}
                placeholder="이름, 사번, 부서 검색"
                autoFocus
              />
            </div>
            <button
              type="button"
              className="chat-member-select-all"
              onClick={toggleAllVisibleMembers}
              disabled={filteredMemberCandidates.length === 0}
            >
              {allVisibleMembersSelected ? '전체 선택 해제' : `전체 선택 (${filteredMemberCandidates.length}명)`}
            </button>
            {selectedMemberCandidates.length > 0 && (
              <div className="chat-selected-members">
                {selectedMemberCandidates.map(member => (
                  <button
                    type="button"
                    key={member.empNo}
                    onClick={() => toggleMemberSelection(member.empNo)}
                  >
                    {member.name}
                    <span>×</span>
                  </button>
                ))}
              </div>
            )}
            <div className="chat-member-list">
              {filteredMemberCandidates.length === 0 ? (
                <div className="chat-member-empty">선택할 인원이 없습니다.</div>
              ) : (
                filteredMemberCandidates.map(member => (
                  <button
                    type="button"
                    className={`chat-member-item ${selectedMemberEmpNos.includes(member.empNo) ? 'selected' : ''}`}
                    key={member.empNo}
                    onClick={() => toggleMemberSelection(member.empNo)}
                  >
                    <span className={`chat-member-avatar ${getPositionAvatarClass(member.position)}`}>
                      {member.name?.[0] || member.empNo?.[0] || '?'}
                    </span>
                    <span className="chat-member-info">
                      <strong>{member.name}</strong>
                      <small>{member.empNo}{member.department ? ` · ${member.department}` : ''}{member.position ? ` · ${member.position}` : ''}</small>
                    </span>
                  </button>
                ))
              )}
            </div>
            <input
              value={memberInput}
              onChange={event => setMemberInput(event.target.value)}
              placeholder="목록에 없으면 사번 직접 입력"
            />
            <p>
              선택 1명은 1:1 채팅, 여러 명은 그룹 채팅으로 생성됩니다.
            </p>
            <button type="submit" className="chat-member-submit-button">
              {inviteRoomId ? '추가하기' : '채팅 시작'}
            </button>
          </form>
        </div>
      )}

      <div className="chat-shell">
        <main className="chat-room-panel">
          <div className="chat-room-panel-header">
            <strong>채팅방</strong>
            <div className="chat-room-header-actions">
              <span className={`chat-status ${socketStatus}`}>
                {socketStatus === 'connected' ? '실시간 연결됨' : socketStatus === 'error' ? '실시간 연결 실패' : '연결 준비 중'}
              </span>
              <button type="button" className="chat-new-room-button" onClick={openCreateMemberModal}>
                <FiPlus />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="chat-room-skeleton">
              <span />
              <span />
              <span />
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="chat-empty">
              <FiMessageCircle />
              <p>표시할 채팅방이 없습니다.</p>
              <span>사번으로 1:1 채팅방을 만들어보세요.</span>
            </div>
          ) : (
            <div className="chat-room-list">
              {filteredRooms.map(room => {
                const lastMessage = getRoomLastMessage(room)
                const preview = lastMessage?.content || room.lastMessageContent || '새 대화를 시작해보세요.'
                const previewTime = lastMessage?.sentAt || room.lastMessageAt
                const otherMember = room.type === 'PRIVATE'
                  ? room.members?.find(member => member.empNo !== currentEmpNo)
                  : null
                const otherMemberPosition = memberCandidates.find(
                  candidate => candidate.empNo === otherMember?.empNo
                )?.position || otherMember?.position
                const avatarPositionClass = room.type === 'PRIVATE'
                  ? getPositionAvatarClass(otherMemberPosition)
                  : ''
                const groupAvatarBackground = room.type === 'GROUP'
                  ? getGroupAvatarBackground(room.members, memberCandidates, currentUser)
                  : undefined

                return (
                  <button
                    type="button"
                    className={`chat-room-item ${openRoomIds.includes(normalizeRoomId(room.roomId)) ? 'active' : ''}`}
                    key={room.roomId}
                    onClick={() => openRoom(room)}
                  >
                    <span
                      className={`chat-room-avatar ${avatarPositionClass} ${room.type === 'GROUP' ? 'group' : ''}`}
                      style={groupAvatarBackground ? { background: groupAvatarBackground } : undefined}
                    >
                      {room.name?.[0] || '채'}
                    </span>
                    <span className="chat-room-main">
                      <strong>{room.name || '채팅방'}</strong>
                      <small>{preview}</small>
                    </span>
                    <span className="chat-room-meta">
                      <time>{formatChatTime(previewTime)}</time>
                      {room.unreadCount > 0 && <em>{room.unreadCount}</em>}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </main>
      </div>

      {windowMode && (
        <>
          <span className="chat-window-resize-handle top" onMouseDown={event => startWindowResize(event, 'top')} />
          <span className="chat-window-resize-handle left" onMouseDown={event => startWindowResize(event, 'left')} />
          <span className="chat-window-resize-handle right" onMouseDown={event => startWindowResize(event, 'right')} />
          <span className="chat-window-resize-handle bottom" onMouseDown={event => startWindowResize(event, 'bottom')} />
          <span className="chat-window-resize-handle corner top-left" onMouseDown={event => startWindowResize(event, 'top-left')} />
          <span className="chat-window-resize-handle corner top-right" onMouseDown={event => startWindowResize(event, 'top-right')} />
          <span className="chat-window-resize-handle corner bottom-left" onMouseDown={event => startWindowResize(event, 'bottom-left')} />
          <span className="chat-window-resize-handle corner bottom-right" onMouseDown={event => startWindowResize(event, 'bottom-right')} />
        </>
      )}

      <div className="chat-popup-layer">
        {openRooms.map((room, index) => (
          <ChatRoomWindow
            key={room.roomId}
            room={room}
            index={index}
            messages={messagesByRoom[normalizeRoomId(room.roomId)] || []}
            members={(roomMembersByRoom[normalizeRoomId(room.roomId)] || room.members || []).map(member => ({
              ...member,
              position: member.position
                || memberCandidates.find(candidate => candidate.empNo === member.empNo)?.position
                || (member.empNo === currentEmpNo ? currentUser?.position : ''),
            }))}
            currentEmpNo={currentEmpNo}
            isConnected={socketStatus === 'connected' && !leavingRoomIds.includes(normalizeRoomId(room.roomId))}
            onClose={closeRoom}
            onLeave={leaveRoom}
            onOpenInvite={openInviteMemberModal}
            onRename={renameRoom}
            onLoadOlder={loadOlderMessages}
            onSend={sendMessage}
            onUploadFile={uploadFile}
            onDownloadFile={downloadFile}
            hasOlderMessages={Boolean(hasOlderMessagesByRoom[normalizeRoomId(room.roomId)])}
            isLoadingOlder={loadingOlderRoomIds.includes(normalizeRoomId(room.roomId))}
            isUploading={uploadingRoomIds.includes(normalizeRoomId(room.roomId))}
          />
        ))}
      </div>
    </div>
  )
}
