import { useEffect, useMemo, useRef, useState } from 'react'
import { 
  FiChevronLeft, 
  FiChevronRight, 
  FiPlus, 
  FiTrash2, 
  FiMenu, 
  FiChevronDown, 
  FiChevronUp,
  FiAlertCircle,
  FiCheckCircle,
  FiCalendar,
  FiCheckSquare,
  FiSquare
} from 'react-icons/fi'
import * as XLSX from 'xlsx'
import {
  createSchedule,
  deleteSchedule,
  getAiScheduleRecommendations,
  getSchedules,
  toggleCompleteSchedule,
  updateSchedule,
} from '../../api/scheduleApi'

const SimpleModal = ({ open, onClose, title, children }) => {
  if (!open) return null

  return (
    <div className="modal-overlay">
      <div className="modal-content calendar-modal">
        <div className="modal-header">
          <h3>{title}</h3>
          <button type="button" onClick={onClose} className="modal-close">&times;</button>
        </div>
        {children}
      </div>
    </div>
  )
}

const formatDate = (d) => {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const normalizeTime = (time) => time?.slice(0, 5) || ''

const isValidDateString = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || '')

const isValidTimeString = (value) => /^\d{2}:\d{2}$/.test(normalizeTime(value || ''))

const toApiTime = (value) => {
  const normalized = normalizeTime(value)
  return normalized ? `${normalized}:00` : ''
}

const buildSchedulePayload = (formData) => {
  const startDate = String(formData.startDate || '').trim()
  const endDate = String(formData.endDate || '').trim()
  const startTime = String(formData.startTime || '').trim()
  const endTime = String(formData.endTime || '').trim()
  const title = String(formData.title || '').trim()
  const description = String(formData.description || '').trim() || null

  if (!title) {
    throw new Error('일정 제목을 입력해주세요.')
  }

  if (title.length > 200) {
    throw new Error('일정 제목은 200자 이내로 입력해주세요.')
  }

  if (!isValidDateString(startDate) || !isValidDateString(endDate)) {
    throw new Error('시작일과 종료일 형식이 올바르지 않습니다.')
  }

  if (!isValidTimeString(startTime) || !isValidTimeString(endTime)) {
    throw new Error('시작 시간과 종료 시간 형식이 올바르지 않습니다.')
  }

  if (startDate > endDate) {
    throw new Error('시작일은 종료일보다 늦을 수 없습니다.')
  }

  if (startDate === endDate && startTime > endTime) {
    throw new Error('같은 날짜의 일정은 시작 시간이 종료 시간보다 늦을 수 없습니다.')
  }

  return {
    title,
    startDate,
    endDate,
    startTime: toApiTime(startTime),
    endTime: toApiTime(endTime),
    description,
    type: formData.type || 'PERSONAL',
    isTodo: formData.entryMode === 'TODO',
    repeatType: formData.repeatType || 'NONE',
    repeatEndDate: (formData.repeatType && formData.repeatType !== 'NONE' && formData.repeatEndDate) ? formData.repeatEndDate : null
  }
}

const normalizeHeader = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[\s_\-/.()\[\]]/g, '')
  .replace(/[^0-9a-z가-힣]/g, '')

const getCellValueByAliases = (row, aliases) => {
  const aliasSet = new Set(aliases.map(normalizeHeader))
  for (const [key, value] of Object.entries(row || {})) {
    if (aliasSet.has(normalizeHeader(key))) return value
  }
  return undefined
}

const toDateStringFromValue = (value) => {
  if (!value) return ''

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatDate(value)
  }

  if (typeof value === 'number') {
    const parsed = XLSX.SSF?.parse_date_code?.(value)
    if (parsed) return formatDate(new Date(parsed.y, parsed.m - 1, parsed.d))
  }

  const text = String(value).trim()
  if (!text) return ''

  const compactDateMatch = text.match(/^(\d{4})[.\-/년\s]?(\d{1,2})[.\-/월\s]?(\d{1,2})/)
  if (compactDateMatch) {
    const [, year, month, day] = compactDateMatch
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  const ymdMatch = text.match(/^(\d{4})(\d{2})(\d{2})$/)
  if (ymdMatch) {
    const [, year, month, day] = ymdMatch
    return `${year}-${month}-${day}`
  }

  const parsed = new Date(text)
  if (!Number.isNaN(parsed.getTime())) return formatDate(parsed)

  return ''
}

const toTimeStringFromValue = (value) => {
  if (!value) return ''

  if (typeof value === 'number') {
    const totalMinutes = Math.round(value * 24 * 60)
    const hours = String(Math.floor(totalMinutes / 60) % 24).padStart(2, '0')
    const minutes = String(totalMinutes % 60).padStart(2, '0')
    return `${hours}:${minutes}`
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const hours = String(value.getHours()).padStart(2, '0')
    const minutes = String(value.getMinutes()).padStart(2, '0')
    return `${hours}:${minutes}`
  }

  const text = String(value).trim()
  if (!text) return ''

  const timeMatch = text.match(/^(\d{1,2}):(\d{2})/)
  if (timeMatch) {
    const [, hours, minutes] = timeMatch
    return `${String(hours).padStart(2, '0')}:${minutes}`
  }

  const hmMatch = text.match(/^(\d{1,2})\s*시\s*(\d{1,2})?\s*분?$/)
  if (hmMatch) {
    const [, hours, minutes = '0'] = hmMatch
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
  }

  return ''
}

const parseExcelSchedules = (arrayBuffer) => {
  const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true })
  const firstSheetName = workbook.SheetNames[0]

  if (!firstSheetName) {
    throw new Error('엑셀 파일에 시트가 없습니다.')
  }

  const worksheet = workbook.Sheets[firstSheetName]
  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: true })

  const items = []
  const skippedRows = []

  rows.forEach((row, index) => {
    const title = String(
      getCellValueByAliases(row, ['세부업무', 'title', '일정명', '제목', '행사명', '내용']) || '',
    ).trim()
    
    // 날짜 및 주차 정보 파싱
    const rawDate = getCellValueByAliases(row, ['시작일', 'startDate', '시작날짜', 'date', '날짜', '일자', '일정일'])
    const startDate = toDateStringFromValue(rawDate)
    const endDate = toDateStringFromValue(
      getCellValueByAliases(row, ['종료일', 'endDate', '종료날짜']),
    ) || startDate
    
    const startTime = toTimeStringFromValue(
      getCellValueByAliases(row, ['startTime', '시작시간', '시작시각']),
    ) || '09:00'
    const endTime = toTimeStringFromValue(
      getCellValueByAliases(row, ['endTime', '종료시간', '종료시각']),
    ) || '10:00'
    
    let description = String(
      getCellValueByAliases(row, ['비고', 'description', '설명', '메모', '내용']) || '',
    ).trim()

    const gubun = String(getCellValueByAliases(row, ['구분']) || '').trim()
    const workGubun = String(getCellValueByAliases(row, ['업무구분']) || '').trim()
    const weekInfo = String(getCellValueByAliases(row, ['주차', '시기', 'week', 'timing']) || '').trim()
    
    const extraInfos = []
    if (gubun) extraInfos.push(`[${gubun}]`)
    if (workGubun) extraInfos.push(`[${workGubun}]`)
    if (weekInfo) extraInfos.push(`[${weekInfo}]`)
    
    if (extraInfos.length > 0) {
      const extraStr = extraInfos.join(' ')
      description = description ? `${extraStr}\n${description}` : extraStr
    }

    // 제목이 없거나, 날짜도 없고 주차 정보도 없으면 건너뜀
    if (!title || (!startDate && !weekInfo)) {
      skippedRows.push(index + 2)
      return
    }

    // 만약 날짜가 없고 주차 정보만 있다면, 현재 달의 1일 등으로 가배정하거나
    // AI 추천의 근거로 사용될 수 있도록 임시 날짜를 할당할 수 있음
    // 여기서는 일단 날짜가 필수인 기존 로직을 유지하되, 주차가 있으면 오늘 날짜라도 넣어줌 (사용자가 수정 가능하게)
    const finalStartDate = startDate || formatDate(new Date())
    const finalEndDate = endDate || finalStartDate

    items.push({
      title,
      startDate: finalStartDate,
      endDate: finalEndDate,
      startTime,
      endTime,
      type: 'PERSONAL',
      description,
    })
  })

  return { items, skippedRows }
}

