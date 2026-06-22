export const formatFileSize = (bytes) => {
  if (!Number.isFinite(bytes) || bytes < 0) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * 파일 이름에서 확장자를 제외한 기본 이름을 반환합니다.
 */
export const getBaseName = (fileName) => {
  if (!fileName) return ''
  const lastDotIndex = fileName.lastIndexOf('.')
  if (lastDotIndex === -1) return fileName
  return fileName.substring(0, lastDotIndex)
}

/**
 * 파일 이름에서 확장자(.포함)를 반환합니다.
 */
export const getExtension = (fileName) => {
  if (!fileName) return ''
  const lastDotIndex = fileName.lastIndexOf('.')
  if (lastDotIndex === -1) return ''
  return fileName.substring(lastDotIndex)
}
