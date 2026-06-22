import { useRef } from 'react'
import { FiCalendar, FiMenu, FiTrash2 } from 'react-icons/fi'

export default function SchedulePopover({ anchor, setAnchor, schedule, formData, setFormData, onUpdate, onDelete, onToggleTodo, onClose }) {
  const dragStateRef = useRef(null)

  if (!anchor || !schedule) return null

  const handlePointerDown = (e) => {
    // 버튼이나 입력창 클릭 시에는 드래그를 시작하지 않음
    if (e.target.closest('button') || e.target.closest('input') || e.target.closest('textarea')) return

    const header = e.target.closest('.popover-header')
    if (header) {
      dragStateRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        originTop: anchor.top,
        originLeft: anchor.left,
      }
      e.currentTarget.setPointerCapture(e.pointerId)
    }
  }

  const handlePointerMove = (e) => {
    if (!dragStateRef.current || dragStateRef.current.pointerId !== e.pointerId) return
    setAnchor({
      top: dragStateRef.current.originTop + (e.clientY - dragStateRef.current.startY),
      left: dragStateRef.current.originLeft + (e.clientX - dragStateRef.current.startX),
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
          top: anchor.top, left: anchor.left, position: 'fixed', zIndex: 1100,
          background: '#fff', width: '380px', borderRadius: '24px',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.05)',
          padding: '24px', animation: 'popoverIn 0.3s cubic-bezier(0.34,1.56,0.64,1)',
          fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
          touchAction: 'none',
        }}
      >
        <div className="popover-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center', cursor: 'move', userSelect: 'none' }}>
          <div className="popover-type-badge" style={{ fontSize: '13px', fontWeight: '700', padding: '6px 12px', borderRadius: '12px', background: typeStyle.background, color: typeStyle.color, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>{typeStyle.icon}</span>
            <span>{getTypeText()}</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {!isAi && (
              <button
                type="button"
                onClick={(e) => onDelete(e, schedule)}
                style={{ background: '#fff1f2', border: 'none', color: '#e11d48', cursor: 'pointer', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '10px', transition: 'all 0.2s' }}
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
              style={{ fontSize: '22px', fontWeight: '800', border: 'none', padding: '0', width: '100%', outline: 'none', color: '#1e293b', background: 'transparent', letterSpacing: '-0.5px', fontFamily: 'inherit' }}
              placeholder="제목을 입력하세요"
            />
          </div>

          <div className="popover-time-info" style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: '#f8fafc', padding: '16px', borderRadius: '16px' }}>
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
                <input type="time" value={formData.startTime} onChange={(e) => setFormData({ ...formData, startTime: e.target.value })} style={{ border: 'none', outline: 'none', background: 'transparent', cursor: 'pointer', fontWeight: '700', color: '#1e293b', fontFamily: 'inherit' }} />
                <span style={{ color: '#cbd5e1' }}>~</span>
                <input type="time" value={formData.endTime} onChange={(e) => setFormData({ ...formData, endTime: e.target.value })} style={{ border: 'none', outline: 'none', background: 'transparent', cursor: 'pointer', fontWeight: '700', color: '#1e293b', fontFamily: 'inherit' }} />
              </div>
            </div>
          </div>

          <div className="popover-memo-wrapper">
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#94a3b8', marginBottom: '6px', marginLeft: '4px' }}>MEMO</div>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="여기에 메모를 남겨보세요..."
              style={{ width: '100%', minHeight: '100px', border: '1px solid #f1f5f9', borderRadius: '16px', padding: '14px', fontSize: '14px', lineHeight: '1.6', resize: 'none', background: '#fff', outline: 'none', color: '#334155', transition: 'all 0.2s', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)', fontFamily: 'inherit' }}
              onFocus={(e) => { e.target.style.borderColor = 'var(--color-primary-light, #e2e8f0)'; e.target.style.boxShadow = '0 0 0 4px rgba(59,130,246,0.05)' }}
              onBlur={(e) => { e.target.style.borderColor = '#f1f5f9'; e.target.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.02)' }}
            />
          </div>
        </div>

        <div className="popover-footer" style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          {isTodo && (
            <button
              className={`btn ${schedule.isCompleted ? 'btn-secondary' : 'btn-success'}`}
              onClick={(e) => { onToggleTodo(e, schedule); onClose() }}
              style={{ marginRight: 'auto', background: schedule.isCompleted ? '#f1f5f9' : '#dcfce7', color: schedule.isCompleted ? '#64748b' : '#15803d', border: 'none', padding: '10px 16px', borderRadius: '12px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              {schedule.isCompleted ? '진행중으로' : '완료하기'}
            </button>
          )}
          <button type="button" onClick={onClose} style={{ padding: '10px 18px', borderRadius: '12px', fontSize: '14px', fontWeight: '600', background: '#f8fafc', border: 'none', color: '#64748b', cursor: 'pointer' }}>취소</button>
          <button type="button" onClick={onUpdate} style={{ padding: '10px 24px', borderRadius: '12px', fontSize: '14px', fontWeight: '700', background: 'var(--color-primary, #3b82f6)', color: '#fff', border: 'none', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(59,130,246,0.2)' }}>저장</button>
        </div>
      </div>
    </>
  )
}
