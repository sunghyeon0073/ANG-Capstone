const KO = 'ko-KR'
const TZ = 'Asia/Seoul'

const parse = (value) => {
  if (!value) return null
  const d = typeof value === 'string'
    ? new Date(value.includes('T') || value.includes('Z') ? value : value + 'Z')
    : new Date(value)
  return isNaN(d.getTime()) ? null : d
}

/** '2024-05-10' 형식 날짜 문자열 반환 */
export const formatDate = (value) => {
  const d = parse(value)
  return d ? d.toLocaleDateString(KO, { timeZone: TZ }) : '-'
}

/** '오전 09:30' 형식 시간 문자열 반환 */
export const formatTime = (value) => {
  const d = parse(value)
  return d ? d.toLocaleTimeString(KO, { timeZone: TZ, hour: '2-digit', minute: '2-digit' }) : '-'
}

/** { date, time } 객체 반환 — 메일/결재 등에서 공통 사용 */
export const formatDateTime = (value) => {
  const d = parse(value)
  if (!d) return { date: '-', time: '-' }
  return {
    date: d.toLocaleDateString(KO, { timeZone: TZ }),
    time: d.toLocaleTimeString(KO, { timeZone: TZ, hour: '2-digit', minute: '2-digit' }),
  }
}

/** "방금 전 / N분 전 / N시간 전 / 날짜" 상대 시간 */
export const formatRelativeTime = (value) => {
  const d = parse(value)
  if (!d) return '-'
  const diff = Date.now() - d.getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1)  return '방금 전'
  if (min < 60) return `${min}분 전`
  const hr = Math.floor(min / 60)
  if (hr < 24)  return `${hr}시간 전`
  return d.toLocaleDateString(KO, { timeZone: TZ })
}

/** datetime-local input 값 생성 (날짜 문자열 또는 ms 타임스탬프 → 'YYYY-MM-DDTHH:mm') */
export const toDateTimeLocalValue = (value) => {
  if (!value) return ''
  const d = new Date(value)
  if (isNaN(d.getTime())) return ''
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

/** 'YYYY-MM-DDTHH:mm' 입력값을 백엔드 LocalDateTime 형식으로 변환 */
export const toLocalDateTimePayload = (value) => value ? `${value}:00` : null
