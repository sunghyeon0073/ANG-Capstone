import { useState, useEffect, useMemo } from 'react'
import { FiChevronLeft, FiChevronRight, FiCalendar, FiClock, FiCheckSquare, FiSquare } from 'react-icons/fi'
import { getSchedules, toggleCompleteSchedule } from '../../api/scheduleApi'

const formatDate = (d) => {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const normalizeTime = (time) => time?.slice(0, 5) || ''

const isSameDay = (date1, date2) => formatDate(date1) === formatDate(date2)

export default function HomeCalendar({ onNavigateToCalendar }) {
  const [activeStartDate, setActiveStartDate] = useState(() => {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [schedules, setSchedules] = useState([])
  const [isLoading, setIsLoading] = useState(false)

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
    
    const firstDayOfWeek = firstOfMonth.getDay()
    const daysInMonth = lastOfMonth.getDate()
    
    const totalCells = Math.ceil((firstDayOfWeek + daysInMonth) / 7) * 7
    const gridStart = new Date(year, month, 1 - firstDayOfWeek)
    
    const cells = []
    for (let i = 0; i < totalCells; i += 1) {
      cells.push(new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i))
    }
    return cells
  }, [activeStartDate])

  const fetchSchedules = async () => {
    try {
      setIsLoading(true)
      const res = await getSchedules(monthRange)
      setSchedules(Array.isArray(res.data?.data) ? res.data.data : [])
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

  const handleToggleTodo = async (e, schedule) => {
    if (e) e.stopPropagation()
    try {
      await toggleCompleteSchedule(schedule.id)
      fetchSchedules()
    } catch (error) {
      console.error('할 일 상태 변경 실패', error)
    }
  }

  const getScheduleGroup = (schedule) => {
    if (schedule.isAiRecommendation) return 'ai'
    if (schedule.isTodo === true || schedule.isTodo === 'true' || schedule.todo) return 'todo'
    if (schedule.type === 'DEPARTMENT') return 'dept'
    return 'personal'
  }

  const getSchedulesForDate = (d) => {
    const dateStr = formatDate(d)
    return schedules.filter((schedule) => {
      if (schedule.date === dateStr) return true
      if (schedule.startDate && schedule.endDate) {
        return dateStr >= schedule.startDate && dateStr <= schedule.endDate
      }
      return false
    })
  }

  const selectedDaySchedules = useMemo(() => {
    return getSchedulesForDate(selectedDate).sort((a, b) => {
      return (a.startTime || '00:00').localeCompare(b.startTime || '00:00')
    })
  }, [selectedDate, schedules])

  const goPrevMonth = () => {
    setActiveStartDate(new Date(activeStartDate.getFullYear(), activeStartDate.getMonth() - 1, 1))
  }
  const goNextMonth = () => {
    setActiveStartDate(new Date(activeStartDate.getFullYear(), activeStartDate.getMonth() + 1, 1))
  }
  const goToday = () => {
    const today = new Date()
    setActiveStartDate(new Date(today.getFullYear(), today.getMonth(), 1))
    setSelectedDate(today)
  }

  return (
    <div className="home-mini-calendar">
      <div className="home-mini-calendar-left">
        <div className="home-mini-calendar-header">
          <div className="home-mini-calendar-title">
            {activeStartDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })}
          </div>
          <div className="home-mini-calendar-nav">
            <button onClick={goPrevMonth}><FiChevronLeft /></button>
            <button onClick={goToday}>오늘</button>
            <button onClick={goNextMonth}><FiChevronRight /></button>
          </div>
        </div>
        
        <div className="home-mini-calendar-grid">
          <div className="home-mini-calendar-weekdays">
            {['일', '월', '화', '수', '목', '금', '토'].map(d => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="home-mini-calendar-cells">
            {monthGrid.map((cellDate, idx) => {
              const dateStr = formatDate(cellDate)
              const todayStr = formatDate(new Date())
              const isOtherMonth = cellDate.getMonth() !== activeStartDate.getMonth()
              const isSelected = isSameDay(cellDate, selectedDate)
              const isToday = dateStr === todayStr
              const daySchedules = getSchedulesForDate(cellDate)

              let className = 'home-mini-calendar-cell'
              if (isOtherMonth) className += ' other-month'
              if (isSelected) className += ' selected'
              if (isToday) className += ' today'
              
              // Only take up to 3 distinct groups to show as dots
              const groups = Array.from(new Set(daySchedules.map(getScheduleGroup))).slice(0, 3)

              return (
                <div key={idx} className={className} onClick={() => setSelectedDate(cellDate)}>
                  <span className="home-mini-calendar-date">{cellDate.getDate()}</span>
                  <div className="home-mini-calendar-dots">
                    {groups.map(g => <span key={g} className={`home-mini-calendar-dot dot-${g}`} />)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="home-mini-calendar-right">
        <div className="home-mini-calendar-selected-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FiCalendar />
            <span>{formatDate(selectedDate)} 일정</span>
          </div>
          {onNavigateToCalendar && (
            <button className="home-mini-calendar-more-btn" onClick={onNavigateToCalendar} title="캘린더로 이동">
              전체보기 <FiChevronRight />
            </button>
          )}
        </div>
        <div className="home-mini-calendar-list">
          {isLoading ? (
            <div className="home-mini-calendar-empty">불러오는 중...</div>
          ) : selectedDaySchedules.length > 0 ? (
            selectedDaySchedules.map(schedule => {
              const group = getScheduleGroup(schedule)
              return (
                <div key={schedule.id} className={`home-mini-schedule-item item-${group}`}>
                  <div className="home-mini-schedule-time">
                    <FiClock /> {normalizeTime(schedule.startTime)} ~ {normalizeTime(schedule.endTime)}
                  </div>
                  <div className="home-mini-schedule-title" style={{ display: 'flex', alignItems: 'center', gap: '6px', textDecoration: schedule.isTodo && schedule.isCompleted ? 'line-through' : 'none' }}>
                    {schedule.isTodo && (
                      <span 
                        style={{ display: 'inline-flex', alignItems: 'center', fontSize: '18px', color: schedule.isCompleted ? '#10b981' : '#94a3b8', cursor: 'pointer' }}
                        onClick={(e) => handleToggleTodo(e, schedule)}
                      >
                        {schedule.isCompleted ? <FiCheckSquare /> : <FiSquare />}
                      </span>
                    )}
                    {schedule.title}
                  </div>
                  {schedule.description && (
                    <div className="home-mini-schedule-desc">
                      {schedule.description}
                    </div>
                  )}
                </div>
              )
            })
          ) : (
            <div className="home-mini-calendar-empty">예정된 일정이 없습니다.</div>
          )}
        </div>
      </div>
    </div>
  )
}
