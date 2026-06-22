import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  FiDownload, FiEdit2, FiFile, FiFolder, FiLock, FiLogOut, FiMonitor,
  FiPaperclip, FiSearch, FiSend, FiStar, FiUnlock, FiUserPlus, FiUsers, FiX,
} from 'react-icons/fi'
import {
  FaFileAlt, FaFileCsv, FaFileExcel, FaFileImage, FaFilePdf, FaFilePowerpoint, FaFileWord,
} from 'react-icons/fa'
import { getMyFiles, getDepartmentFiles, getFavoriteFiles, downloadFile } from '../../api/fileApi'
import { formatFileSize } from '../../utils/fileUtils'
import { formatDate } from '../../utils/dateUtils'
import { showAlert } from '../../utils/alertUtils'

const formatChatTime = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(date)
}

const getPositionAvatarClass = (position) => {
  const pos = String(position || '').replace(/\s/g, '')
  if (pos.includes('원장')) return 'position-director'
  if (pos.includes('센터장') || pos.includes('부서장') || pos.includes('본부장')) return 'position-center-head'
  if (pos.includes('팀장')) return 'position-team-head'
  if (pos.includes('사원') || pos.includes('직원') || pos.includes('주임') || pos.includes('대리')) return 'position-staff'
  return 'position-default'
}

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

const getChatFileIcon = (title) => {
  const ext = (title || '').split('.').pop().toLowerCase()
  if (ext === 'pdf') return <FaFilePdf style={{ color: '#e74c3c' }} />
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(ext)) return <FaFileImage style={{ color: '#2ecc71' }} />
  if (['xlsx', 'xls'].includes(ext)) return <FaFileExcel style={{ color: '#27ae60' }} />
  if (ext === 'csv') return <FaFileCsv style={{ color: '#27ae60' }} />
  if (['doc', 'docx'].includes(ext)) return <FaFileWord style={{ color: '#2980b9' }} />
  if (['ppt', 'pptx'].includes(ext)) return <FaFilePowerpoint style={{ color: '#e67e22' }} />
  return <FaFileAlt style={{ color: '#95a5a6' }} />
}

const PICKER_TABS = [
  { id: 'my',        label: '내 파일',    icon: <FiFolder /> },
  { id: 'shared',    label: '공유 문서함', icon: <FiUsers /> },
  { id: 'important', label: '중요 문서',   icon: <FiStar /> },
]

