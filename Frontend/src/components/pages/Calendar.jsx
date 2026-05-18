import { useState, useEffect } from 'react'
import CalendarComponent from 'react-calendar'
import 'react-calendar/dist/Calendar.css'

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

export default function Calendar() {
  const [date, setDate] = useState(new Date())
  const [schedules, setSchedules] = useState(() => {
    const saved = localStorage.getItem('calendar_schedules')
    return saved ? JSON.parse(saved) : []
  })
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formData, setFormData] = useState({ title: '', startTime: '09:00', endTime: '10:00', description: '' })
  const [selectedDate, setSelectedDate] = useState(null)

  useEffect(() => {
    localStorage.setItem('calendar_schedules', JSON.stringify(schedules))
  }, [schedules])

  const formatDate = (d) => {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const getSchedulesForDate = (d) => {
    const dateStr = formatDate(d)
    return schedules.filter(s => s.date === dateStr)
  }

  const handleAddSchedule = () => {
    setSelectedDate(new Date(date))
    setFormData({ title: '', startTime: '09:00', endTime: '10:00', description: '' })
    setIsModalOpen(true)
  }

  const handleSaveSchedule = () => {
    if (!formData.title.trim()) {
      alert('일정 제목을 입력하세요')
      return
    }

    const newSchedule = {
      id: Date.now(),
      date: formatDate(selectedDate),
      title: formData.title,
      startTime: formData.startTime,
      endTime: formData.endTime,
      description: formData.description
    }

    setSchedules(prev => [...prev, newSchedule])
    setIsModalOpen(false)
    setFormData({ title: '', startTime: '09:00', endTime: '10:00', description: '' })
  }

  const handleDeleteSchedule = (id) => {
    if (window.confirm('이 일정을 삭제하시겠습니까?')) {
      setSchedules(prev => prev.filter(s => s.id !== id))
    }
  }

  const tileClassName = ({ date: tileDate, view }) => {
    if (view === 'month') {
      const hasSchedules = getSchedulesForDate(tileDate).length > 0
      return hasSchedules ? 'calendar-date-with-schedule' : ''
    }
    return ''
  }

  const tileContent = ({ date: tileDate, view }) => {
    if (view === 'month') {
      const daySchedules = getSchedulesForDate(tileDate)
      if (daySchedules.length > 0) {
        return (
          <div className="calendar-date-content">
            {daySchedules.slice(0, 2).map(s => (
              <div key={s.id} className="calendar-schedule-dot" title={s.title} />
            ))}
            {daySchedules.length > 2 && <div className="calendar-more">+{daySchedules.length - 2}</div>}
          </div>
        )
      }
    }
    return null
  }

  const todaySchedules = getSchedulesForDate(date)

  return (
    <div className="calendar-page">
      <div className="calendar-header">
        <h1>캘린더</h1>
        <button className="btn btn-primary" onClick={handleAddSchedule}>+ 새 일정</button>
      </div>

      <div className="calendar-container">
        <div className="calendar-wrapper">
          <CalendarComponent
            value={date}
            onChange={setDate}
            tileClassName={tileClassName}
            tileContent={tileContent}
            locale="ko-KR"
          />
        </div>

        <div className="calendar-sidebar">
          <h2>{date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</h2>

          {todaySchedules.length > 0 ? (
            <div className="schedule-list">
              {todaySchedules.map(schedule => (
                <div key={schedule.id} className="schedule-item">
                  <div className="schedule-time">{schedule.startTime} ~ {schedule.endTime}</div>
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
      </div>

      <SimpleModal open={isModalOpen} onClose={() => setIsModalOpen(false)} title="새 일정 추가">
        <div className="calendar-form">
          <div className="form-group">
            <label>일정 제목</label>
            <input
              type="text"
              placeholder="일정 제목을 입력하세요"
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              className="calendar-input"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>시작 시간</label>
              <input
                type="time"
                value={formData.startTime}
                onChange={(e) => setFormData({...formData, startTime: e.target.value})}
                className="calendar-input"
              />
            </div>
            <div className="form-group">
              <label>종료 시간</label>
              <input
                type="time"
                value={formData.endTime}
                onChange={(e) => setFormData({...formData, endTime: e.target.value})}
                className="calendar-input"
              />
            </div>
          </div>

          <div className="form-group">
            <label>설명</label>
            <textarea
              placeholder="설명을 입력하세요 (선택사항)"
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
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
