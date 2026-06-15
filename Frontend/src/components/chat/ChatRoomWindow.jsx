import { useState, useRef, useEffect } from 'react'
import {
  FiDownload,
  FiEdit2,
  FiFile,
  FiLock,
  FiLogOut,
  FiPaperclip,
  FiSend,
  FiUnlock,
  FiUserPlus,
  FiUsers,
  FiX,
} from 'react-icons/fi'

// 서버 시간을 한국 날짜와 시간 형식으로 표시한다.
const formatChatTime = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(date)
}

// 메시지 작성자의 직급에 맞는 프로필 색상 CSS 클래스를 반환한다.
const getPositionAvatarClass = (position) => {
  const pos = String(position || '').replace(/\s/g, '')
  if (pos.includes('원장')) return 'position-director'
  if (pos.includes('센터장') || pos.includes('부서장') || pos.includes('본부장')) return 'position-center-head'
  if (pos.includes('팀장')) return 'position-team-head'
  if (pos.includes('사원') || pos.includes('직원') || pos.includes('주임') || pos.includes('대리')) return 'position-staff'
  return 'position-default'
}

// 멤버가 많은 방은 상단에 두 명의 이름만 표시하고 나머지는 생략한다.
const getCompactRoomHeaderName = (room, members = [], currentEmpNo) => {
  const roomName = room?.name?.trim()
  const activeMembers = Array.isArray(members) && members.length > 0
    ? members
    : Array.isArray(room?.members) ? room.members : []
  const memberNames = activeMembers
    .filter((m) => m.empNo !== currentEmpNo)
    .map((m) => m.name)
    .filter(Boolean)
  const commaNames = roomName?.includes(',')
    ? roomName.split(',').map((n) => n.trim()).filter(Boolean)
    : []
  const names = commaNames.length > 0 ? commaNames : memberNames
  if (names.length > 2 && (!roomName || commaNames.length > 0)) return `${names.slice(0, 2).join(', ')} ...`
  return roomName || names.join(', ') || '채팅방'
}

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

