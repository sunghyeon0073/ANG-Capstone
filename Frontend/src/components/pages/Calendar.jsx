import { useEffect, useMemo, useState } from 'react'
import CalendarComponent from 'react-calendar'
import 'react-calendar/dist/Calendar.css'
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

export default function Calendar() {
  const [date, setDate] = useState(new Date())
  const [schedules, setSchedules] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formData, setFormData] = useState({ title: '', startTime: '09:00', endTime: '10:00', description: '' })
  const [selectedDate, setSelectedDate] = useState(null)

  const monthRange = useMemo(() => {
    const start = new Date(date.getFullYear(), date.getMonth(), 1)
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0)
    return { startDate: formatDate(start), endDate: formatDate(end) }
  }, [date])

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

  const getSchedulesForDate = (d) => {
    const dateStr = formatDate(d)
    return schedules.filter((schedule) => schedule.date === dateStr)
  }

  const handleAddSchedule = () => {
    setSelectedDate(new Date(date))
    setFormData({ title: '', startTime: '09:00', endTime: '10:00', description: '' })
    setIsModalOpen(true)
  }

  const handleSaveSchedule = async () => {
    if (!formData.title.trim()) {
      alert('일정 제목을 입력하세요')
      return
    }

    try {
      await createSchedule({
        date: formatDate(selectedDate),
        title: formData.title,
        startTime: formData.startTime,
        endTime: formData.endTime,
        description: formData.description
      })
      setIsModalOpen(false)
      setFormData({ title: '', startTime: '09:00', endTime: '10:00', description: '' })
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

    const daySchedules = getSchedulesForDate(tileDate)
    if (daySchedules.length === 0) return null

    return (
      <div className="calendar-date-content">
        {daySchedules.slice(0, 2).map((schedule) => (
          <div key={schedule.id} className="calendar-schedule-dot" title={schedule.title} />
        ))}
        {daySchedules.length > 2 && <div className="calendar-more">+{daySchedules.length - 2}</div>}
      </div>
    )
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
