import { useState } from 'react'
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi'

export default function MonthYearPicker({ activeStartDate, onSelect, onClose }) {
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
