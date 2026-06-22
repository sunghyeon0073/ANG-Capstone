import * as XLSX from 'xlsx'

export const formatDate = (d) => {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const normalizeTime = (time) => time?.slice(0, 5) || ''

export const isValidDateString = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || '')

export const isValidTimeString = (value) => /^\d{2}:\d{2}$/.test(normalizeTime(value || ''))

export const toApiTime = (value) => {
  const normalized = normalizeTime(value)
  return normalized ? `${normalized}:00` : ''
}

export const buildSchedulePayload = (formData) => {
  const startDate = String(formData.startDate || '').trim()
  const endDate = String(formData.endDate || '').trim()
  const startTime = String(formData.startTime || '').trim()
  const endTime = String(formData.endTime || '').trim()
  const title = String(formData.title || '').trim()
  const description = String(formData.description || '').trim() || null

  if (!title) throw new Error('일정 제목을 입력해주세요.')
  if (title.length > 200) throw new Error('일정 제목은 200자 이내로 입력해주세요.')
  if (!isValidDateString(startDate) || !isValidDateString(endDate)) throw new Error('시작일과 종료일 형식이 올바르지 않습니다.')
  if (!isValidTimeString(startTime) || !isValidTimeString(endTime)) throw new Error('시작 시간과 종료 시간 형식이 올바르지 않습니다.')
  if (startDate > endDate) throw new Error('시작일은 종료일보다 늦을 수 없습니다.')
  if (startDate === endDate && startTime > endTime) throw new Error('같은 날짜의 일정은 시작 시간이 종료 시간보다 늦을 수 없습니다.')

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
    repeatEndDate: (formData.repeatType && formData.repeatType !== 'NONE' && formData.repeatEndDate)
      ? formData.repeatEndDate
      : null,
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
  if (value instanceof Date && !Number.isNaN(value.getTime())) return formatDate(value)
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
    return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`
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

export const parseExcelSchedules = (arrayBuffer) => {
  const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true })
  const firstSheetName = workbook.SheetNames[0]
  if (!firstSheetName) throw new Error('엑셀 파일에 시트가 없습니다.')

  const worksheet = workbook.Sheets[firstSheetName]
  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: true })
  const items = []
  const skippedRows = []

  rows.forEach((row, index) => {
    const title = String(getCellValueByAliases(row, ['세부업무', 'title', '일정명', '제목', '행사명', '내용']) || '').trim()
    const rawDate = getCellValueByAliases(row, ['시작일', 'startDate', '시작날짜', 'date', '날짜', '일자', '일정일'])
    const startDate = toDateStringFromValue(rawDate)
    const endDate = toDateStringFromValue(getCellValueByAliases(row, ['종료일', 'endDate', '종료날짜'])) || startDate
    const startTime = toTimeStringFromValue(getCellValueByAliases(row, ['startTime', '시작시간', '시작시각'])) || '09:00'
    const endTime = toTimeStringFromValue(getCellValueByAliases(row, ['endTime', '종료시간', '종료시각'])) || '10:00'

    let description = String(getCellValueByAliases(row, ['비고', 'description', '설명', '메모', '내용']) || '').trim()
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

    if (!title || (!startDate && !weekInfo)) {
      skippedRows.push(index + 2)
      return
    }

    const finalStartDate = startDate || formatDate(new Date())
    const finalEndDate = endDate || finalStartDate
    items.push({ title, startDate: finalStartDate, endDate: finalEndDate, startTime, endTime, type: 'PERSONAL', description })
  })

  return { items, skippedRows }
}

export const summarizeSchedule = (schedule) => {
  const dateLabel = schedule.startDate === schedule.endDate
    ? schedule.startDate
    : `${schedule.startDate} ~ ${schedule.endDate}`
  return `${dateLabel} | ${normalizeTime(schedule.startTime)} ~ ${normalizeTime(schedule.endTime)} | ${schedule.title}`
}

export const sortByTime = (list) =>
  [...list].sort((a, b) => (a.startTime || '00:00').localeCompare(b.startTime || '00:00'))

export const isMultiDaySchedule = (schedule) => Boolean(
  schedule.startDate && schedule.endDate && schedule.startDate !== schedule.endDate,
)

export const buildScheduleBarSegments = (schedule, gridDates) => {
  const segments = []
  let currentSegment = null
  const startDate = schedule.startDate
  const endDate = schedule.isTodo ? startDate : (schedule.endDate || startDate)

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
  return segments.map((segment, segmentIndex) => ({ ...segment, key: `${schedule.id}-${segmentIndex}` }))
}

export const buildCalendarScheduleBars = (schedules, gridDates) => {
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
        if (a.startCol !== b.startCol) return a.startCol - b.startCol
        const durA = a.endCol - a.startCol
        const durB = b.endCol - b.startCol
        if (durB !== durA) return durB - durA
        return (a.schedule.startTime || '00:00').localeCompare(b.schedule.startTime || '00:00')
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

export const toAiSchedule = (recommendation) => ({
  id: `ai-${recommendation.id}`,
  startDate: recommendation.recommendationDate,
  endDate: recommendation.recommendationDate,
  title:
    recommendation.type === 'preparation'
      ? `${recommendation.targetTitle} 준비 시작`
      : recommendation.message,
  startTime: recommendation.sourceStartTime || '09:00',
  endTime: recommendation.sourceEndTime || '10:00',
  recommendationMessage: recommendation.message,
  description:
    recommendation.type === 'pattern'
        ? `분석된 주기 기반 추천: ${recommendation.sourceTitle}`
        : recommendation.type === 'preparation'
          ? `예정일: ${recommendation.targetStartDate} · 예상 ${recommendation.estimatedDays}일 · 유사 일정 ${recommendation.similarScheduleCount}건 · 신뢰도 ${recommendation.confidence}`
        : `예정일: ${recommendation.sourceStartDate} ${recommendation.sourceTitle}`,
  isAiRecommendation: true,
  aiType: recommendation.type,
  sourceTitle: recommendation.sourceTitle,
  targetScheduleId: recommendation.targetScheduleId,
  targetStartDate: recommendation.targetStartDate,
  targetTitle: recommendation.targetTitle,
  estimatedDays: recommendation.estimatedDays,
  preparationDays: recommendation.preparationDays,
  similarScheduleCount: recommendation.similarScheduleCount,
  confidence: recommendation.confidence,
  associatedItems: recommendation.associatedItems || [],
})
