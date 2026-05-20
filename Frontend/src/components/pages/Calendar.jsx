import { useEffect, useMemo, useState } from 'react'
import { createSchedule, deleteSchedule, getSchedules } from '../../api/scheduleApi'

const SimpleModal = ({ open, onClose, title, children }) => {
  if (!open) return null

  return (
    <div className="modal-overlay">
      <div className="modal-content calendar-modal">
        <div className="modal-header">
          <h3>{title}</h3>
          <button onClick={onClose} className="modal-close">&times;</button>
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
export default function Calendar({ showSidebar = true }) {
  const [date, setDate] = useState(new Date())
  const [activeStartDate, setActiveStartDate] = useState(() => {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })
  const [selectedFilters, setSelectedFilters] = useState(['my', 'department', 'ai'])
  const [schedules, setSchedules] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    startDate: '',
    endDate: '',
    startTime: '09:00',
    endTime: '10:00',
    description: ''
  })
  const [selectedDate, setSelectedDate] = useState(null)

  const monthRange = useMemo(() => {
    const start = new Date(activeStartDate.getFullYear(), activeStartDate.getMonth(), 1)
    const end = new Date(activeStartDate.getFullYear(), activeStartDate.getMonth() + 1, 0)
    return { startDate: formatDate(start), endDate: formatDate(end) }
  }, [activeStartDate])

  const monthGrid = useMemo(() => {
    // Build a 6x7 grid for the active month view
    const year = activeStartDate.getFullYear()
    const month = activeStartDate.getMonth()
    const firstOfMonth = new Date(year, month, 1)
    const startWeekday = firstOfMonth.getDay() // 0..6 (Sun..Sat)

    // start from previous Sunday's date
    const gridStart = new Date(year, month, 1 - startWeekday)
    const cells = []
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i)
      cells.push(d)
    }
    return cells
  }, [activeStartDate])

  const fetchSchedules = async () => {
    try {
      setIsLoading(true)
      const res = await getSchedules(monthRange)
      setSchedules(res.data?.data || [])
    } catch (error) {
      console.error('일정 로드 실패', error)
      setSchedules([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchSchedules()
  }, [monthRange.startDate, monthRange.endDate])

  const getScheduleGroup = (schedule) => {
    const content = `${schedule.title || ''} ${schedule.description || ''}`.toLowerCase()

    if (/ai|추천|자동|생성|gpt/.test(content)) {
      return 'ai'
    }

    if (/부서|팀|회의|보고|공유|운영|협의|정기/.test(content)) {
      return 'department'
    }

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
    return schedules.filter((schedule) => selectedFilters.includes(getScheduleGroup(schedule)))
  }, [schedules, selectedFilters])

  const getSchedulesForDate = (d) => {
    const dateStr = formatDate(d)
    return filteredSchedules.filter((schedule) => {
      // 단일 날짜 일정
      if (schedule.date === dateStr) return true
      
      // 다중 날짜 일정 (startDate ~ endDate 범위)
      if (schedule.startDate && schedule.endDate) {
        return dateStr >= schedule.startDate && dateStr <= schedule.endDate
      }
      
      return false
    })
  }

  const resetForm = () => {
    setFormData({
      title: '',
      startDate: formatDate(selectedDate || date),
      endDate: formatDate(selectedDate || date),
      startTime: '09:00',
      endTime: '10:00',
      description: ''
    })
  }

  const handleAddSchedule = () => {
    setSelectedDate(new Date(date))
    resetForm()
    setIsModalOpen(true)
  }

  const handleDateChange = (nextDate) => {
    setDate(nextDate)
    setActiveStartDate(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1))
  }

  const handleSaveSchedule = async () => {
    if (!formData.title.trim()) {
      alert('일정 제목을 입력하세요')
      return
    }
    
    if (!formData.startDate || !formData.endDate) {
      alert('시작일과 종료일을 선택하세요')
      return
    }

    try {
      await createSchedule({
        startDate: formData.startDate,
        endDate: formData.endDate,
        title: formData.title,
        startTime: formData.startTime,
        endTime: formData.endTime,
        description: formData.description
      })
      setIsModalOpen(false)
      resetForm()
      fetchSchedules()
    } catch (error) {
      alert('일정 저장 실패: ' + (error.response?.data?.message || '오류가 발생했습니다.'))
    }
  }

  const handleDeleteSchedule = async (id) => {
    if (!window.confirm('이 일정을 삭제하시겠습니까?')) return

    try {
      await deleteSchedule(id)
      setSchedules((prev) => prev.filter((schedule) => schedule.id !== id))
    } catch (error) {
      alert('일정 삭제 실패: ' + (error.response?.data?.message || '오류가 발생했습니다.'))
    }
  }

  const tileClassName = ({ date: tileDate, view }) => {
    if (view !== 'month') return ''
    return getSchedulesForDate(tileDate).length > 0 ? 'calendar-date-with-schedule' : ''
  }

  const tileContent = ({ date: tileDate, view }) => {
    if (view !== 'month') return null
    const daySchedules = sortByTime(getSchedulesForDate(tileDate))
    if (daySchedules.length === 0) return null

    return (
      <div className="calendar-date-content">
        {daySchedules.slice(0, 3).map((schedule) => (
          <div
            key={schedule.id}
            className={`calendar-schedule-item calendar-schedule-item--${getScheduleGroup(schedule)}`}
            title={schedule.title}
          >
            {schedule.title}
          </div>
        ))}
        {daySchedules.length > 3 && <div className="calendar-schedule-overflow">+{daySchedules.length - 3}</div>}
      </div>
    )
  }

  const todaySchedules = sortByTime(getSchedulesForDate(date))

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
                AI추천
              </button>
            </div>
            <button className="btn btn-primary calendar-add-btn" onClick={handleAddSchedule}>
              + 새 일정
            </button>

          </div>

          <div className="calendar-grid">
            <div className="calendar-header-controls">
              <button
                type="button"
                className="btn"
                onClick={() => setActiveStartDate(new Date(activeStartDate.getFullYear(), activeStartDate.getMonth() - 1, 1))}
              >
                &lt;
              </button>
              <div className="calendar-current-month">
                {activeStartDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })}
              </div>
              <button
                type="button"
                className="btn"
                onClick={() => setActiveStartDate(new Date(activeStartDate.getFullYear(), activeStartDate.getMonth() + 1, 1))}
              >
                &gt;
              </button>
            </div>

            <div className="calendar-weekdays">
              {['일', '월', '화', '수', '목', '금', '토'].map((wd) => (
                <div key={wd} className="calendar-weekday">{wd}</div>
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

                return (
                  <div
                    key={cellDate.toISOString()}
                    className={classes.join(' ')}
                    onClick={() => handleDateChange(cellDate)}
                  >
                    <div className="calendar-cell-number">{cellDate.getDate()}</div>
                    <div className="calendar-cell-content">
                      {daySchedules.slice(0, 3).map((s) => {
                        let itemClasses = `calendar-schedule-item calendar-schedule-item--${getScheduleGroup(s)}`
                        
                        // 다중 날짜 일정인 경우 위치 표시
                        if (s.startDate && s.endDate) {
                          if (cellDateStr === s.startDate && cellDateStr === s.endDate) {
                            // 단일 날짜
                            itemClasses += ' calendar-schedule-single'
                          } else if (cellDateStr === s.startDate) {
                            // 시작 날짜
                            itemClasses += ' calendar-schedule-start'
                          } else if (cellDateStr === s.endDate) {
                            // 종료 날짜
                            itemClasses += ' calendar-schedule-end'
                          } else {
                            // 중간 날짜
                            itemClasses += ' calendar-schedule-middle'
                          }
                        }
                        
                        return (
                          <div
                            key={s.id}
                            className={itemClasses}
                            title={s.title}
                          >
                            {s.title}
                          </div>
                        )
                      })}
                      {daySchedules.length > 3 && (
                        <div className="calendar-schedule-overflow">+{daySchedules.length - 3}</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {showSidebar && (
          <div className="calendar-sidebar">
            <h2>{date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</h2>
            <div className="calendar-sidebar-count">총 {todaySchedules.length}개</div>

            {isLoading ? (
              <div className="schedule-empty">불러오는 중...</div>
            ) : todaySchedules.length > 0 ? (
              <div className="schedule-list">
                {todaySchedules.map((schedule) => (
                  <div key={schedule.id} className="schedule-item">
                    <div className="schedule-time">{normalizeTime(schedule.startTime)} ~ {normalizeTime(schedule.endTime)}</div>
                    <div className="schedule-title">{schedule.title}</div>
                    {schedule.description && <div className="schedule-desc">{schedule.description}</div>}
                    <button
                      className="schedule-delete-btn"
                      onClick={() => handleDeleteSchedule(schedule.id)}
                    >
                      삭제
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="schedule-empty">이 날짜에 일정이 없습니다</div>
            )}
          </div>
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
              placeholder="설명을 입력하세요(선택사항)"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="calendar-textarea"
              rows="4"
            />
          </div>

          <div className="form-actions">
            <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>취소</button>
            <button className="btn btn-primary" onClick={handleSaveSchedule}>저장</button>
          </div>
        </div>
      </SimpleModal>
    </div>
  )
}