export default function ChatRoomWindow({
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
  // 입력 내용, 멤버 목록, 창 고정 여부와 팝업 위치/크기를 관리한다.
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

  // 새 메시지가 추가되면 항상 가장 최근 메시지가 보이도록 아래로 이동한다.
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 공백 메시지는 보내지 않고, 정상 전송 요청 후 입력창을 비운다.
  const submitMessage = () => {
    const trimmed = content.trim()
    if (!trimmed) return
    onSend(room.roomId, { content: trimmed })
    setContent('')
  }

  // Enter는 전송, Shift+Enter는 줄바꿈으로 동작한다.
  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submitMessage()
    }
  }

  // 숨겨진 파일 입력창에서 선택한 파일을 상위 Chat 컴포넌트에 전달한다.
  const handleFileChange = (event) => {
    const file = event.target.files?.[0]
    if (file) onUploadFile(room.roomId, file)
    event.target.value = ''
  }

  // 잠금 상태가 아닐 때 헤더를 드래그하여 개별 채팅방 창을 이동한다.
  const startPopupDrag = (event) => {
    if (isPositionLocked || event.button !== 0 || event.target.closest('button')) return
    event.preventDefault()
    const popupRect = popupRef.current?.getBoundingClientRect()
    if (!popupRect) return
    const { clientX: startX, clientY: startY } = event
    const { left: startLeft, top: startTop, width, height } = popupRect
    const handleMouseMove = (moveEvent) => {
      setPosition({
        x: clamp(startLeft + moveEvent.clientX - startX, 8, window.innerWidth - width - 8),
        y: clamp(startTop + moveEvent.clientY - startY, 8, window.innerHeight - height - 8),
      })
    }
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  // 각 변과 모서리를 드래그하여 개별 채팅방 창 크기를 조절한다.
  const startPopupResize = (event, direction) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    const { clientX: startX, clientY: startY } = event
    const startWidth = size.width
    const startHeight = size.height
    const startLeft = position.x
    const startTop = position.y
    const handleMouseMove = (moveEvent) => {
      const dx = moveEvent.clientX - startX
      const dy = moveEvent.clientY - startY
      let nextWidth = startWidth, nextHeight = startHeight, nextLeft = startLeft, nextTop = startTop
      if (direction.includes('right')) nextWidth = clamp(startWidth + dx, 310, window.innerWidth - startLeft - 8)
      if (direction.includes('left')) { nextWidth = clamp(startWidth - dx, 310, startWidth + startLeft - 8); nextLeft = startLeft + startWidth - nextWidth }
      if (direction.includes('bottom')) nextHeight = clamp(startHeight + dy, 360, window.innerHeight - startTop - 8)
      if (direction.includes('top')) { nextHeight = clamp(startHeight - dy, 360, startHeight + startTop - 8); nextTop = startTop + startHeight - nextHeight }
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

  // 방 관리 버튼, 메시지 목록, 파일 첨부와 메시지 입력 영역을 렌더링한다.
  return (
    <section
      ref={popupRef}
      className={`chat-popup ${isPositionLocked ? 'position-locked' : ''}`}
      style={{ left: position.x, top: position.y, width: size.width, height: size.height, zIndex: 30 + index }}
    >
      <header className="chat-popup-header" onMouseDown={startPopupDrag}>
        <div>
          <strong>{room.name || '채팅방'}</strong>
          <span>{room.type === 'GROUP' ? `${room.members?.length || 0}명` : '1:1 채팅'}</span>
        </div>
        <div className="chat-popup-actions">
          <button type="button" onClick={() => setIsPositionLocked((prev) => !prev)} title={isPositionLocked ? '채팅창 고정 해제' : '채팅창 위치 고정'} className={isPositionLocked ? 'active' : ''}>
            {isPositionLocked ? <FiLock /> : <FiUnlock />}
          </button>
          <button type="button" onClick={() => onRename(room)} title="채팅방 이름 변경"><FiEdit2 /></button>
          <button type="button" onClick={() => setShowMembers((prev) => !prev)} title="채팅방 멤버"><FiUsers /></button>
          <button type="button" onClick={() => onOpenInvite(room.roomId)} title="인원 추가"><FiUserPlus /></button>
          <button type="button" onClick={(e) => { e.stopPropagation(); onLeave(room.roomId) }} title="채팅방 나가기"><FiLogOut /></button>
          <button type="button" onClick={(e) => { e.stopPropagation(); onClose(room.roomId) }} title="창 닫기"><FiX /></button>
        </div>
      </header>

      {showMembers && (
        <div className="chat-popup-members">
          <strong>채팅방 멤버 {members.length}명</strong>
          <div>
            {members.map((member) => (
              <span key={member.empNo || member.userId}>
                <i className={getPositionAvatarClass(member.position)}>{member.name?.[0] || '?'}</i>
                {member.name || member.empNo}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="chat-message-list">
        {hasOlderMessages && (
          <button type="button" className="chat-load-older" onClick={() => onLoadOlder(room.roomId)} disabled={isLoadingOlder}>
            {isLoadingOlder ? '불러오는 중...' : '이전 메시지 더보기'}
          </button>
        )}
        {messages.length === 0 ? (
          <div className="chat-empty-small">아직 대화가 없습니다.</div>
        ) : (
          messages.map((message) => {
            const isMine = message.senderEmpNo === currentEmpNo
            const isSystem = message.messageType === 'SYSTEM'
            const isFile = message.messageType === 'FILE' || message.fileUrl
            const senderPosition = members.find((m) => m.empNo === message.senderEmpNo)?.position
            if (isSystem) return <div className="chat-system-message" key={message.messageId}>{message.content}</div>
            return (
              <div className={`chat-bubble-row ${isMine ? 'mine' : 'theirs'}`} key={message.messageId}>
                {!isMine && <span className={`chat-avatar ${getPositionAvatarClass(senderPosition)}`}>{message.senderName?.[0] || '?'}</span>}
                <div className="chat-bubble-wrap">
                  {!isMine && <span className="chat-sender">{message.senderName || '알 수 없음'}</span>}
                  <div className={`chat-bubble ${isMine ? 'mine' : 'theirs'}`}>
                    {isFile ? (
                      <button type="button" className="chat-file-message" onClick={() => onDownloadFile(message.fileUrl, message.fileName)}>
                        <FiFile /><span>{message.fileName || '첨부 파일'}</span><FiDownload />
                      </button>
                    ) : message.content}
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
        <button type="button" className="chat-icon-button" onClick={() => fileInputRef.current?.click()} disabled={!isConnected || isUploading} title={isUploading ? '파일 업로드 중' : '파일 첨부'}>
          <FiPaperclip />
        </button>
        <textarea value={content} onChange={(e) => setContent(e.target.value)} onKeyDown={handleKeyDown} placeholder={isConnected ? '메시지를 입력하세요.' : '실시간 연결 중입니다.'} rows={1} />
        <button type="button" className="chat-send-button" onClick={submitMessage} disabled={!isConnected}><FiSend /></button>
      </footer>

      {['top', 'left', 'right', 'bottom', 'top-left', 'top-right', 'bottom-left'].map((dir) => (
        <span key={dir} className={`chat-resize-handle ${dir.includes('-') ? 'corner ' : ''}${dir}`} onMouseDown={(e) => startPopupResize(e, dir)} aria-hidden="true" />
      ))}
      <span className="chat-resize-handle corner bottom-right" onMouseDown={(e) => startPopupResize(e, 'right-bottom')} aria-hidden="true" />
    </section>
  )
}
