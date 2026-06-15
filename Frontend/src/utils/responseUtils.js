/** response.data.data 구조를 안전하게 꺼냄 */
export const unwrap = (response, fallback = null) =>
  response?.data?.data ?? fallback

/** 배열로 반환이 보장되는 unwrap (페이지네이션 / 다양한 래핑 구조 대응) */
export const unwrapList = (response, fallback = []) => {
  const data = unwrap(response)
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.content)) return data.content
  if (Array.isArray(data?.list)) return data.list
  if (Array.isArray(data?.data)) return data.data
  return fallback
}

/** Spring Page 응답을 표준 객체로 반환 */
export const unwrapPage = (response) => {
  const raw = unwrap(response)
  if (!raw) return { content: [], totalPages: 0, totalElements: 0, number: 0, size: 0 }
  if (Array.isArray(raw)) return { content: raw, totalPages: 1, totalElements: raw.length, number: 0, size: raw.length }
  return { content: raw.content ?? [], totalPages: raw.totalPages ?? 0, totalElements: raw.totalElements ?? 0, number: raw.number ?? 0, size: raw.size ?? 0 }
}