const summarizeSchedule = (schedule) => {
  const dateLabel = schedule.startDate === schedule.endDate
    ? schedule.startDate
    : `${schedule.startDate} ~ ${schedule.endDate}`
  const timeLabel = `${normalizeTime(schedule.startTime)} ~ ${normalizeTime(schedule.endTime)}`
  return `${dateLabel} | ${timeLabel} | ${schedule.title}`
}

const sortByTime = (list) => {
  return [...list].sort((a, b) => (a.startTime || '00:00').localeCompare(b.startTime || '00:00'))
}

const isMultiDaySchedule = (schedule) => Boolean(
  schedule.startDate
  && schedule.endDate
  && schedule.startDate !== schedule.endDate,
)

const buildScheduleBarSegments = (schedule, gridDates) => {
  const segments = []
  let currentSegment = null

  // 할 일(Todo)은 무조건 당일 하루만 표시하도록 강제 (요청사항 반영)
  const isTodo = schedule.isTodo
  const startDate = schedule.startDate
  const endDate = isTodo ? startDate : (schedule.endDate || startDate)

  gridDates.forEach((cellDate, index) => {
    const cellDateStr = formatDate(cellDate)
    if (cellDateStr < startDate || cellDateStr > endDate) return

    const row = Math.floor(index / 7) + 1
    const col = (index % 7) + 1

    if (!currentSegment || currentSegment.row !== row || currentSegment.endCol + 1 !== col) {
      if (currentSegment) segments.push(currentSegment)
      currentSegment = { row, startCol: col, endCol: col }
      return
    }

    currentSegment.endCol = col
  })

  if (currentSegment) segments.push(currentSegment)

  return segments.map((segment, segmentIndex) => ({
    ...segment,
    key: `${schedule.id}-${segmentIndex}`,
  }))
}

const buildCalendarScheduleBars = (schedules, gridDates) => {
  const rowBuckets = new Map()

  ;(Array.isArray(schedules) ? schedules : []).forEach((schedule) => {
    buildScheduleBarSegments(schedule, gridDates).forEach((segment, segmentIndex, segments) => {
      if (!rowBuckets.has(segment.row)) rowBuckets.set(segment.row, [])
      rowBuckets.get(segment.row).push({
        ...segment,
        schedule,
        isFirstSegment: segmentIndex === 0,
        isLastSegment: segmentIndex === segments.length - 1,
      })
    })
  })

  const bars = []

  rowBuckets.forEach((rowSegments) => {
    const laneEnds = []
    rowSegments
      .sort((a, b) => {
        if (a.startCol !== b.startCol) return a.startCol - b.startCol; // Earlier first
        const durA = a.endCol - a.startCol;
        const durB = b.endCol - b.startCol;
        if (durB !== durA) return durB - durA; // Longer first for same start
        return (a.schedule.startTime || '00:00').localeCompare(b.schedule.startTime || '00:00');
      })
      .forEach((segment) => {
        let laneIndex = laneEnds.findIndex((endCol) => endCol < segment.startCol)
        if (laneIndex === -1) laneIndex = laneEnds.length
        laneEnds[laneIndex] = segment.endCol
        bars.push({ scheduleId: segment.schedule.id, ...segment, lane: laneIndex })
      })
  })

  return bars
}

const toAiSchedule = (recommendation) => ({
  id: `ai-${recommendation.id}`,
  startDate: recommendation.recommendationDate,
  endDate: recommendation.recommendationDate,
  title: recommendation.message,
  startTime: recommendation.sourceStartTime || '09:00',
  endTime: recommendation.sourceEndTime || '10:00',
  description:
    recommendation.type === 'last-year'
      ? `기준 일정: ${recommendation.sourceStartDate} ${recommendation.sourceTitle}`
      : recommendation.type === 'pattern'
        ? `분석된 주기 기반 추천: ${recommendation.sourceTitle}`
        : `예정일: ${recommendation.sourceStartDate} ${recommendation.sourceTitle}`,
  isAiRecommendation: true,
  aiType: recommendation.type,
  sourceTitle: recommendation.sourceTitle,
  associatedItems: recommendation.associatedItems || [],
})

