import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  FiDownload,
  FiFile,
  FiMessageCircle,
  FiPaperclip,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiSend,
  FiUserPlus,
  FiUsers,
  FiX,
} from 'react-icons/fi'
import {
  createGroupChatRoom,
  createPrivateChatRoom,
  downloadChatFile,
  getChatMemberCandidates,
  getChatMessages,
  getChatRooms,
  inviteChatMembers,
  leaveChatRoom,
  markChatRoomAsRead,
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

const createSockJsWebSocketPath = basePath => {
  const serverId = String(Math.floor(Math.random() * 1000))
  const sessionId = Math.random().toString(36).slice(2, 12)
  return `${basePath}/${serverId}/${sessionId}/websocket`
}

const getSockJsHttpBases = () => {
  if (import.meta.env.VITE_CHAT_HTTP_URL) return [import.meta.env.VITE_CHAT_HTTP_URL.replace(/\/$/, '')]

  const apiUrl = import.meta.env.VITE_API_URL
  if (apiUrl?.startsWith('http')) {
    const normalizedApiUrl = apiUrl.replace(/\/$/, '')
    const withoutApiPath = normalizedApiUrl.replace(/\/api$/, '')
    return [
      `${normalizedApiUrl}/ws`,
      `${withoutApiPath}/ws`,
    ]
  }

  const isLocalVite = ['localhost', '127.0.0.1'].includes(window.location.hostname)
    && window.location.port === '5500'

  if (isLocalVite) {
    return [
      'http://localhost:9090/api/ws',
      'http://localhost:9090/ws',
      '/api/ws',
      '/ws',
    ]
  }

  return [
    '/api/ws',
    '/ws',
  ]
}

const getSocketUrls = () => {
  if (import.meta.env.VITE_CHAT_WS_URL) return [import.meta.env.VITE_CHAT_WS_URL]

  const apiUrl = import.meta.env.VITE_API_URL
  if (apiUrl?.startsWith('http')) {
    const normalizedApiUrl = apiUrl.replace(/^http/, 'ws').replace(/\/$/, '')
    const withoutApiPath = normalizedApiUrl.replace(/\/api$/, '')
    return [
      createSockJsWebSocketPath(`${normalizedApiUrl}/ws`),
      createSockJsWebSocketPath(`${withoutApiPath}/ws`),
    ]
  }

  const isLocalVite = ['localhost', '127.0.0.1'].includes(window.location.hostname)
    && window.location.port === '5500'

  if (isLocalVite) {
    return [
      createSockJsWebSocketPath(`${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/api/ws`),
      createSockJsWebSocketPath('ws://localhost:9090/api/ws'),
      createSockJsWebSocketPath('ws://localhost:9090/ws'),
    ]
  }

  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return [
    createSockJsWebSocketPath(`${protocol}://${window.location.host}/api/ws`),
    createSockJsWebSocketPath(`${protocol}://${window.location.host}/ws`),
  ]
}

const toWebSocketBase = httpBase => (
  httpBase.startsWith('http')
    ? httpBase.replace(/^http/, 'ws')
    : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}${httpBase}`
)

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

const parseStompFrame = frame => {
  const [headerText = '', body = ''] = frame.split('\n\n')
  const [command = '', ...headerLines] = headerText.split('\n').filter(Boolean)
  const headers = headerLines.reduce((acc, line) => {
    const index = line.indexOf(':')
    if (index > -1) acc[line.slice(0, index)] = line.slice(index + 1)
    return acc
  }, {})

  return { command, headers, body }
}

const buildStompFrame = (command, headers = {}, body = '') => {
  const headerLines = Object.entries(headers).map(([key, value]) => `${key}:${value}`)
  return `${command}\n${headerLines.join('\n')}\n\n${body}\0`
}

const normalizeMessage = message => ({
  ...message,
  messageId: message.messageId ?? `${message.roomId || 'temp'}-${message.sentAt || Date.now()}-${message.content || message.fileName || ''}`,
})

const sortOldestFirst = messages => [...messages]
  .sort((a, b) => new Date(a.sentAt || 0).getTime() - new Date(b.sentAt || 0).getTime())
  .map(normalizeMessage)

const normalizeChatRooms = (rooms, currentEmpNo) => {
  const roomMap = new Map()

  rooms.forEach(room => {
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
      roomMap.set(key, room)
      return
    }

    const previousTime = new Date(previous.lastMessageAt || 0).getTime()
    const currentTime = new Date(room.lastMessageAt || 0).getTime()
    if (currentTime >= previousTime) roomMap.set(key, room)
  })

  return Array.from(roomMap.values())
}

const getInitialWindowPosition = () => {
  if (typeof window === 'undefined') return { x: 420, y: 82 }
  return {
    x: Math.max(24, window.innerWidth - 894),
    y: 82,
  }
}

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

function ChatRoomWindow({
  room,
  index,
  messages,
  currentEmpNo,
  isConnected,
  onClose,
  onLeave,
  onOpenInvite,
  onSend,
  onUploadFile,
  onDownloadFile,
}) {
  const [content, setContent] = useState('')
  const [position, setPosition] = useState(() => ({
    x: Math.max(24, window.innerWidth - 430 - index * 28),
    y: Math.max(24, window.innerHeight - 610 - index * 24),
  }))
  const popupRef = useRef(null)
  const fileInputRef = useRef(null)
  const messageEndRef = useRef(null)

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

  const startPopupDrag = event => {
    if (event.button !== 0 || event.target.closest('button')) return

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

  return (
    <section
      ref={popupRef}
      className="chat-popup"
      style={{
        left: position.x,
        top: position.y,
        zIndex: 30 + index,
      }}
    >
      <header className="chat-popup-header" onMouseDown={startPopupDrag}>
        <div>
          <strong>{room.name || '채팅방'}</strong>
          <span>{room.type === 'GROUP' ? `${room.members?.length || 0}명` : '1:1 채팅'}</span>
        </div>
        <div className="chat-popup-actions">
          <button type="button" onClick={() => onOpenInvite(room.roomId)} title="인원 추가">
            <FiUserPlus />
          </button>
          <button type="button" onClick={() => onLeave(room.roomId)} title="채팅방 나가기">
            나가기
          </button>
          <button type="button" onClick={() => onClose(room.roomId)} title="창 닫기">
            <FiX />
          </button>
        </div>
      </header>

      <div className="chat-message-list">
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
        <button type="button" className="chat-icon-button" onClick={() => fileInputRef.current?.click()}>
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
    </section>
  )
}

export default function Chat({ user, windowMode = false, onCloseChatWindow }) {
  const storedUser = useMemo(getStoredUser, [])
  const currentUser = user || storedUser
  const currentEmpNo = currentUser?.empNo

  const [rooms, setRooms] = useState([])
  const [messagesByRoom, setMessagesByRoom] = useState({})
  const [openRoomIds, setOpenRoomIds] = useState([])
  const [search, setSearch] = useState('')
  const [privateEmpNo, setPrivateEmpNo] = useState('')
  const [groupName, setGroupName] = useState('')
  const [groupMembers, setGroupMembers] = useState('')
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

  const socketRef = useRef(null)
  const socketUrlIndexRef = useRef(0)
  const socketReconnectTimerRef = useRef(null)
  const socketManualCloseRef = useRef(false)
  const chatWindowRef = useRef(null)
  const subscribedRoomsRef = useRef(new Set())
  const openRoomIdsRef = useRef([])

  const sendSockJsPayload = useCallback(payload => {
    if (socketRef.current?.readyState !== WebSocket.OPEN) return false
    socketRef.current.send(JSON.stringify([payload]))
    return true
  }, [])

  const sendStompFrame = useCallback((command, headers, body) => (
    sendSockJsPayload(buildStompFrame(command, headers, body))
  ), [sendSockJsPayload])

  const loadRooms = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getChatRooms()
      setRooms(normalizeChatRooms(data, currentEmpNo))
    } catch (err) {
      console.error('채팅방 목록 조회 실패', err)
      setError('채팅방 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [currentEmpNo])

  const loadMessages = useCallback(async roomId => {
    try {
      const data = await getChatMessages(roomId)
      setMessagesByRoom(prev => ({
        ...prev,
        [roomId]: sortOldestFirst(data),
      }))
      await markChatRoomAsRead(roomId)
      loadRooms()
    } catch (err) {
      console.error('채팅 메시지 조회 실패', err)
      setError('채팅 메시지를 불러오지 못했습니다.')
    }
  }, [loadRooms])

  const subscribeRoom = useCallback(roomId => {
    if (!roomId || subscribedRoomsRef.current.has(roomId)) return

    const sent = sendStompFrame('SUBSCRIBE', {
      id: `room-${roomId}`,
      destination: `/topic/room.${roomId}`,
    })

    if (sent) subscribedRoomsRef.current.add(roomId)
  }, [sendStompFrame])

  const handleStompMessage = useCallback(frame => {
    const subscription = frame.headers.subscription || ''
    const roomIdFromSubscription = Number(subscription.replace('room-', ''))

    try {
      const payload = JSON.parse(frame.body)

      if (!Number.isNaN(roomIdFromSubscription)) {
        const message = normalizeMessage({ ...payload, roomId: roomIdFromSubscription })
        setMessagesByRoom(prev => {
          const current = prev[roomIdFromSubscription] || []
          if (current.some(item => item.messageId === message.messageId)) return prev
          return { ...prev, [roomIdFromSubscription]: [...current, message] }
        })
        markChatRoomAsRead(roomIdFromSubscription).catch(() => {})
      }

      loadRooms()
    } catch (err) {
      console.error('채팅 메시지 파싱 실패', err)
      loadRooms()
    }
  }, [loadRooms])

  const connectSocket = useCallback((urlIndex = socketUrlIndexRef.current) => {
    if (socketRef.current && socketRef.current.readyState <= WebSocket.OPEN) return

    const token = localStorage.getItem('token')
    const socketUrls = getSocketUrls()
    const socketUrl = socketUrls[urlIndex] || socketUrls[0]
    socketUrlIndexRef.current = urlIndex
    socketManualCloseRef.current = false

    const socket = new WebSocket(socketUrl)
    socketRef.current = socket
    setSocketStatus('connecting')

    socket.onmessage = event => {
      const data = event.data

      if (data === 'o') {
        const headers = {
          'accept-version': '1.2',
          'heart-beat': '10000,10000',
        }
        if (token) headers.Authorization = `Bearer ${token}`
        sendSockJsPayload(buildStompFrame('CONNECT', headers))
        return
      }

      if (data === 'h') return

      if (data.startsWith('c')) {
        setSocketStatus('disconnected')
        return
      }

      if (!data.startsWith('a')) return

      const frames = JSON.parse(data.slice(1))
      frames.forEach(rawFrame => {
        const frame = parseStompFrame(rawFrame.replace(/\0$/, ''))

        if (frame.command === 'CONNECTED') {
          socketUrlIndexRef.current = urlIndex
          setSocketStatus('connected')
          sendStompFrame('SUBSCRIBE', { id: 'chat-invite', destination: '/user/queue/invite' })
          openRoomIdsRef.current.forEach(subscribeRoom)
          return
        }

        if (frame.command === 'MESSAGE') {
          handleStompMessage(frame)
          return
        }

        if (frame.command === 'ERROR') {
          console.error('채팅 웹소켓 오류', frame.body)
          setSocketStatus('error')
          setError('실시간 채팅 연결에서 오류가 발생했습니다.')
        }
      })
    }

    socket.onerror = event => {
      console.error(`채팅 웹소켓 연결 실패: ${socketUrl}`, event)
    }

    socket.onclose = () => {
      subscribedRoomsRef.current.clear()

      if (!socketManualCloseRef.current && urlIndex < socketUrls.length - 1) {
        socketRef.current = null
        socketUrlIndexRef.current = urlIndex + 1
        socketReconnectTimerRef.current = window.setTimeout(() => {
          connectSocket(urlIndex + 1)
        }, 350)
        return
      }

      setSocketStatus(socketManualCloseRef.current ? 'disconnected' : 'error')
    }
  }, [handleStompMessage, sendSockJsPayload, sendStompFrame, subscribeRoom])

  useEffect(() => {
    loadRooms()
    connectSocket()

    return () => {
      socketManualCloseRef.current = true
      if (socketReconnectTimerRef.current) {
        window.clearTimeout(socketReconnectTimerRef.current)
      }
      socketRef.current?.close()
    }
  }, [connectSocket, loadRooms])

  useEffect(() => {
    openRoomIdsRef.current = openRoomIds
  }, [openRoomIds])

  useEffect(() => {
    if (socketStatus !== 'connected') return
    openRoomIds.forEach(subscribeRoom)
  }, [openRoomIds, socketStatus, subscribeRoom])

  const filteredRooms = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return rooms

    return rooms.filter(room => (
      room.name?.toLowerCase().includes(keyword)
      || room.lastMessageContent?.toLowerCase().includes(keyword)
      || room.members?.some(member => (
        member.name?.toLowerCase().includes(keyword)
        || member.empNo?.toLowerCase().includes(keyword)
      ))
    ))
  }, [rooms, search])

  const openRoom = async room => {
    setOpenRoomIds(prev => (prev.includes(room.roomId) ? prev : [...prev, room.roomId]))
    subscribeRoom(room.roomId)
    await loadMessages(room.roomId)
  }

  const closeRoom = roomId => {
    setOpenRoomIds(prev => prev.filter(id => id !== roomId))
  }

  const createPrivateRoom = async event => {
    event.preventDefault()
    const empNo = privateEmpNo.trim()
    if (!empNo) return

    try {
      const roomId = await createPrivateChatRoom(empNo)
      setPrivateEmpNo('')
      await loadRooms()
      await openRoom({ roomId, name: empNo, type: 'PRIVATE', members: [] })
    } catch (err) {
      console.error('1:1 채팅방 생성 실패', err)
      setError('1:1 채팅방을 만들지 못했습니다. 사번을 확인해주세요.')
    }
  }

  const createGroupRoom = async event => {
    event.preventDefault()
    const memberEmpNos = groupMembers
      .split(/[,\s]+/)
      .map(value => value.trim())
      .filter(Boolean)

    if (!groupName.trim() || memberEmpNos.length === 0) return

    try {
      const roomId = await createGroupChatRoom({ name: groupName.trim(), memberEmpNos })
      const roomName = groupName.trim()
      setGroupName('')
      setGroupMembers('')
      await loadRooms()
      await openRoom({ roomId, name: roomName, type: 'GROUP', members: [] })
    } catch (err) {
      console.error('그룹 채팅방 생성 실패', err)
      setError('그룹 채팅방을 만들지 못했습니다. 이름과 사번을 확인해주세요.')
    }
  }

  const normalizeCandidate = candidate => ({
    empNo: candidate.empNo || candidate.employeeNo || candidate.username || candidate.userEmpNo,
    name: candidate.name || candidate.userName || candidate.employeeName || candidate.empNo || candidate.employeeNo,
    department: candidate.department || candidate.dept || candidate.departmentName || '',
    position: candidate.position || candidate.rank || candidate.roleName || '',
  })

  const loadMemberCandidates = async () => {
    try {
      const data = await getChatMemberCandidates()
      const candidates = data
        .map(normalizeCandidate)
        .filter(candidate => candidate.empNo && candidate.empNo !== currentEmpNo)
      setMemberCandidates(candidates)
    } catch (err) {
      console.error('채팅 인원 목록 조회 실패', err)
      setError('인원 목록을 불러오지 못했습니다.')
    }
  }

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

  const openInviteMemberModal = roomId => {
    setInviteRoomId(roomId)
    setMemberInput('')
    setMemberSearch('')
    setSelectedMemberEmpNos([])
    setModalRoomName('')
    setIsCreateModalOpen(true)
    loadMemberCandidates()
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

  const submitMemberModal = async event => {
    event.preventDefault()
    const empNos = getInputEmpNos()
    if (empNos.length === 0) return

    try {
      if (inviteRoomId) {
        await inviteChatMembers(inviteRoomId, empNos)
        await loadRooms()
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

      const roomName = modalRoomName.trim() || `${empNos.length + 1}명 채팅`
      const roomId = await createGroupChatRoom({ name: roomName, memberEmpNos: empNos })
      await loadRooms()
      await openRoom({ roomId, name: roomName, type: 'GROUP', members: [] })
      closeMemberModal()
    } catch (err) {
      console.error(inviteRoomId ? '채팅방 인원 추가 실패' : '채팅방 생성 실패', err)
      setError(inviteRoomId ? '인원을 추가하지 못했습니다. 사번을 확인해주세요.' : '채팅방을 만들지 못했습니다. 사번을 확인해주세요.')
    }
  }

  const sendMessage = (roomId, payload) => {
    const sent = sendStompFrame('SEND', {
      destination: '/app/chat.send',
      'content-type': 'application/json',
    }, JSON.stringify({ roomId, ...payload }))

    if (!sent) setError('실시간 연결이 아직 준비되지 않았습니다.')
  }

  const uploadFile = async (roomId, file) => {
    try {
      const uploaded = await uploadChatFile(roomId, file)
      sendMessage(roomId, {
        content: uploaded.fileName || file.name,
        fileUrl: uploaded.fileUrl,
        fileName: uploaded.fileName || file.name,
      })
    } catch (err) {
      console.error('채팅 파일 업로드 실패', err)
      setError('파일 업로드에 실패했습니다.')
    }
  }

  const downloadFile = async (fileUrl, fileName) => {
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
      setError('파일을 다운로드하지 못했습니다.')
    }
  }

  const leaveRoom = async roomId => {
    if (!window.confirm('채팅방에서 나가시겠습니까?')) return

    try {
      await leaveChatRoom(roomId)
      closeRoom(roomId)
      await loadRooms()
    } catch (err) {
      console.error('채팅방 나가기 실패', err)
      setError('채팅방에서 나가지 못했습니다.')
    }
  }

  const filteredMemberCandidates = memberCandidates.filter(candidate => {
    const keyword = memberSearch.trim().toLowerCase()
    if (!keyword) return true

    return candidate.name?.toLowerCase().includes(keyword)
      || candidate.empNo?.toLowerCase().includes(keyword)
      || candidate.department?.toLowerCase().includes(keyword)
      || candidate.position?.toLowerCase().includes(keyword)
  })

  const selectedMemberCandidates = selectedMemberEmpNos
    .map(empNo => memberCandidates.find(candidate => candidate.empNo === empNo) || { empNo, name: empNo })

  const openRooms = openRoomIds
    .map(roomId => rooms.find(room => room.roomId === roomId) || { roomId, name: '채팅방', members: [] })
    .slice(-4)

  const startWindowDrag = useCallback(event => {
    if (!windowMode || event.button !== 0 || event.target.closest('button')) return

    event.preventDefault()
    const startX = event.clientX
    const startY = event.clientY
    const startPosition = { ...windowPosition }
    const rect = chatWindowRef.current?.getBoundingClientRect()
    const width = rect?.width || 860
    const height = rect?.height || 720

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

  return (
    <div
      ref={chatWindowRef}
      className={`${windowMode ? 'chat-window-mode' : 'page-content'} chat-page`}
      style={windowMode ? { left: windowPosition.x, top: windowPosition.y, right: 'auto' } : undefined}
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
            {!inviteRoomId && (
              <input
                value={modalRoomName}
                onChange={event => setModalRoomName(event.target.value)}
                placeholder="그룹 채팅방 이름 (선택)"
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
                    <span className="chat-member-avatar">{member.name?.[0] || member.empNo?.[0] || '?'}</span>
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
        <aside className="chat-sidebar-panel">
          <div className="chat-search">
            <FiSearch />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="채팅방 검색"
            />
          </div>

          <form className="chat-create-card" onSubmit={createPrivateRoom}>
            <strong><FiMessageCircle /> 1:1 채팅</strong>
            <div className="chat-create-row">
              <input
                value={privateEmpNo}
                onChange={event => setPrivateEmpNo(event.target.value)}
                placeholder="상대 사번"
              />
              <button type="submit"><FiPlus /></button>
            </div>
          </form>

          <form className="chat-create-card" onSubmit={createGroupRoom}>
            <strong><FiUsers /> 그룹 채팅</strong>
            <input
              value={groupName}
              onChange={event => setGroupName(event.target.value)}
              placeholder="방 이름"
            />
            <div className="chat-create-row">
              <input
                value={groupMembers}
                onChange={event => setGroupMembers(event.target.value)}
                placeholder="사번 여러 개"
              />
              <button type="submit"><FiPlus /></button>
            </div>
          </form>
        </aside>

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
              {filteredRooms.map(room => (
                <button
                  type="button"
                  className={`chat-room-item ${openRoomIds.includes(room.roomId) ? 'active' : ''}`}
                  key={room.roomId}
                  onClick={() => openRoom(room)}
                >
                  <span className="chat-room-avatar">{room.name?.[0] || '채'}</span>
                  <span className="chat-room-main">
                    <strong>{room.name || '채팅방'}</strong>
                    <small>{room.lastMessageContent || '새 대화를 시작해보세요.'}</small>
                  </span>
                  <span className="chat-room-meta">
                    <time>{formatChatTime(room.lastMessageAt)}</time>
                    {room.unreadCount > 0 && <em>{room.unreadCount}</em>}
                  </span>
                </button>
              ))}
            </div>
          )}
        </main>
      </div>

      <div className="chat-popup-layer">
        {openRooms.map((room, index) => (
          <ChatRoomWindow
            key={room.roomId}
            room={room}
            index={index}
            messages={messagesByRoom[room.roomId] || []}
            currentEmpNo={currentEmpNo}
            isConnected={socketStatus === 'connected'}
            onClose={closeRoom}
            onLeave={leaveRoom}
            onOpenInvite={openInviteMemberModal}
            onSend={sendMessage}
            onUploadFile={uploadFile}
            onDownloadFile={downloadFile}
          />
        ))}
      </div>
    </div>
  )
}