function InlinePicker({ onClose, onFilePicked }) {
  const [tab, setTab] = useState('my')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [downloading, setDownloading] = useState(false)

  const { data: files = [], isLoading } = useQuery({
    queryKey: ['chat-inline-picker', tab],
    queryFn: async () => {
      if (tab === 'my') {
        const res = await getMyFiles({ page: 0, size: 100 })
        return res.data?.data?.content ?? []
      }
      if (tab === 'shared') {
        const res = await getDepartmentFiles({ page: 0, size: 100 })
        return res.data?.data?.content ?? []
      }
      if (tab === 'important') {
        const res = await getFavoriteFiles({ page: 0, size: 100, sort: 'createdAt,desc' })
        return res.data?.data?.content ?? []
      }
      return []
    },
  })

  const filtered = files.filter(f =>
    !search || (f.title || f.originalFileName || '').toLowerCase().includes(search.toLowerCase())
  )

  const handleConfirm = async () => {
    if (!selectedId) return
    setDownloading(true)
    try {
      const info = files.find(f => f.fileId === selectedId)
      const res = await downloadFile(selectedId)
      const blob = new Blob([res.data])
      const filename = info?.originalFileName || info?.title || `file_${selectedId}`
      const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' })
      onFilePicked(file)
    } catch {
      showAlert('파일을 불러오는 데 실패했습니다.', 'error')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderTop: '1px solid #eee' }}>
      {/* Tabs + close */}
      <div style={{ display: 'flex', borderBottom: '1px solid #eee', background: '#fafafa' }}>
        {PICKER_TABS.map(t => (
          <button
            type="button"
            key={t.id}
            onClick={() => { setTab(t.id); setSelectedId(null) }}
            style={{
              flex: 1, padding: '7px 4px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11,
              borderBottom: tab === t.id ? '2px solid #1a73e8' : '2px solid transparent',
              color: tab === t.id ? '#1a73e8' : '#666',
              fontWeight: tab === t.id ? 600 : 400,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
              whiteSpace: 'nowrap',
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
        <button
          type="button"
          onClick={onClose}
          style={{ padding: '7px 10px', background: 'none', border: 'none', cursor: 'pointer', color: '#999', flexShrink: 0, borderBottom: '2px solid transparent' }}
          title="닫기"
        >
          <FiX size={14} />
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: '6px 10px', borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f0f0f0', borderRadius: 6, padding: '4px 8px' }}>
          <FiSearch style={{ color: '#aaa', flexShrink: 0, fontSize: 11 }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="파일 검색..."
            style={{ border: 'none', background: 'none', outline: 'none', fontSize: 12, width: '100%' }}
          />
        </div>
      </div>

      {/* File list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {isLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 60, color: '#888', fontSize: 12 }}>
            불러오는 중...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 70, color: '#bbb', fontSize: 12, gap: 6 }}>
            <FiFolder size={22} />
            {search ? '검색 결과 없음' : '파일이 없습니다'}
          </div>
        ) : filtered.map(f => {
          const id = f.fileId
          const isSelected = selectedId === id
          return (
            <div
              key={id}
              onClick={() => setSelectedId(id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px',
                cursor: 'pointer', fontSize: 12,
                background: isSelected ? '#e8f0fe' : 'transparent',
                borderLeft: isSelected ? '3px solid #1a73e8' : '3px solid transparent',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#f5f5f5' }}
              onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ fontSize: 16, flexShrink: 0 }}>{getChatFileIcon(f.title || f.originalFileName)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#222' }}>
                  {f.title || f.originalFileName}
                </div>
                <div style={{ color: '#999', fontSize: 11, marginTop: 1 }}>
                  {formatFileSize(f.fileSize)} · {formatDate(f.createdAt || f.uploadedAt)}
                </div>
              </div>
              {isSelected && <span style={{ color: '#1a73e8', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>✓</span>}
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div style={{ padding: '7px 10px', borderTop: '1px solid #eee', display: 'flex', gap: 6, justifyContent: 'flex-end', background: '#fafafa' }}>
        <button
          type="button"
          onClick={onClose}
          style={{ padding: '4px 12px', fontSize: 12, border: '1px solid #ddd', borderRadius: 4, background: '#fff', cursor: 'pointer', color: '#555' }}
        >
          취소
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!selectedId || downloading}
          style={{
            padding: '4px 12px', fontSize: 12, border: 'none', borderRadius: 4,
            background: selectedId && !downloading ? '#1a73e8' : '#c5c5c5',
            color: '#fff', cursor: selectedId && !downloading ? 'pointer' : 'not-allowed',
            transition: 'background 0.15s',
          }}
        >
          {downloading ? '불러오는 중...' : '첨부'}
        </button>
      </div>
    </div>
  )
}

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
  const [content, setContent] = useState('')
  const [showMembers, setShowMembers] = useState(false)
  const [isPositionLocked, setIsPositionLocked] = useState(false)
  const [showSourceMenu, setShowSourceMenu] = useState(false)
  const [showStoragePicker, setShowStoragePicker] = useState(false)
  const [position, setPosition] = useState(() => ({
    x: Math.max(24, window.innerWidth - 400 - index * 28),
    y: Math.max(24, window.innerHeight - 570 - index * 24),
  }))
  const [size, setSize] = useState({ width: 350, height: 520 })
  const popupRef = useRef(null)
  const messageEndRef = useRef(null)
  const fileInputRef = useRef(null)
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

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submitMessage()
    }
  }

  const handleComputerFile = (e) => {
    const file = e.target.files?.[0]
    if (file) onUploadFile(room.roomId, file)
    e.target.value = ''
    setShowSourceMenu(false)
  }

  const handleStorageFilePicked = (file) => {
    onUploadFile(room.roomId, file)
    setShowStoragePicker(false)
  }

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

      {/* 파일함 피커 — 메시지 목록 영역을 대체 */}
      {showStoragePicker ? (
        <InlinePicker
          onClose={() => setShowStoragePicker(false)}
          onFilePicked={handleStorageFilePicked}
        />
      ) : showSourceMenu ? (
        /* 파일 소스 선택 화면 — 메시지 목록 영역을 대체 */
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 16, padding: '20px 16px', borderTop: '1px solid #eee',
        }}>
          <span style={{ fontSize: 13, color: '#555', fontWeight: 500 }}>파일을 어디서 가져올까요?</span>
          <div style={{ display: 'flex', gap: 10, width: '100%' }}>
            <label
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                padding: '18px 10px', border: '2px dashed #d0d0d0', borderRadius: 8, cursor: 'pointer',
                transition: 'border-color 0.15s, background 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#1a73e8'; e.currentTarget.style.background = '#f0f4ff' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#d0d0d0'; e.currentTarget.style.background = 'transparent' }}
            >
              <FiMonitor size={26} style={{ color: '#1a73e8' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#333' }}>내 컴퓨터</span>
              <input type="file" hidden ref={fileInputRef} onChange={handleComputerFile} />
            </label>
            <button
              type="button"
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                padding: '18px 10px', border: '2px dashed #d0d0d0', borderRadius: 8, cursor: 'pointer',
                background: 'none', transition: 'border-color 0.15s, background 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#1a73e8'; e.currentTarget.style.background = '#f0f4ff' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#d0d0d0'; e.currentTarget.style.background = 'transparent' }}
              onClick={() => { setShowSourceMenu(false); setShowStoragePicker(true) }}
            >
              <FiFolder size={26} style={{ color: '#1a73e8' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#333' }}>파일함</span>
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowSourceMenu(false)}
            style={{ fontSize: 12, color: '#999', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
          >
            취소
          </button>
        </div>
      ) : (
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
      )}

      <footer className="chat-input-area">
        <button
          type="button"
          className="chat-icon-button"
          onClick={() => { setShowStoragePicker(false); setShowSourceMenu(true) }}
          disabled={!isConnected || isUploading}
          title={isUploading ? '파일 업로드 중' : '파일 첨부'}
        >
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
