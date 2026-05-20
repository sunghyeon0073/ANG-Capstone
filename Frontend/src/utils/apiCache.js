const CACHE_PREFIX = 'ang-api-cache:'
const DEFAULT_TTL = 5 * 60 * 1000

const buildCacheKey = (key) => `${CACHE_PREFIX}${key}`

export const readApiCache = (key, ttl = DEFAULT_TTL) => {
  try {
    const raw = localStorage.getItem(buildCacheKey(key))
    if (!raw) return null

    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null

    if (Date.now() - parsed.savedAt > ttl) {
      return null
    }

    return parsed.data ?? null
  } catch {
    return null
  }
}

export const writeApiCache = (key, data) => {
  try {
    localStorage.setItem(
      buildCacheKey(key),
      JSON.stringify({ savedAt: Date.now(), data })
    )
  } catch {
    // Ignore storage quota and serialization failures.
  }
}

export const removeApiCache = (key) => {
  try {
    localStorage.removeItem(buildCacheKey(key))
  } catch {
    // Ignore storage failures.
  }
}