const MonthYearPicker = ({ activeStartDate, onSelect, onClose }) => {
  const [viewYear, setViewYear] = useState(activeStartDate.getFullYear())
  const months = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']
  
  return (
    <>
      <div className="month-year-picker-backdrop" onClick={onClose} />
      <div className="month-year-picker-content">
        <div className="picker-header">
          <button onClick={() => setViewYear(viewYear - 1)}><FiChevronLeft /></button>
          <span>{viewYear}년</span>
          <button onClick={() => setViewYear(viewYear + 1)}><FiChevronRight /></button>
        </div>
        <div className="picker-grid">
          {months.map((month, idx) => (
            <button 
              key={month} 
              className={`picker-month-btn ${viewYear === activeStartDate.getFullYear() && idx === activeStartDate.getMonth() ? 'active' : ''}`}
              onClick={() => onSelect(viewYear, idx)}
            >
              {month}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

const SchedulePopover = ({ anchor, setAnchor, schedule, formData, setFormData, onUpdate, onDelete, onToggleTodo, onClose }) => {
  const dragStateRef = useRef(null)

  if (!anchor || !schedule) return null

  const handlePointerDown = (e) => {
    const header = e.target.closest('.popover-header')
    if (header) {
      dragStateRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        originTop: anchor.top,
        originLeft: anchor.left
      }
      e.currentTarget.setPointerCapture(e.pointerId)
    }
  }

  const handlePointerMove = (e) => {
    if (!dragStateRef.current || dragStateRef.current.pointerId !== e.pointerId) return
    const dx = e.clientX - dragStateRef.current.startX
    const dy = e.clientY - dragStateRef.current.startY
    
    setAnchor({
      top: dragStateRef.current.originTop + dy,
      left: dragStateRef.current.originLeft + dx
    })
  }

  const handlePointerUp = (e) => {
    if (!dragStateRef.current || dragStateRef.current.pointerId !== e.pointerId) return
    dragStateRef.current = null
  }

  const isTodo = formData.entryMode === 'TODO'
  const isAi = schedule.isAiRecommendation
  const isDept = formData.type === 'DEPARTMENT'
  
  const getTypeText = () => {
    if (isAi) return 'AI 추천 일정'
    if (isTodo) return '나의 할 일'
    if (isDept) return '부서 공유 일정'
    return '나의 개인 일정'
  }

  const getTypeStyles = () => {
    if (isAi) return { background: '#f0f9ff', color: '#0369a1', icon: '✨' }
    if (isTodo) return { background: '#f5f3ff', color: '#6d28d9', icon: '📝' }
    if (isDept) return { background: '#fff7ed', color: '#c2410c', icon: '👥' }
    return { background: '#f0fdf4', color: '#15803d', icon: '👤' }
  }

  const typeStyle = getTypeStyles()

  return (
    <>
      <div className="popover-backdrop" onClick={onClose} />
      <div 
        className="schedule-popover"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ 
          top: anchor.top, 
          left: anchor.left,
          position: 'fixed',
          zIndex: 1100,
          background: '#fff',
          width: '380px',
          borderRadius: '24px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(0,0,0,0.05)',
          padding: '24px',
          animation: 'popoverIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
          touchAction: 'none'
        }}
      >
        <div className="popover-header" style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          marginBottom: '20px', 
          alignItems: 'center',
          cursor: 'move',
          userSelect: 'none'
        }}>
          <div className="popover-type-badge" style={{ 
            fontSize: '13px', 
            fontWeight: '700', 
            padding: '6px 12px', 
            borderRadius: '12px',
            background: typeStyle.background,
            color: typeStyle.color,
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span>{typeStyle.icon}</span>
            <span>{getTypeText()}</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {!isAi && (
              <button 
                type="button" 
                onClick={(e) => onDelete(e, schedule)}
                style={{ 
                  background: '#fff1f2', 
                  border: 'none', 
                  color: '#e11d48', 
                  cursor: 'pointer', 
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '10px',
                  transition: 'all 0.2s'
                }}
                className="popover-delete-btn"
                title="삭제"
              >
                <FiTrash2 size={16} />
              </button>
            )}
          </div>
        </div>

        <div className="popover-body" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div className="popover-title-wrapper">
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              style={{ 
                fontSize: '22px', 
                fontWeight: '800', 
                border: 'none', 
                padding: '0',
                width: '100%',
                outline: 'none',
                color: '#1e293b',
                background: 'transparent',
                letterSpacing: '-0.5px',
                fontFamily: 'inherit'
              }}
              placeholder="제목을 입력하세요"
            />
          </div>

          <div className="popover-time-info" style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '10px',
            background: '#f8fafc',
            padding: '16px',
            borderRadius: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: '#475569' }}>
              <FiCalendar style={{ color: '#94a3b8' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input 
                  type="date" 
                  value={formData.startDate} 
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value, endDate: isTodo ? e.target.value : formData.endDate })}
                  style={{ border: 'none', outline: 'none', background: 'transparent', cursor: 'pointer', fontWeight: '700', color: '#1e293b', fontFamily: 'inherit' }}
                />
                {!isTodo && (
                  <>
                    <span style={{ color: '#cbd5e1' }}>→</span>
                    <input 
                      type="date" 
                      value={formData.endDate} 
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      style={{ border: 'none', outline: 'none', background: 'transparent', cursor: 'pointer', fontWeight: '700', color: '#1e293b', fontFamily: 'inherit' }}
                    />
                  </>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: '#475569' }}>
              <FiMenu style={{ color: '#94a3b8', opacity: 0.7 }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input 
                  type="time" 
                  value={formData.startTime} 
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  style={{ border: 'none', outline: 'none', background: 'transparent', cursor: 'pointer', fontWeight: '700', color: '#1e293b', fontFamily: 'inherit' }}
                />
                <span style={{ color: '#cbd5e1' }}>~</span>
                <input 
                  type="time" 
                  value={formData.endTime} 
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  style={{ border: 'none', outline: 'none', background: 'transparent', cursor: 'pointer', fontWeight: '700', color: '#1e293b', fontFamily: 'inherit' }}
                />
              </div>
            </div>
          </div>

          <div className="popover-memo-wrapper">
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#94a3b8', marginBottom: '6px', marginLeft: '4px' }}>MEMO</div>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="여기에 메모를 남겨보세요..."
              style={{ 
                width: '100%', 
                minHeight: '100px', 
                border: '1px solid #f1f5f9', 
                borderRadius: '16px', 
                padding: '14px', 
                fontSize: '14px', 
                lineHeight: '1.6',
                resize: 'none',
                background: '#fff',
                outline: 'none',
                color: '#334155',
                transition: 'all 0.2s',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)',
                fontFamily: 'inherit'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--color-primary-light, #e2e8f0)'
                e.target.style.boxShadow = '0 0 0 4px rgba(59, 130, 246, 0.05)'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#f1f5f9'
                e.target.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.02)'
              }}
            />
          </div>
        </div>

        <div className="popover-footer" style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          {isTodo && (
            <button 
              className={`btn ${schedule.isCompleted ? 'btn-secondary' : 'btn-success'}`}
              onClick={(e) => {
                onToggleTodo(e, schedule)
                onClose()
              }}
              style={{ 
                marginRight: 'auto', 
                background: schedule.isCompleted ? '#f1f5f9' : '#dcfce7', 
                color: schedule.isCompleted ? '#64748b' : '#15803d', 
                border: 'none', 
                padding: '10px 16px', 
                borderRadius: '12px', 
                fontSize: '13px', 
                fontWeight: '700', 
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {schedule.isCompleted ? '진행중으로' : '완료하기'}
            </button>
          )}
          <button 
            type="button" 
            onClick={onClose} 
            style={{ 
              padding: '10px 18px', 
              borderRadius: '12px', 
              fontSize: '14px', 
              fontWeight: '600',
              background: '#f8fafc',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer'
            }}
          >
            취소
          </button>
          <button 
            type="button" 
            onClick={onUpdate} 
            style={{ 
              padding: '10px 24px', 
              borderRadius: '12px', 
              fontSize: '14px', 
              fontWeight: '700',
              background: 'var(--color-primary, #3b82f6)',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.2)'
            }}
          >
            저장
          </button>
        </div>
      </div>
    </>
  )
}

