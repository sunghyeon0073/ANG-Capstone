import { useEffect, useMemo, useRef, useState } from 'react'
import { FiChevronLeft, FiChevronRight, FiPlus, FiTrash2 } from 'react-icons/fi'
import * as XLSX from 'xlsx'
import {
  createSchedule,
  deleteSchedule,
  getAiScheduleRecommendations,
  getSchedules,
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
      getCellValueByAliases(row, ['title', '일정명', '제목', '행사명', '내용']) || '',
    ).trim()
    const startDate = toDateStringFromValue(
      getCellValueByAliases(row, ['startDate', '시작일', '시작날짜']),
    ) || toDateStringFromValue(getCellValueByAliases(row, ['date', '날짜', '일자', '일정일']))
    const endDate = toDateStringFromValue(
      getCellValueByAliases(row, ['endDate', '종료일', '종료날짜']),
    ) || startDate
    const startTime = toTimeStringFromValue(
      getCellValueByAliases(row, ['startTime', '시작시간', '시작시각']),
    ) || '09:00'
    const endTime = toTimeStringFromValue(
      getCellValueByAliases(row, ['endTime', '종료시간', '종료시각']),
    ) || '10:00'
    const description = String(
      getCellValueByAliases(row, ['description', '설명', '메모', '비고', '내용']) || '',
    ).trim()

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
  if (!isMultiDaySchedule(schedule)) return []

  const segments = []
  let currentSegment = null

  gridDates.forEach((cellDate, index) => {
    const cellDateStr = formatDate(cellDate)
    if (cellDateStr < schedule.startDate || cellDateStr > schedule.endDate) return

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
      .sort((a, b) => a.startCol - b.startCol || a.endCol - b.endCol)
      .forEach((segment) => {
        let laneIndex = laneEnds.findIndex((endCol) => endCol < segment.startCol)
        if (laneIndex === -1) laneIndex = laneEnds.length
        laneEnds[laneIndex] = segment.endCol
        bars.push({ ...segment, lane: laneIndex })
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
      : `예정일: ${recommendation.sourceStartDate} ${recommendation.sourceTitle}`,
  isAiRecommendation: true,
  aiType: recommendation.type,
  sourceTitle: recommendation.sourceTitle,
})

export default function Calendar({ showSidebar = true }) {
  const excelInputRef = useRef(null)
  const [date, setDate] = useState(new Date())
  const [activeStartDate, setActiveStartDate] = useState(() => {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })
  const [selectedFilters, setSelectedFilters] = useState(['my', 'department', 'ai'])
  const [schedules, setSchedules] = useState([])
  const [aiRecommendations, setAiRecommendations] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    startDate: '',
    endDate: '',
    startTime: '09:00',
    endTime: '10:00',
    description: '',
  })
  const [selectedDate, setSelectedDate] = useState(null)
  const [isExcelConfirmOpen, setIsExcelConfirmOpen] = useState(false)
  const [excelSchedules, setExcelSchedules] = useState([])
  const [excelFileName, setExcelFileName] = useState('')
  const [excelWarnings, setExcelWarnings] = useState([])
  const [isImportingExcel, setIsImportingExcel] = useState(false)

  const monthRange = useMemo(() => {
    const start = new Date(activeStartDate.getFullYear(), activeStartDate.getMonth(), 1)
    const end = new Date(activeStartDate.getFullYear(), activeStartDate.getMonth() + 1, 0)
    return { startDate: formatDate(start), endDate: formatDate(end) }
  }, [activeStartDate])

  const monthGrid = useMemo(() => {
    const year = activeStartDate.getFullYear()
    const month = activeStartDate.getMonth()
    const firstOfMonth = new Date(year, month, 1)
    const gridStart = new Date(year, month, 1 - firstOfMonth.getDay())
    const cells = []

    for (let i = 0; i < 42; i += 1) {
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
    // 우선 기존 서버에서 온 schedules를 넣고, AI 추천은 id 중복이 없을 때만 추가
    baseSchedules.forEach((s) => map.set(s.id, s))
    baseAiSchedules.forEach((s) => {
      if (!map.has(s.id)) map.set(s.id, s)
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

    const content = `${schedule.title || ''} ${schedule.description || ''}`.toLowerCase()
    if (/부서|팀|회의|보고|공유|운영|정기/.test(content)) return 'department'
    return 'my'
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
    })
  }

  const handleAddSchedule = () => {
    const nextSelectedDate = new Date(date)
    setSelectedDate(nextSelectedDate)
    resetForm(nextSelectedDate)
    setIsModalOpen(true)
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

  const handleDeleteSchedule = async (schedule) => {
    if (schedule.isAiRecommendation) return
    if (!window.confirm('이 일정을 삭제하시겠습니까?')) return

    try {
      await deleteSchedule(schedule.id)
      setSchedules((prev) => prev.filter((item) => item.id !== schedule.id))
    } catch (error) {
      alert(`일정 삭제 실패: ${error.response?.data?.message || '오류가 발생했습니다.'}`)
    }
  }

  const todaySchedules = sortByTime(getSchedulesForDate(date))
  const todayDetailSchedules = todaySchedules.filter((schedule) => !schedule.isAiRecommendation)
  const todayAiSchedules = sortByTime(
    aiSchedules.filter((schedule) => {
      const dateStr = formatDate(date)
      return schedule.startDate === dateStr || (schedule.startDate && schedule.endDate && dateStr >= schedule.startDate && dateStr <= schedule.endDate)
    }),
  )

  return (
    <div className="calendar-page">
      <div className="calendar-container">
        <div className="calendar-wrapper">
          <div className="calendar-toolbar">
            <div className="calendar-filter-group" role="group" aria-label="일정 필터">
              <button
                type="button"
                className={`calendar-filter-pill ${selectedFilters.includes('my') ? 'active' : ''}`}
                onClick={() => toggleFilter('my')}
                aria-pressed={selectedFilters.includes('my')}
              >
                <span className="calendar-filter-check" aria-hidden="true" />
                내 일정
              </button>
              <button
                type="button"
                className={`calendar-filter-pill ${selectedFilters.includes('department') ? 'active' : ''}`}
                onClick={() => toggleFilter('department')}
                aria-pressed={selectedFilters.includes('department')}
              >
                <span className="calendar-filter-check" aria-hidden="true" />
                부서 일정
              </button>
              <button
                type="button"
                className={`calendar-filter-pill ${selectedFilters.includes('ai') ? 'active' : ''}`}
                onClick={() => toggleFilter('ai')}
                aria-pressed={selectedFilters.includes('ai')}
              >
                <span className="calendar-filter-check" aria-hidden="true" />
                AI 추천
              </button>
            </div>
            <button type="button" className="btn btn-primary calendar-add-btn" onClick={handleAddSchedule}>
              <FiPlus aria-hidden="true" />
              일정 추가
            </button>
          </div>

          <div className="calendar-grid">
            <div className="calendar-header-controls">
              <button
                type="button"
                className="btn calendar-icon-btn"
                onClick={() => setActiveStartDate(new Date(activeStartDate.getFullYear(), activeStartDate.getMonth() - 1, 1))}
                aria-label="이전 달"
              >
                <FiChevronLeft aria-hidden="true" />
              </button>
              <div className="calendar-current-month">
                {activeStartDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })}
              </div>
              <button
                type="button"
                className="btn calendar-icon-btn"
                onClick={() => setActiveStartDate(new Date(activeStartDate.getFullYear(), activeStartDate.getMonth() + 1, 1))}
                aria-label="다음 달"
              >
                <FiChevronRight aria-hidden="true" />
              </button>
            </div>

            <div className="calendar-weekdays">
              {['일', '월', '화', '수', '목', '금', '토'].map((weekday) => (
                <div key={weekday} className="calendar-weekday">{weekday}</div>
              ))}
            </div>

            <div className="calendar-cells">
              {monthGrid.map((cellDate) => {
                const classes = ['calendar-cell']
                const daySchedules = sortByTime(getSchedulesForDate(cellDate))
                const cellSchedules = daySchedules.filter((schedule) => !isMultiDaySchedule(schedule))
                const cellDateStr = formatDate(cellDate)

                if (cellDate.getMonth() !== activeStartDate.getMonth()) classes.push('calendar-cell--other')
                if (cellDateStr === formatDate(date)) classes.push('calendar-cell--selected')
                if (daySchedules.length > 0) classes.push('calendar-date-with-schedule')
                if (daySchedules.some((item) => item.isAiRecommendation)) classes.push('calendar-cell--has-ai')

                return (
                  <button
                    type="button"
                    key={cellDate.toISOString()}
                    className={classes.join(' ')}
                    onClick={() => handleDateChange(cellDate)}
                  >
                    <span className="calendar-cell-number">{cellDate.getDate()}</span>
                    <span className="calendar-cell-content">
                      {cellSchedules.slice(0, 3).map((schedule) => {
                        let itemClasses = `calendar-schedule-item calendar-schedule-item--${getScheduleGroup(schedule)}`
                        if (schedule.isAiRecommendation) {
                          itemClasses += ` calendar-schedule-item--ai-${schedule.aiType}`
                        }

                        return (
                          <span key={schedule.id} className={itemClasses} title={schedule.title}>
                            {schedule.title}
                          </span>
                        )
                      })}
                      {daySchedules.length > 3 && (
                        <span className="calendar-schedule-overflow">+{daySchedules.length - 3}</span>
                      )}
                    </span>
                  </button>
                )
              })}
              <div className="calendar-schedule-bars" aria-hidden="true">
                {calendarScheduleBars.map((bar) => {
                  const duration = bar.endCol - bar.startCol + 1
                  const segmentType = bar.isFirstSegment && bar.isLastSegment
                    ? 'single'
                    : bar.isFirstSegment
                      ? 'start'
                      : bar.isLastSegment
                        ? 'end'
                        : 'middle'

                  return (
                    <div
                      key={bar.key}
                      className={`calendar-schedule-bar calendar-schedule-bar--${getScheduleGroup(bar.schedule)} calendar-schedule-bar--${segmentType}`}
                      style={{
                        left: `${((bar.startCol - 1) / 7) * 100}%`,
                        width: `${(duration / 7) * 100}%`,
                        top: `${((bar.row - 1) * 150) + 34 + (bar.lane * 28)}px`,
                      }}
                      title={bar.schedule.title}
                    >
                      {bar.schedule.title}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {showSidebar && (
          <aside className="calendar-sidebar">
            <h2>{date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</h2>
            <div className="calendar-sidebar-count">총 {todaySchedules.length}개</div>

            {todayAiSchedules.length > 0 && (
              <div className="calendar-ai-panel" aria-label="AI 일정 추천">
                {todayAiSchedules.map((schedule) => (
                  <div key={schedule.id} className={`calendar-ai-card calendar-ai-card--${schedule.aiType}`}>
                    <div className="calendar-ai-label">
                      {schedule.aiType === 'last-year' ? '작년 기록 기반' : '다가오는 일정'}
                    </div>
                    <div className="calendar-ai-message">{schedule.title}</div>
                    <div className="calendar-ai-meta">{schedule.description}</div>
                  </div>
                ))}
              </div>
            )}

            {isLoading ? (
              <div className="schedule-empty">불러오는 중...</div>
            ) : todayDetailSchedules.length > 0 ? (
              <div className="schedule-list">
                {todayDetailSchedules.map((schedule) => (
                  <div
                    key={schedule.id}
                    className={`schedule-item ${schedule.isAiRecommendation ? `schedule-item--ai schedule-item--ai-${schedule.aiType}` : ''}`}
                  >
                    <div className="schedule-time">{normalizeTime(schedule.startTime)} ~ {normalizeTime(schedule.endTime)}</div>
                    <div className="schedule-title">{schedule.title}</div>
                    {schedule.description && <div className="schedule-desc">{schedule.description}</div>}
                    {!schedule.isAiRecommendation && (
                      <button
                        type="button"
                        className="schedule-delete-btn"
                        onClick={() => handleDeleteSchedule(schedule)}
                        aria-label={`${schedule.title} 삭제`}
                      >
                        <FiTrash2 aria-hidden="true" />
                        삭제
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="schedule-empty">선택한 날짜에 일정이 없습니다.</div>
            )}
          </aside>
        )}
      </div>

      <SimpleModal open={isModalOpen} onClose={() => setIsModalOpen(false)} title="새 일정 추가">
        <div className="calendar-form">
          <input
            ref={excelInputRef}
            type="file"
            accept=".xls,.xlsx"
            className="calendar-excel-input"
            onChange={handleExcelFileChange}
          />

          <div className="calendar-excel-upload">
            <div>
              <div className="calendar-excel-upload-title">엑셀로 일정 등록</div>
              <div className="calendar-excel-upload-desc">
                날짜, 제목, 시작시간, 종료시간, 설명 컬럼을 인식해 일정을 자동으로 읽어옵니다.
              </div>
            </div>
            <button
              type="button"
              className="btn btn-secondary calendar-excel-upload-btn"
              onClick={openExcelPicker}
              disabled={isImportingExcel}
            >
              {isImportingExcel ? '읽는 중...' : '엑셀 파일 업로드'}
            </button>
          </div>

          <div className="calendar-excel-template">
            예시 컬럼: 날짜, 제목, 시작시간, 종료시간, 설명
          </div>

          <div className="form-group">
            <label>일정 제목</label>
            <input
              type="text"
              placeholder="일정 제목을 입력하세요"
              maxLength={200}
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="calendar-input"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>시작일</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="calendar-input"
              />
            </div>
            <div className="form-group">
              <label>종료일</label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="calendar-input"
              />
            </div>
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
              <label>종료 시간</label>
              <input
                type="time"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                className="calendar-input"
              />
            </div>
          </div>

          <div className="form-group">
            <label>설명</label>
            <textarea
              placeholder="설명을 입력하세요. 선택 사항입니다."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="calendar-textarea"
              rows="4"
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
    </div>
  )
}
