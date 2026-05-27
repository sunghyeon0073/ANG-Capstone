import { useEffect, useMemo, useState } from 'react'
import { FiChevronLeft, FiChevronRight, FiPlus, FiTrash2 } from 'react-icons/fi'
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

const sortByTime = (list) => {
  return [...list].sort((a, b) => (a.startTime || '00:00').localeCompare(b.startTime || '00:00'))
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

  const aiSchedules = useMemo(() => aiRecommendations.map(toAiSchedule), [aiRecommendations])

  const visibleSchedules = useMemo(() => {
    return [...schedules, ...aiSchedules]
  }, [schedules, aiSchedules])

  const fetchCalendarData = async () => {
    try {
      setIsLoading(true)
      const [scheduleRes, aiRes] = await Promise.all([
        getSchedules(monthRange),
        getAiScheduleRecommendations(monthRange),
      ])
      setSchedules(scheduleRes.data?.data || [])
      setAiRecommendations(aiRes.data?.data || [])
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
      await createSchedule({
        startDate: formData.startDate,
        endDate: formData.endDate,
        title: formData.title,
        startTime: formData.startTime,
        endTime: formData.endTime,
        description: formData.description,
      })
      setIsModalOpen(false)
      resetForm()
      fetchCalendarData()
    } catch (error) {
      alert(`일정 저장 실패: ${error.response?.data?.message || '오류가 발생했습니다.'}`)
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
  const todayAiSchedules = todaySchedules.filter((schedule) => schedule.isAiRecommendation)

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
                      {daySchedules.slice(0, 3).map((schedule) => {
                        let itemClasses = `calendar-schedule-item calendar-schedule-item--${getScheduleGroup(schedule)}`
                        if (schedule.isAiRecommendation) {
                          itemClasses += ` calendar-schedule-item--ai-${schedule.aiType}`
                        }

                        if (schedule.startDate && schedule.endDate && !schedule.isAiRecommendation) {
                          if (cellDateStr === schedule.startDate && cellDateStr === schedule.endDate) {
                            itemClasses += ' calendar-schedule-single'
                          } else if (cellDateStr === schedule.startDate) {
                            itemClasses += ' calendar-schedule-start'
                          } else if (cellDateStr === schedule.endDate) {
                            itemClasses += ' calendar-schedule-end'
                          } else {
                            itemClasses += ' calendar-schedule-middle'
                          }
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
            ) : todaySchedules.length > 0 ? (
              <div className="schedule-list">
                {todaySchedules.map((schedule) => (
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
          <div className="form-group">
            <label>일정 제목</label>
            <input
              type="text"
              placeholder="일정 제목을 입력하세요"
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
    </div>
  )
}