export default function Calendar({ showSidebar = true }) {
  const excelInputRef = useRef(null)
  const [date, setDate] = useState(new Date())
  const [activeStartDate, setActiveStartDate] = useState(() => {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false)
  const [selectedFilters, setSelectedFilters] = useState(['personal', 'dept', 'todo', 'ai'])
  const [schedules, setSchedules] = useState([])
  const [aiRecommendations, setAiRecommendations] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [selectedSchedule, setSelectedSchedule] = useState(null)
  const [formData, setFormData] = useState({
    title: '',
    startDate: '',
    endDate: '',
    startTime: '09:00',
    endTime: '10:00',
    description: '',
    type: 'PERSONAL',
    entryMode: 'EVENT',
    repeatType: 'NONE'
  })
  const [selectedDate, setSelectedDate] = useState(null)
  const [isExcelConfirmOpen, setIsExcelConfirmOpen] = useState(false)
  const [excelSchedules, setExcelSchedules] = useState([])
  const [excelFileName, setExcelFileName] = useState('')
  const [excelWarnings, setExcelWarnings] = useState([])
  const [isImportingExcel, setIsImportingExcel] = useState(false)
  const [excelImportType, setExcelImportType] = useState('PERSONAL')
  
  const [sidebarTab, setSidebarTab] = useState('DAILY') // Kept for logic, but tabs are removed
  const [viewMode, setViewMode] = useState('MONTH') // 'MONTH' or 'DAY'
  const [quickTodoTitle, setQuickTodoTitle] = useState('')
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [todoFilter, setTodoFilter] = useState('ALL') // 'ALL', 'PENDING', 'COMPLETED'
  const [moreEventsDate, setMoreEventsDate] = useState(null)
  const dayViewRef = useRef(null)

  useEffect(() => {
    if (viewMode === 'DAY' && dayViewRef.current) {
      const now = new Date()
      const currentHour = now.getHours()
      // 각 시간 칸의 높이가 80px이므로, 현재 시간 위치로 스크롤
      // 약간의 여유(40px)를 두어 현재 시간이 화면 상단에 너무 붙지 않게 함
      const scrollPos = Math.max(0, (currentHour * 80) - 40)
      dayViewRef.current.scrollTop = scrollPos
    }
  }, [viewMode])

  // Accordion states
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(true)
  const [isSchedulesExpanded, setIsSchedulesExpanded] = useState(true)
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(true)

  const monthRange = useMemo(() => {
    const start = new Date(activeStartDate.getFullYear(), activeStartDate.getMonth(), 1)
    const end = new Date(activeStartDate.getFullYear(), activeStartDate.getMonth() + 1, 0)
    return { startDate: formatDate(start), endDate: formatDate(end) }
  }, [activeStartDate])

  const monthGrid = useMemo(() => {
    const year = activeStartDate.getFullYear()
    const month = activeStartDate.getMonth()
    
    const firstOfMonth = new Date(year, month, 1)
    const lastOfMonth = new Date(year, month + 1, 0)
    
    const firstDayOfWeek = firstOfMonth.getDay() // 0 (Sun) to 6 (Sat)
    const daysInMonth = lastOfMonth.getDate() // 28 to 31
    
    // 달력에 표시할 총 셀 개수 계산 (7의 배수)
    const totalCells = Math.ceil((firstDayOfWeek + daysInMonth) / 7) * 7

    const gridStart = new Date(year, month, 1 - firstDayOfWeek)
    const cells = []

    for (let i = 0; i < totalCells; i += 1) {
      cells.push(new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i))
    }

    return cells
  }, [activeStartDate])

  const aiSchedules = useMemo(
    () => (Array.isArray(aiRecommendations) ? aiRecommendations.map(toAiSchedule) : []),
    [aiRecommendations],
  )

  const visibleSchedules = useMemo(() => {
    const map = new Map()
    const baseSchedules = Array.isArray(schedules) ? schedules : []
    const baseAiSchedules = Array.isArray(aiSchedules) ? aiSchedules : []
    
    // 1. 기존 서버 일정 먼저 등록
    baseSchedules.forEach((s) => map.set(s.id, s))
    
    // 2. AI 추천 일정 추가 (ID 중복이 없고, 동일 날짜에 동일 제목의 일정이 없는 경우만)
    baseAiSchedules.forEach((s) => {
      if (map.has(s.id)) return

      const isDuplicate = baseSchedules.some(existing => 
        existing.startDate === s.startDate && 
        (existing.title === s.title || (existing.description && existing.description.includes(s.title)))
      )

      if (!isDuplicate) {
        map.set(s.id, s)
      }
    })
    
    return Array.from(map.values())
  }, [schedules, aiSchedules])

  const fetchCalendarData = async () => {
    try {
      setIsLoading(true)
      const [scheduleRes, aiRes] = await Promise.all([
        getSchedules(monthRange),
        getAiScheduleRecommendations(monthRange),
      ])
      setSchedules(Array.isArray(scheduleRes.data?.data) ? scheduleRes.data.data : [])
      setAiRecommendations(Array.isArray(aiRes.data?.data) ? aiRes.data.data : [])
    } catch (error) {
      console.error('일정 로드 실패', error)
      setSchedules([])
      setAiRecommendations([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchCalendarData()
  }, [monthRange.startDate, monthRange.endDate])

  const getScheduleGroup = (schedule) => {
    if (schedule.isAiRecommendation) return 'ai'
    if (schedule.isTodo === true || schedule.isTodo === 'true' || schedule.todo) return 'todo'
    if (schedule.type === 'DEPARTMENT') return 'dept'
    return 'personal'
  }


  const toggleFilter = (filter) => {
    setSelectedFilters((prev) => (
      prev.includes(filter)
        ? prev.filter((item) => item !== filter)
        : [...prev, filter]
    ))
  }

  const filteredSchedules = useMemo(() => {
    if (selectedFilters.length === 0) return []
    return visibleSchedules.filter((schedule) => {
      // 1. Basic group filter
      if (!selectedFilters.includes(getScheduleGroup(schedule))) return false
      
      // 2. Interactive Todo Filter from Header Summary
      if (schedule.isTodo) {
        if (todoFilter === 'PENDING' && schedule.isCompleted) return false
        if (todoFilter === 'COMPLETED' && !schedule.isCompleted) return false
      } else {
        // If clicking '남은 할 일' or '완료한 일', only show Todos
        if (todoFilter === 'PENDING' || todoFilter === 'COMPLETED') return false
      }
      
      return true
    })
  }, [visibleSchedules, selectedFilters, todoFilter])

  const calendarScheduleBars = useMemo(
    () => buildCalendarScheduleBars(filteredSchedules, monthGrid),
    [filteredSchedules, monthGrid],
  )

  const selectedDateStr = useMemo(() => selectedDate ? formatDate(selectedDate) : null, [selectedDate])

  const getSchedulesForDate = (d) => {
    const dateStr = formatDate(d)
    return filteredSchedules.filter((schedule) => {
      if (schedule.date === dateStr) return true
      if (schedule.startDate && schedule.endDate) {
        return dateStr >= schedule.startDate && dateStr <= schedule.endDate
      }
      return false
    })
  }

  const resetForm = (baseDate = selectedDate || date) => {
    const baseDateString = formatDate(baseDate)
    setFormData({
      title: '',
      startDate: baseDateString,
      endDate: baseDateString,
      startTime: '09:00',
      endTime: '10:00',
      description: '',
      type: 'PERSONAL',
      entryMode: 'EVENT',
      repeatType: 'NONE'
    })
  }

  const handleAddSchedule = () => {
    const nextSelectedDate = new Date(date)
    setSelectedDate(nextSelectedDate)
    resetForm(nextSelectedDate)
    setIsModalOpen(true)
  }

  const [popoverAnchor, setPopoverAnchor] = useState(null)
  const [popoverSchedule, setPopoverSchedule] = useState(null)

  const handleEditSchedule = (schedule, e) => {
    if (e) {
      const rect = e.currentTarget.getBoundingClientRect()
      // Position popover near the click, but keep it within viewport
      let top = rect.top
      let left = rect.left + 20
      
      // Adjust if too close to bottom or right
      if (top + 450 > window.innerHeight) top = window.innerHeight - 470
      if (left + 380 > window.innerWidth) left = rect.left - 380

      setPopoverAnchor({ top: Math.max(10, top), left: Math.max(10, left) })
    } else {
      setPopoverAnchor({ top: 100, left: window.innerWidth / 2 - 180 })
    }

    setSelectedSchedule(schedule)
    setFormData({
      title: schedule.title,
      startDate: schedule.startDate,
      endDate: schedule.endDate,
      startTime: normalizeTime(schedule.startTime),
      endTime: normalizeTime(schedule.endTime),
      description: schedule.description || '',
      type: schedule.type || 'PERSONAL',
      entryMode: (schedule.isTodo === true || schedule.isTodo === 'true' || schedule.todo) ? 'TODO' : 'EVENT',
      repeatType: schedule.repeatType || 'NONE',
      repeatEndDate: schedule.repeatEndDate || ''
    })
  }

  const handleUpdateSchedule = async () => {
    if (!selectedSchedule) return
    try {
      await updateSchedule(selectedSchedule.id, buildSchedulePayload(formData))
      setPopoverAnchor(null)
      fetchCalendarData()
    } catch (error) {
      alert(`일정 수정 실패: ${error.message}`)
    }
  }

  const openExcelPicker = () => {
    excelInputRef.current?.click()
  }

  const resetExcelImportState = () => {
    setExcelSchedules([])
    setExcelFileName('')
    setExcelWarnings([])
    setIsExcelConfirmOpen(false)
    setIsImportingExcel(false)
    if (excelInputRef.current) {
      excelInputRef.current.value = ''
    }
  }

  const handleExcelFileChange = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    const extension = file.name.split('.').pop()?.toLowerCase()
    if (!['xls', 'xlsx'].includes(extension || '')) {
      alert('엑셀 파일(.xls, .xlsx)만 업로드할 수 있습니다.')
      event.target.value = ''
      return
    }

    try {
      setIsImportingExcel(true)
      const arrayBuffer = await file.arrayBuffer()
      const { items, skippedRows } = parseExcelSchedules(arrayBuffer)

      if (items.length === 0) {
        alert('엑셀에서 등록할 수 있는 일정을 찾지 못했습니다. 날짜와 제목 컬럼을 확인해주세요.')
        return
      }

      setExcelSchedules(items)
      setExcelFileName(file.name)
      setExcelWarnings(skippedRows)
      setIsExcelConfirmOpen(true)
    } catch (error) {
      console.error('엑셀 일정 파싱 실패', error)
      alert(`엑셀 파일을 읽는 중 오류가 발생했습니다: ${error.message || '알 수 없는 오류'}`)
    } finally {
      setIsImportingExcel(false)
      event.target.value = ''
    }
  }

  const handleConfirmExcelImport = async () => {
    if (excelSchedules.length === 0) return

    try {
      setIsImportingExcel(true)
      // 모든 엑셀 일정에 선택된 타입(PERSONAL/DEPARTMENT) 적용
      await Promise.all(
        excelSchedules.map((schedule) => 
          createSchedule(buildSchedulePayload({ ...schedule, type: excelImportType }))
        )
      )
      setIsExcelConfirmOpen(false)
      resetExcelImportState()
      setIsModalOpen(false)
      fetchCalendarData()
    } catch (error) {
      alert(`엑셀 일정 등록 실패: ${error.response?.data?.message || error.message || '오류가 발생했습니다.'}`)
    } finally {
      setIsImportingExcel(false)
    }
  }

  const handleCancelExcelImport = () => {
    setIsExcelConfirmOpen(false)
    setExcelSchedules([])
    setExcelWarnings([])
    setExcelFileName('')
    if (excelInputRef.current) {
      excelInputRef.current.value = ''
    }
  }

  const handleDateChange = (nextDate) => {
    setDate(nextDate)
    setSelectedDate(nextDate)
    setActiveStartDate(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1))
  }

  const handleSaveSchedule = async () => {
    if (!formData.title.trim()) {
      alert('일정 제목을 입력해주세요.')
      return
    }

    if (!formData.startDate || !formData.endDate) {
      alert('시작일과 종료일을 선택해주세요.')
      return
    }

    try {
      await createSchedule(buildSchedulePayload(formData))
      setIsModalOpen(false)
      resetForm()
      fetchCalendarData()
    } catch (error) {
      alert(`일정 저장 실패: ${error.message || error.response?.data?.message || '오류가 발생했습니다.'}`)
    }
  }

  const handleDeleteSchedule = async (e, schedule) => {
    if (e) e.stopPropagation()
    if (schedule.isAiRecommendation) return
    if (!window.confirm('이 일정을 삭제하시겠습니까?')) return

    try {
      await deleteSchedule(schedule.id)
      setPopoverAnchor(null)
      setSelectedSchedule(null)
      fetchCalendarData()
    } catch (error) {
      alert(`일정 삭제 실패: ${error.response?.data?.message || '오류가 발생했습니다.'}`)
    }
  }

  const handleToggleTodo = async (e, schedule) => {
    if (e) e.stopPropagation()
    try {
      await toggleCompleteSchedule(schedule.id)
      fetchCalendarData()
    } catch (error) {
      alert(`할 일 상태 변경 실패: ${error.response?.data?.message || '오류가 발생했습니다.'}`)
    }
  }

  const handleGoToToday = () => {
    const today = new Date()
    setDate(today)
    setActiveStartDate(new Date(today.getFullYear(), today.getMonth(), 1))
  }

  const todaySchedules = sortByTime(getSchedulesForDate(date))
  const todayDetailSchedules = todaySchedules.filter((schedule) => !schedule.isAiRecommendation)
  const todayAiSchedules = sortByTime(
    aiSchedules.filter((schedule) => {
      const dateStr = formatDate(date)
      return schedule.startDate === dateStr || (schedule.startDate && schedule.endDate && dateStr >= schedule.startDate && dateStr <= schedule.endDate)
    }),
  )

  const handleQuickAddTodo = async (e) => {
    e.preventDefault()
    if (!quickTodoTitle.trim()) return
    try {
      const baseDate = formatDate(date)
      await createSchedule({
        title: quickTodoTitle,
        startDate: baseDate,
        endDate: baseDate,
        startTime: '00:00:00',
        endTime: '23:59:00',
        type: 'PERSONAL',
        isTodo: true,
        repeatType: 'NONE',
        description: null
      })
      setQuickTodoTitle('')
      fetchCalendarData()
    } catch (error) {
      alert(`빠른 추가 실패: ${error.message}`)
    }
  }

  const upcomingSchedules = useMemo(() => {
    const todayDate = new Date()
    const today = formatDate(todayDate)
    const nextWeek = new Date()
    nextWeek.setDate(todayDate.getDate() + 7)
    const nextWeekStr = formatDate(nextWeek)

    return sortByTime(filteredSchedules.filter(s => {
      if (s.isAiRecommendation) return false
      return s.startDate >= today && s.startDate <= nextWeekStr
    }))
  }, [filteredSchedules])

  const pendingTodos = visibleSchedules.filter(s => s.isTodo && !s.isCompleted).length
  const completedTodos = visibleSchedules.filter(s => s.isTodo && s.isCompleted).length
  const totalEvents = visibleSchedules.filter(s => !s.isTodo && !s.isAiRecommendation).length

  const handleSummaryClick = (type) => {
    setTodoFilter((prev) => (prev === type ? 'ALL' : type))
  }

  const getDayOfWeek = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('ko-KR', { weekday: 'long' });
    } catch (e) {
      return '';
    }
  };

  const displayList = sidebarTab === 'DAILY' ? todayDetailSchedules : upcomingSchedules

  const rowCount = monthGrid.length / 7

  const handlePrev = () => {
    if (viewMode === 'MONTH') {
      setActiveStartDate(new Date(activeStartDate.getFullYear(), activeStartDate.getMonth() - 1, 1))
    } else {
      const nextDate = new Date(selectedDate || date)
      nextDate.setDate(nextDate.getDate() - 1)
      handleDateChange(nextDate)
    }
  }

  const handleNext = () => {
    if (viewMode === 'MONTH') {
      setActiveStartDate(new Date(activeStartDate.getFullYear(), activeStartDate.getMonth() + 1, 1))
    } else {
      const nextDate = new Date(selectedDate || date)
      nextDate.setDate(nextDate.getDate() + 1)
      handleDateChange(nextDate)
    }
  }

  const renderDayView = () => {
    const currentDay = selectedDate || date
    const currentDayStr = formatDate(currentDay)
    const daySchedules = getSchedulesForDate(currentDay)

    // All-day header: Only events explicitly spanning the full day (00:00:00 - 23:59:00)
    // Timed To-dos and AI Recommendations will now also follow side-by-side logic in the grid.
    const allDayEvents = daySchedules.filter(s => (s.startTime === '00:00:00' && s.endTime === '23:59:00'))
    const timedEvents = daySchedules.filter(s => !allDayEvents.includes(s))
    const hours = Array.from({ length: 24 }, (_, i) => i)

    const parseTime = (t) => {
      const [h, m] = (t || '00:00').split(':').map(Number)
      return h * 60 + (m || 0)
    }

    // Prepare timed events with their calculated day-specific start/end minutes
    const processedTimedEvents = timedEvents.map(schedule => {
      let sTime = schedule.startTime
      let eTime = schedule.endTime
      if (isMultiDaySchedule(schedule)) {
        if (currentDayStr > schedule.startDate) sTime = '00:00'
        if (currentDayStr < schedule.endDate) eTime = '23:59'
      }
      return {
        ...schedule,
        startMins: parseTime(sTime),
        endMins: parseTime(eTime),
        displayStartTime: sTime,
        displayEndTime: eTime
      }
    }).sort((a, b) => a.startMins - b.startMins || (b.endMins - b.startMins) - (a.endMins - a.startMins))

    // Calculate columns for overlapping events using a more robust algorithm
    const columns = []
    processedTimedEvents.forEach(event => {
      let colIdx = 0
      while (true) {
        if (!columns[colIdx]) {
          columns[colIdx] = []
          columns[colIdx].push(event)
          event.colIdx = colIdx
          break
        }
        const lastInCol = columns[colIdx][columns[colIdx].length - 1]
        if (event.startMins >= lastInCol.endMins) {
          columns[colIdx].push(event)
          event.colIdx = colIdx
          break
        }
        colIdx++
      }
    })

    const positionedEvents = processedTimedEvents.map(event => {
      return {
        ...event,
        totalCols: columns.length
      }
    })

    return (
      <div className="calendar-day-view" ref={dayViewRef}>
        {allDayEvents.length > 0 && (
          <div className="calendar-day-header">
            <div className="calendar-day-allday-label">종일 일정</div>
            <div className="calendar-day-allday-events">
              {allDayEvents.map(schedule => (
                <div 
                  key={schedule.id} 
                  className={`calendar-schedule-bar calendar-schedule-bar--${getScheduleGroup(schedule)}`}
                  onClick={() => handleEditSchedule(schedule)}
                  style={{ position: 'relative', marginBottom: '4px', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', height: 'auto', ...schedule.isTodo && schedule.isCompleted ? { opacity: 0.6, textDecoration: 'line-through' } : {} }}
                >
                  {schedule.isTodo && (
                    <span
                      className={`todo-checkbox-icon grid-icon ${schedule.isCompleted ? 'checked' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleTodo(e, schedule);
                      }}
                    >
                      {schedule.isCompleted ? <FiCheckSquare /> : <FiSquare />}
                    </span>
                  )}
                  {schedule.title}
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="calendar-day-body">
          <div className="calendar-day-times">
            {hours.map(h => (
              <div key={h} className="calendar-day-time-label">
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
          </div>
          <div className="calendar-day-grid-lines">
            {hours.map(h => (
              <div key={h} className="calendar-day-grid-line"></div>
            ))}
            {positionedEvents.map(schedule => {
              const top = (schedule.startMins / (24 * 60)) * 100
              const height = ((schedule.endMins - schedule.startMins) / (24 * 60)) * 100
              const width = 100 / schedule.totalCols
              const left = schedule.colIdx * width

              return (
                <div 
                  key={schedule.id}
                  className={`calendar-day-event calendar-schedule-bar--${getScheduleGroup(schedule)}`}
                  style={{
                    top: `calc(${top}% + 2px)`,
                    height: `calc(${Math.max(height, 1.5)}% - 4px)`, 
                    left: `${left}%`,
                    width: `calc(${width}% - 4px)`,
                    margin: '0 2px',
                    borderLeft: '4px solid currentColor',
                    zIndex: 10 + schedule.colIdx,
                    position: 'absolute'
                  }}
                  onClick={() => handleEditSchedule(schedule)}
                >
                  <div className="calendar-day-event-time">
                    {schedule.isTodo && (
                      <span
                        className={`todo-checkbox-icon grid-icon ${schedule.isCompleted ? 'checked' : ''}`}
                        style={{ fontSize: '12px', marginRight: '4px' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleTodo(e, schedule);
                        }}
                      >
                        {schedule.isCompleted ? <FiCheckSquare /> : <FiSquare />}
                      </span>
                    )}
                    {isMultiDaySchedule(schedule) 
                      ? `${normalizeTime(schedule.displayStartTime)}${currentDayStr > schedule.startDate ? ' (이전)' : ''} - ${normalizeTime(schedule.displayEndTime)}${currentDayStr < schedule.endDate ? ' (이후)' : ''}`
                      : `${normalizeTime(schedule.startTime)} - ${normalizeTime(schedule.endTime)}`
                    }
                  </div>
                  <div className="calendar-day-event-title" style={{ textDecoration: (schedule.isTodo && schedule.isCompleted) ? 'line-through' : 'none', opacity: (schedule.isTodo && schedule.isCompleted) ? 0.6 : 1 }}>
                    {schedule.title}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="calendar-page">
      {/* ... existing header and sidebar ... */}
      <header className="calendar-main-header">
        <div className="header-left">
          <button 
            type="button" 
            className="calendar-sidebar-toggle" 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            title={isSidebarOpen ? "사이드바 접기" : "사이드바 상세보기"}
          >
            <FiMenu aria-hidden="true" />
          </button>
          <button 
            type="button" 
            className="btn btn-primary calendar-add-btn" 
            onClick={handleAddSchedule} 
            title="일정 추가" 
            style={{ 
              width: '48px', 
              height: '48px', 
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0
            }}
          >
            <FiPlus aria-hidden="true" style={{ fontSize: '28px' }} />
          </button>
        </div>

        <div className="header-center">
          <div className="calendar-header-controls">
            <button
              type="button"
              className="btn calendar-icon-btn"
              onClick={handlePrev}
              aria-label={viewMode === 'MONTH' ? "이전 달" : "이전 일"}
            >
              <FiChevronLeft aria-hidden="true" />
            </button>
            <div 
              className="calendar-current-month" 
              onClick={() => setIsMonthPickerOpen(!isMonthPickerOpen)}
              style={{ cursor: 'pointer' }}
            >
              {viewMode === 'MONTH' 
                ? activeStartDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })
                : (selectedDate || date).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })
              }
            </div>
            {isMonthPickerOpen && (
              <MonthYearPicker 
                activeStartDate={activeStartDate} 
                onSelect={(year, month) => {
                  const newDate = new Date(year, month, 1)
                  setActiveStartDate(newDate)
                  if (viewMode === 'DAY') handleDateChange(newDate)
                  setIsMonthPickerOpen(false)
                }}
                onClose={() => setIsMonthPickerOpen(false)}
              />
            )}
            <button
              type="button"
              className="btn calendar-icon-btn"
              onClick={handleNext}
              aria-label={viewMode === 'MONTH' ? "다음 달" : "다음 일"}
            >
              <FiChevronRight aria-hidden="true" />
            </button>
            <button 
              type="button" 
              className="calendar-today-btn" 
              onClick={handleGoToToday}
              style={{ marginLeft: '8px' }}
            >
              오늘
            </button>

            <div className="calendar-view-toggle" style={{ marginLeft: '16px', display: 'flex', gap: '4px', background: 'var(--color-surface-muted)', padding: '4px', borderRadius: '8px' }}>
              <button 
                type="button" 
                style={viewMode === 'MONTH' ? { padding: '4px 12px', background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' } : { padding: '4px 12px', background: 'transparent', color: 'var(--color-text)', border: 'none', cursor: 'pointer' }}
                onClick={() => setViewMode('MONTH')}
              >월</button>
              <button 
                type="button" 
                style={viewMode === 'DAY' ? { padding: '4px 12px', background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' } : { padding: '4px 12px', background: 'transparent', color: 'var(--color-text)', border: 'none', cursor: 'pointer' }}
                onClick={() => setViewMode('DAY')}
              >일</button>
            </div>
          </div>
        </div>

        <div className="header-right">
          <div className="header-summary" title="이번 달 요약 (클릭하여 필터링)">
            <div 
              className={`header-stat-item ${todoFilter === 'PENDING' ? 'active-filter' : ''}`}
              onClick={() => handleSummaryClick('PENDING')}
            >
              <FiAlertCircle className="header-stat-icon header-stat-icon--pending" />
              <span className="header-stat-value">{pendingTodos}</span>
              <span className="header-stat-label">남은 할 일 보기</span>
            </div>
            <div 
              className={`header-stat-item ${todoFilter === 'COMPLETED' ? 'active-filter' : ''}`}
              onClick={() => handleSummaryClick('COMPLETED')}
            >
              <FiCheckCircle className="header-stat-icon header-stat-icon--completed" />
              <span className="header-stat-value">{completedTodos}</span>
              <span className="header-stat-label">완료한 일 보기</span>
            </div>
            <div 
              className={`header-stat-item ${todoFilter === 'ALL' ? 'active-filter' : ''}`}
              onClick={() => handleSummaryClick('ALL')}
            >
              <FiCalendar className="header-stat-icon header-stat-icon--total" />
              <span className="header-stat-value">{totalEvents}</span>
              <span className="header-stat-label">전체 일정 보기</span>
            </div>
          </div>
        </div>
      </header>

      <div className="calendar-container">
        {showSidebar && (
          <aside className={`calendar-sidebar ${!isSidebarOpen ? 'collapsed' : ''}`}>
            <div className="sidebar-schedule-section">
              <h3 onClick={() => setIsSchedulesExpanded(!isSchedulesExpanded)}>
                일정
                {isSchedulesExpanded ? <FiChevronUp /> : <FiChevronDown />}
              </h3>
              {isSchedulesExpanded && (
                <>
                  {todayAiSchedules.length > 0 && (
                    <div className="calendar-ai-panel" aria-label="AI 일정 추천">
                      {todayAiSchedules.map((schedule) => (
                        <div key={schedule.id} className={`calendar-ai-card calendar-ai-card--${schedule.aiType}`}>
                          <div className="calendar-ai-label">
                            {schedule.aiType === 'last-year' ? '작년 기록 기반' : schedule.aiType === 'pattern' ? '반복 패턴 분석' : '다가오는 일정'}
                          </div>
                          <div className="calendar-ai-message">{schedule.title}</div>
                          <div className="calendar-ai-meta">{schedule.description}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {isLoading ? (
                    <div className="schedule-empty">불러오는 중...</div>
                  ) : displayList.length > 0 ? (
                    <div className="schedule-list">
                      {displayList.map((schedule) => (
                        <div
                          key={schedule.id}
                          className={`schedule-item schedule-item--${getScheduleGroup(schedule)} ${schedule.isAiRecommendation ? `schedule-item--ai-${schedule.aiType}` : ''}`}
                          style={schedule.isTodo && schedule.isCompleted ? { opacity: 0.6 } : {}}
                          onClick={() => handleEditSchedule(schedule)}
                        >
                          <div className="schedule-time">
                            {isMultiDaySchedule(schedule) ? (
                              `${schedule.startDate.slice(5)} ${normalizeTime(schedule.startTime)} ~ ${schedule.endDate.slice(5)} ${normalizeTime(schedule.endTime)}`
                            ) : (
                              `${normalizeTime(schedule.startTime)} ~ ${normalizeTime(schedule.endTime)}`
                            )}
                          </div>
                          
                          <div className="schedule-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {schedule.isTodo && (
                              <span 
                                onClick={(e) => handleToggleTodo(e, schedule)} 
                                style={{ cursor: 'pointer', fontSize: '18px', color: '#34d399' }}
                              >
                                {schedule.isCompleted ? '☑' : '☐'}
                              </span>
                            )}
                            <span style={{ textDecoration: (schedule.isTodo && schedule.isCompleted) ? 'line-through' : 'none' }}>
                              {schedule.title}
                            </span>
                          </div>
                          
                          {schedule.description && (
                            <div className="schedule-desc" style={{ 
                              fontSize: '12px', 
                              color: 'var(--color-text-muted)', 
                              marginTop: '4px', 
                              whiteSpace: 'nowrap', 
                              overflow: 'hidden', 
                              textOverflow: 'ellipsis' 
                            }}>
                              {schedule.description}
                            </div>
                          )}

                          {!schedule.isAiRecommendation && (
                            <button
                              type="button"
                              className="schedule-delete-btn"
                              onClick={(e) => handleDeleteSchedule(e, schedule)}
                              aria-label={`${schedule.title} 삭제`}
                            >
                              <FiTrash2 aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="schedule-empty">일정이 없습니다.</div>
                  )}
                </>
              )}
            </div>

            <div className="sidebar-filter-section">
              <h3 onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}>
                필터
                {isFiltersExpanded ? <FiChevronUp /> : <FiChevronDown />}
              </h3>
              {isFiltersExpanded && (
                <div className="calendar-filter-group" role="group" aria-label="일정 필터">
                  <label className="calendar-filter-item calendar-filter-item--personal">
                    <input
                      type="checkbox"
                      checked={selectedFilters.includes('personal')}
                      onChange={() => toggleFilter('personal')}
                    />
                    <span>개인</span>
                  </label>
                  <label className="calendar-filter-item calendar-filter-item--dept">
                    <input
                      type="checkbox"
                      checked={selectedFilters.includes('dept')}
                      onChange={() => toggleFilter('dept')}
                    />
                    <span>부서</span>
                  </label>
                  <label className="calendar-filter-item calendar-filter-item--todo">
                    <input
                      type="checkbox"
                      checked={selectedFilters.includes('todo')}
                      onChange={() => toggleFilter('todo')}
                    />
                    <span>할 일</span>
                  </label>
                  <label className="calendar-filter-item calendar-filter-item--ai">
                    <input
                      type="checkbox"
                      checked={selectedFilters.includes('ai')}
                      onChange={() => toggleFilter('ai')}
                    />
                    <span>AI 추천</span>
                  </label>
                </div>
              )}
            </div>
          </aside>
        )}

        <main className="calendar-wrapper">
          {viewMode === 'MONTH' ? (
            <div className="calendar-grid">
              <div className="calendar-weekdays">
                {['일', '월', '화', '수', '목', '금', '토'].map((weekday) => (
                  <div key={weekday} className="calendar-weekday">{weekday}</div>
                ))}
              </div>

              <div className="calendar-cells">
                {monthGrid.map((cellDate, index) => {
                  const classes = ['calendar-cell']
                  const cellDateStr = formatDate(cellDate)
                  const todayStr = formatDate(new Date())
                  const daySchedules = getSchedulesForDate(cellDate)

                  const row = Math.floor(index / 7) + 1
                  const col = (index % 7) + 1
                  const barsInCell = calendarScheduleBars.filter(bar => bar.row === row && bar.startCol <= col && bar.endCol >= col)

                  if (cellDate.getMonth() !== activeStartDate.getMonth()) classes.push('calendar-cell--other')
                  if (cellDateStr === todayStr) classes.push('calendar-cell--today')
                  if (cellDateStr === formatDate(date)) classes.push('calendar-cell--selected')
                  if (daySchedules.length > 0) classes.push('calendar-date-with-schedule')
                  if (daySchedules.some((item) => item.isAiRecommendation)) classes.push('calendar-cell--has-ai')

                  const hiddenCount = barsInCell.filter(bar => bar.lane >= 3).length

                  return (
                    <button
                      type="button"
                      key={cellDate.toISOString()}
                      className={classes.join(' ')}
                      onClick={() => {
                        handleDateChange(cellDate)
                      }}
                    >
                      <span className="calendar-cell-number">{cellDate.getDate()}</span>
                      <div className="calendar-cell-events-placeholder">
                        {/* Space reserved for bars */}
                      </div>
                      <div className="calendar-cell-bottom">
                        {hiddenCount > 0 && (
                          <span 
                            className="calendar-schedule-overflow"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDateChange(cellDate)
                              setViewMode('DAY')
                            }}
                          >
                            +{hiddenCount}개
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
                
                {/* Weekly Bar Containers Overlay */}
                {Array.from({ length: rowCount }).map((_, rowIndex) => {
                  const weekRow = rowIndex + 1;
                  const weekBars = calendarScheduleBars.filter(bar => bar.row === weekRow && bar.lane < 3);
                  
                  return (
                    <div 
                      key={`week-bars-${weekRow}`}
                      className="calendar-week-bars-container"
                      style={{
                        top: `${(rowIndex / rowCount) * 100}%`,
                        height: `${100 / rowCount}%`,
                      }}
                    >
                      {weekBars.map((bar) => {
                        const schedule = bar.schedule;
                        const duration = bar.endCol - bar.startCol + 1;
                        const segmentType = bar.isFirstSegment && bar.isLastSegment
                          ? 'single'
                          : bar.isFirstSegment
                            ? 'start'
                            : bar.isLastSegment
                              ? 'end'
                              : 'middle';

                        let itemClasses = `calendar-schedule-bar calendar-schedule-bar--${getScheduleGroup(schedule)} calendar-schedule-bar--${segmentType}`;
                        if (schedule.isTodo && schedule.isCompleted) itemClasses += ' todo-completed';

                        return (
                          <div
                            key={bar.key}
                            className={itemClasses}
                            style={{
                              gridColumn: `${bar.startCol} / span ${duration}`,
                              gridRow: bar.lane + 1,
                            }}
                            title={schedule.title}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditSchedule(schedule);
                            }}
                          >
                            {schedule.isTodo && (
                              <span
                                className={`todo-checkbox-icon grid-icon ${schedule.isCompleted ? 'checked' : ''}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleTodo(e, schedule);
                                }}
                              >
                                {schedule.isCompleted ? <FiCheckSquare /> : <FiSquare />}
                              </span>
                            )}
                            <span className="calendar-bar-text">{schedule.title}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            renderDayView()
          )}
        </main>
      </div>

      <SimpleModal open={isModalOpen} onClose={() => setIsModalOpen(false)} title="새 항목 추가">
        <div className="calendar-form">
          <div className="form-group">
            <div className="calendar-type-selector">
              <label className={`calendar-type-option ${formData.entryMode === 'EVENT' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="entryMode"
                  value="EVENT"
                  checked={formData.entryMode === 'EVENT'}
                  onChange={(e) => setFormData({ ...formData, entryMode: e.target.value })}
                />
                일정
              </label>
              <label className={`calendar-type-option ${formData.entryMode === 'TODO' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="entryMode"
                  value="TODO"
                  checked={formData.entryMode === 'TODO'}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    entryMode: e.target.value,
                    endDate: formData.startDate // Sync endDate to startDate for Todo
                  })}
                />
                할 일
              </label>
            </div>
          </div>
          
          {formData.entryMode === 'EVENT' && (
            <>
              <input
                ref={excelInputRef}
                type="file"
                accept=".xls,.xlsx"
                className="calendar-excel-input"
                onChange={handleExcelFileChange}
              />

              <div className="calendar-excel-upload">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="calendar-excel-upload-title">엑셀로 일정 등록</div>
                  <div className="calendar-excel-upload-desc">
                    양식에 맞는 엑셀 파일을 넣어주세요.
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary calendar-excel-upload-btn"
                  onClick={openExcelPicker}
                  disabled={isImportingExcel}
                  style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  {isImportingExcel ? '읽는 중...' : '엑셀 파일 업로드'}
                </button>
              </div>
            </>
          )}

          {formData.entryMode === 'EVENT' && (
            <div className="form-group">
              <label>구분</label>
              <div className="calendar-type-selector">
                <label className={`calendar-type-option ${formData.type === 'PERSONAL' ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="scheduleType"
                    value="PERSONAL"
                    checked={formData.type === 'PERSONAL'}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  />
                  개인
                </label>
                <label className={`calendar-type-option ${formData.type === 'DEPARTMENT' ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="scheduleType"
                    value="DEPARTMENT"
                    checked={formData.type === 'DEPARTMENT'}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  />
                  부서
                </label>
              </div>
            </div>
          )}

          <div className="form-group">
            <label>{formData.entryMode === 'TODO' ? '할 일 제목' : '일정 제목'}</label>
            <input
              type="text"
              placeholder={formData.entryMode === 'TODO' ? "무엇을 해야 하나요?" : "일정 제목을 입력하세요"}
              maxLength={200}
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="calendar-input"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>{formData.entryMode === 'TODO' ? '날짜' : '시작일'}</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => {
                  const newDate = e.target.value;
                  setFormData({ 
                    ...formData, 
                    startDate: newDate, 
                    endDate: (formData.entryMode === 'TODO' ? newDate : formData.endDate) 
                  });
                }}
                className="calendar-input"
              />
            </div>
            {formData.entryMode === 'EVENT' && (
              <div className="form-group">
                <label>종료일</label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="calendar-input"
                />
              </div>
            )}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>시작 시간</label>
              <input
                type="time"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                className="calendar-input"
              />
            </div>
            <div className="form-group">
              <label>{formData.entryMode === 'TODO' ? '마감 시간' : '종료 시간'}</label>
              <input
                type="time"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                className="calendar-input"
              />
            </div>
          </div>
          
          {formData.entryMode === 'EVENT' && (
             <div className="form-row">
              <div className="form-group">
                <label>반복 일정</label>
                <select 
                  className="calendar-input"
                  value={formData.repeatType}
                  onChange={(e) => setFormData({ ...formData, repeatType: e.target.value })}
                >
                  <option value="NONE">반복 안 함</option>
                  <option value="DAILY">매일</option>
                  <option value="WEEKLY">매주</option>
                  <option value="MONTHLY">매월</option>
                  <option value="YEARLY">매년</option>
                </select>
              </div>
              {formData.repeatType !== 'NONE' && (
                <div className="form-group">
                  <label>반복 종료일</label>
                  <input
                    type="date"
                    value={formData.repeatEndDate}
                    onChange={(e) => setFormData({ ...formData, repeatEndDate: e.target.value })}
                    className="calendar-input"
                  />
                </div>
              )}
            </div>
          )}

          <div className="form-group">
            <label>설명</label>
            <textarea
              placeholder="설명을 입력하세요. 선택 사항입니다."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="calendar-textarea"
              rows={formData.entryMode === 'TODO' ? "2" : "3"}
            />
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>취소</button>
            <button type="button" className="btn btn-primary" onClick={handleSaveSchedule}>저장</button>
          </div>
        </div>
      </SimpleModal>

      <SimpleModal open={isExcelConfirmOpen} onClose={handleCancelExcelImport} title="엑셀 일정 확인">
        <div className="calendar-form">
          <div className="calendar-excel-summary">
            <strong>{excelFileName}</strong>에서 {excelSchedules.length}개의 일정을 읽었습니다.
          </div>

          <div className="form-group" style={{ marginTop: '15px' }}>
            <label>가져올 일정 구분</label>
            <div className="calendar-type-selector">
              <label className={`calendar-type-option ${excelImportType === 'PERSONAL' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="excelImportType"
                  value="PERSONAL"
                  checked={excelImportType === 'PERSONAL'}
                  onChange={(e) => setExcelImportType(e.target.value)}
                />
                개인 일정으로 추가
              </label>
              <label className={`calendar-type-option ${excelImportType === 'DEPARTMENT' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="excelImportType"
                  value="DEPARTMENT"
                  checked={excelImportType === 'DEPARTMENT'}
                  onChange={(e) => setExcelImportType(e.target.value)}
                />
                부서 공용 일정으로 추가
              </label>
            </div>
          </div>

          {excelWarnings.length > 0 && (
            <div className="calendar-excel-warning">
              {excelWarnings.length}개 행은 날짜 또는 제목이 없어 건너뛰었습니다. 행 번호: {excelWarnings.join(', ')}
            </div>
          )}

          <div className="calendar-excel-preview-list">
            {excelSchedules.map((schedule, index) => (
              <div key={`${schedule.title}-${schedule.startDate}-${index}`} className="calendar-excel-preview-item">
                <div className="calendar-excel-preview-title">{schedule.title}</div>
                <div className="calendar-excel-preview-meta">{summarizeSchedule(schedule)}</div>
                {schedule.description && <div className="calendar-excel-preview-desc">{schedule.description}</div>}
              </div>
            ))}
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={handleCancelExcelImport}>
              아니요
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleConfirmExcelImport}
              disabled={isImportingExcel}
            >
              {isImportingExcel ? '등록 중...' : '예, 등록합니다'}
            </button>
          </div>
        </div>
      </SimpleModal>

      <SchedulePopover 
        anchor={popoverAnchor}
        setAnchor={setPopoverAnchor}
        schedule={selectedSchedule}
        formData={formData}
        setFormData={setFormData}
        onUpdate={handleUpdateSchedule}
        onDelete={handleDeleteSchedule}
        onToggleTodo={handleToggleTodo}
        onClose={() => setPopoverAnchor(null)}
      />

      <SimpleModal open={!!moreEventsDate} onClose={() => setMoreEventsDate(null)} title={`${moreEventsDate ? formatDate(moreEventsDate) : ''} 전체 일정`}>
        <div className="schedule-list" style={{ padding: '10px 0', maxHeight: '50vh', overflowY: 'auto' }}>
          {moreEventsDate && getSchedulesForDate(moreEventsDate).map(schedule => (
            <div
              key={schedule.id}
              className={`schedule-item schedule-item--${getScheduleGroup(schedule)} ${schedule.isAiRecommendation ? `schedule-item--ai-${schedule.aiType}` : ''}`}
              style={schedule.isTodo && schedule.isCompleted ? { opacity: 0.6 } : {}}
              onClick={() => {
                setMoreEventsDate(null)
                handleEditSchedule(schedule)
              }}
            >
                          <div className="schedule-time">
                            {isMultiDaySchedule(schedule) ? (
                              `${schedule.startDate.slice(5)} ${normalizeTime(schedule.startTime)} ~ ${schedule.endDate.slice(5)} ${normalizeTime(schedule.endTime)}`
                            ) : (
                              `${normalizeTime(schedule.startTime)} ~ ${normalizeTime(schedule.endTime)}`
                            )}
                          </div>
              
              <div className="schedule-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {schedule.isTodo && (
                  <span 
                    onClick={(e) => {
                      e.stopPropagation()
                      handleToggleTodo(e, schedule)
                    }} 
                    style={{ cursor: 'pointer', fontSize: '18px', color: schedule.isCompleted ? '#10b981' : '#94a3b8', display: 'inline-flex' }}
                  >
                    {schedule.isCompleted ? <FiCheckSquare /> : <FiSquare />}
                  </span>
                )}
                <span style={{ textDecoration: (schedule.isTodo && schedule.isCompleted) ? 'line-through' : 'none' }}>
                  {schedule.title}
                </span>
              </div>
            </div>
          ))}
        </div>
      </SimpleModal>
    </div>
  )
}
