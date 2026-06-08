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
  FiCalendar
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
    const startDate = toDateStringFromValue(
      getCellValueByAliases(row, ['시작일', 'startDate', '시작날짜']),
    ) || toDateStringFromValue(getCellValueByAliases(row, ['date', '날짜', '일자', '일정일']))
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
    
    const extraInfos = []
    if (gubun) extraInfos.push(`[${gubun}]`)
    if (workGubun) extraInfos.push(`[${workGubun}]`)
    
    if (extraInfos.length > 0) {
      const extraStr = extraInfos.join(' ')
      description = description ? `${extraStr}\n${description}` : extraStr
    }

    if (!title || !startDate) {
      skippedRows.push(index + 2)
      return
    }

    items.push({
      title,
      startDate,
      endDate,
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
        const durA = a.endCol - a.startCol;
        const durB = b.endCol - b.startCol;
        if (durB !== durA) return durB - durA; // Multi-day first
        if (a.startCol !== b.startCol) return a.startCol - b.startCol; // Earlier first
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
  
  const [sidebarTab, setSidebarTab] = useState('DAILY') // Kept for logic, but tabs are removed
  const [quickTodoTitle, setQuickTodoTitle] = useState('')
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

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
    return visibleSchedules.filter((schedule) => selectedFilters.includes(getScheduleGroup(schedule)))
  }, [visibleSchedules, selectedFilters])

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

  const handleEditSchedule = (schedule) => {
    setSelectedSchedule(schedule)
    setFormData({
      title: schedule.title,
      startDate: schedule.startDate,
      endDate: schedule.endDate,
      startTime: normalizeTime(schedule.startTime),
      endTime: normalizeTime(schedule.endTime),
      description: schedule.description || '',
      type: schedule.type || 'PERSONAL',
      entryMode: schedule.isTodo ? 'TODO' : 'EVENT',
      repeatType: schedule.repeatType || 'NONE',
      repeatEndDate: schedule.repeatEndDate || ''
    })
    setIsDetailModalOpen(true)
  }

  const handleUpdateSchedule = async () => {
    if (!selectedSchedule) return
    try {
      await updateSchedule(selectedSchedule.id, buildSchedulePayload(formData))
      setIsDetailModalOpen(false)
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
      await Promise.all(excelSchedules.map((schedule) => createSchedule(buildSchedulePayload(schedule))))
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
      setIsDetailModalOpen(false)
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

  const pendingTodos = filteredSchedules.filter(s => s.isTodo && !s.isCompleted).length
  const completedTodos = filteredSchedules.filter(s => s.isTodo && s.isCompleted).length
  const totalEvents = filteredSchedules.filter(s => !s.isTodo && !s.isAiRecommendation).length

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
              onClick={() => setActiveStartDate(new Date(activeStartDate.getFullYear(), activeStartDate.getMonth() - 1, 1))}
              aria-label="이전 달"
            >
              <FiChevronLeft aria-hidden="true" />
            </button>
            <div 
              className="calendar-current-month" 
              onClick={() => setIsMonthPickerOpen(!isMonthPickerOpen)}
              style={{ cursor: 'pointer' }}
            >
              {activeStartDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })}
            </div>
            {isMonthPickerOpen && (
              <MonthYearPicker 
                activeStartDate={activeStartDate} 
                onSelect={(year, month) => {
                  setActiveStartDate(new Date(year, month, 1))
                  setIsMonthPickerOpen(false)
                }}
                onClose={() => setIsMonthPickerOpen(false)}
              />
            )}
            <button
              type="button"
              className="btn calendar-icon-btn"
              onClick={() => setActiveStartDate(new Date(activeStartDate.getFullYear(), activeStartDate.getMonth() + 1, 1))}
              aria-label="다음 달"
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
          </div>
        </div>

        <div className="header-right">
          <div className="header-summary" title="이번 달 요약">
            <div className="header-stat-item">
              <FiAlertCircle className="header-stat-icon header-stat-icon--pending" />
              <span className="header-stat-value">{pendingTodos}</span>
              <span className="header-stat-label">남은 할 일</span>
            </div>
            <div className="header-stat-item">
              <FiCheckCircle className="header-stat-icon header-stat-icon--completed" />
              <span className="header-stat-value">{completedTodos}</span>
              <span className="header-stat-label">완료한 일</span>
            </div>
            <div className="header-stat-item">
              <FiCalendar className="header-stat-icon header-stat-icon--total" />
              <span className="header-stat-value">{totalEvents}</span>
              <span className="header-stat-label">전체 일정</span>
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
                              !schedule.isTodo ? (
                                `${normalizeTime(schedule.startTime)} ~ ${normalizeTime(schedule.endTime)}`
                              ) : (
                                `${normalizeTime(schedule.startTime)}`
                              )
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
                    onClick={() => handleDateChange(cellDate)}
                  >
                    <span className="calendar-cell-number">{cellDate.getDate()}</span>
                    <span className="calendar-cell-content" style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}>
                      {hiddenCount > 0 && (
                        <span className="calendar-schedule-overflow">+{hiddenCount}개 더보기</span>
                      )}
                    </span>
                  </button>
                )
              })}
              <div className="calendar-schedule-bars" aria-hidden="true" style={{ pointerEvents: 'none' }}>
                {calendarScheduleBars.filter(bar => bar.lane < 3).map((bar) => {
                  const duration = bar.endCol - bar.startCol + 1
                  const segmentType = bar.isFirstSegment && bar.isLastSegment
                    ? 'single'
                    : bar.isFirstSegment
                      ? 'start'
                      : bar.isLastSegment
                        ? 'end'
                        : 'middle'

                  const schedule = bar.schedule
                  
                  // Sync zoom state
                  const isBarSelected = selectedDateStr && (
                    (schedule.startDate === selectedDateStr) ||
                    (schedule.endDate === selectedDateStr) ||
                    (selectedDateStr >= schedule.startDate && selectedDateStr <= schedule.endDate)
                  );

                  let itemClasses = `calendar-schedule-bar calendar-schedule-bar--${getScheduleGroup(schedule)} calendar-schedule-bar--${segmentType}`
                  if (isBarSelected) itemClasses += ' is-selected';
                  
                  if (schedule.isAiRecommendation) {
                    itemClasses += ` calendar-schedule-bar--ai-${schedule.aiType}`
                  }

                  const topPos = `calc(${((bar.row - 1) / rowCount) * 100}% + ${32 + (bar.lane * 28)}px)`

                  if (schedule.isTodo) {
                    itemClasses += ' calendar-schedule-item--todo'
                    return (
                      <div
                        key={bar.key}
                        className={`${itemClasses} ${schedule.isCompleted ? 'todo-completed' : ''}`}
                        style={{
                          left: `calc(${((bar.startCol - 1) / 7) * 100}% + 4px)`,
                          width: `calc(${(duration / 7) * 100}% - 8px)`,
                          top: topPos,
                          pointerEvents: 'auto',
                          cursor: 'pointer',
                          textDecoration: schedule.isCompleted ? 'line-through' : 'none'
                        }}
                        title={schedule.title}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditSchedule(schedule);
                        }}
                      >
                        <span style={{ 
                          marginRight: '5px', 
                          fontSize: '14px',
                          color: schedule.isCompleted ? 'inherit' : '#10b981'
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleTodo(schedule);
                        }}>
                          {schedule.isCompleted ? '☑' : '☐'}
                        </span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{schedule.title}</span>
                      </div>
                    )
                  }

                  return (
                    <div
                      key={bar.key}
                      className={itemClasses}
                      style={{
                        left: `calc(${((bar.startCol - 1) / 7) * 100}% + 4px)`,
                        width: `calc(${(duration / 7) * 100}% - 8px)`,
                        top: topPos,
                        pointerEvents: 'auto',
                        cursor: 'pointer'
                      }}
                      title={schedule.title}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditSchedule(schedule);
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{schedule.title}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
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
                  onChange={(e) => setFormData({ ...formData, entryMode: e.target.value })}
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

          {formData.entryMode === 'TODO' ? (
            <div className="form-group">
              <label>마감 시간</label>
              <input
                type="time"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value, startTime: e.target.value })}
                className="calendar-input"
              />
            </div>
          ) : (
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
                <label>종료 시간</label>
                <input
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  className="calendar-input"
                />
              </div>
            </div>
          )}
          
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

      <SimpleModal open={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} title="일정 상세 및 수정">
        <div className="calendar-form">
          <div className="form-actions" style={{ justifyContent: 'space-between', marginBottom: '20px', borderBottom: '1px solid var(--color-border)', paddingBottom: '15px' }}>
            <button 
              type="button" 
              className="btn btn-danger" 
              onClick={(e) => handleDeleteSchedule(e, selectedSchedule)}
            >
              삭제
            </button>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsDetailModalOpen(false)}>닫기</button>
              <button type="button" className="btn btn-primary" onClick={handleUpdateSchedule}>수정 저장</button>
            </div>
          </div>

          <div style={{ 
            marginBottom: '20px', 
            padding: '12px', 
            background: 'var(--color-surface-muted)', 
            borderRadius: '10px',
            fontSize: '14px', 
            fontWeight: '600',
            color: 'var(--color-text)' 
          }}>
            <FiCalendar style={{ marginRight: '8px', verticalAlign: 'middle' }} />
            {formData.startDate} ({getDayOfWeek(formData.startDate)})
            {formData.startDate !== formData.endDate && ` ~ ${formData.endDate} (${getDayOfWeek(formData.endDate)})`}
            {formData.startTime && ` | ${formData.startTime} ~ ${formData.endTime}`}
          </div>

          <div className="form-group">
            <label>제목</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="calendar-input"
              placeholder="일정 제목"
            />
          </div>

          <div className="form-group">
            <label>설명</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="calendar-textarea"
              rows="6"
              placeholder="상세 설명"
            />
          </div>
        </div>
      </SimpleModal>
    </div>
  )
}
