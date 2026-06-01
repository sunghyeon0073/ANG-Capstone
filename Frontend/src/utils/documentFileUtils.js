export const getFileName = (doc) =>
  doc?.originalFileName?.toLowerCase() || doc?.title?.toLowerCase() || ''

export const getFileExtension = (doc) => {
  const name = getFileName(doc)
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot + 1) : ''
}

export const isPdfDocument = (doc) => {
  const contentType = doc?.fileContentType?.toLowerCase() || ''
  const fileName = getFileName(doc)
  return contentType.includes('pdf') || fileName.endsWith('.pdf')
}

export const isImageDocument = (doc) => {
  const contentType = doc?.fileContentType?.toLowerCase() || ''
  const fileName = getFileName(doc)
  return (
    contentType.startsWith('image/') ||
    /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(fileName)
  )
}

export const isWordDocument = (doc) => {
  const contentType = doc?.fileContentType?.toLowerCase() || ''
  const ext = getFileExtension(doc)
  return (
    contentType.includes('wordprocessingml') ||
    ext === 'docx'
  )
}

export const isExcelDocument = (doc) => {
  const contentType = doc?.fileContentType?.toLowerCase() || ''
  const ext = getFileExtension(doc)
  return (
    contentType.includes('spreadsheetml') ||
    contentType.includes('ms-excel') ||
    ['xls', 'xlsx', 'csv'].includes(ext)
  )
}

export const isTextDocument = (doc) => {
  const contentType = doc?.fileContentType?.toLowerCase() || ''
  const ext = getFileExtension(doc)
  return contentType.startsWith('text/') || ['txt', 'md'].includes(ext)
}

export const isHwpDocument = (doc) => {
  const contentType = doc?.fileContentType?.toLowerCase() || ''
  const ext = getFileExtension(doc)
  return (contentType.includes('hwp') && !ext.endsWith('x')) || ext === 'hwp'
}

export const isHwpxDocument = (doc) => {
  const contentType = doc?.fileContentType?.toLowerCase() || ''
  const ext = getFileExtension(doc)
  return contentType.includes('hwpx') || ext === 'hwpx'
}

/** @returns {'pdf'|'image'|'word'|'excel'|'hwp'|'hwpx'|'file'|'text'} */
export const getDocumentPreviewKind = (doc) => {
  const hasFile =
    doc?.fileId || doc?.previewFileId || doc?.mockPreviewUrl || doc?.mockPreviewHtml || doc?.mockTableData

  if (!hasFile) return 'text'
  
  // 원본 파일 형식을 먼저 확인하여 정확한 라벨을 보장합니다.
  if (isPdfDocument(doc)) return 'pdf'
  if (isImageDocument(doc)) return 'image'
  if (isWordDocument(doc)) return 'word'
  if (isExcelDocument(doc)) return 'excel'
  if (isHwpxDocument(doc)) return 'hwpx'
  if (isHwpDocument(doc)) return 'hwp'
  if (isTextDocument(doc)) return 'text'
  
  // 미리보기 파일 형식이 PDF인 경우 (백엔드 변환 결과)
  if (doc?.previewFileContentType?.toLowerCase().includes('pdf')) return 'pdf'
  
  if (doc?.fileId || doc?.mockPreviewUrl) return 'file'
  return 'text'
}

export const hasInlineFilePreview = (doc) => {
  const kind = getDocumentPreviewKind(doc)
  return ['pdf', 'image', 'word', 'excel'].includes(kind)
}

export const getFileTypeLabel = (doc) => {
  const ext = getFileExtension(doc).toUpperCase()
  if (ext && ext.length > 0 && ext.length <= 10) {
    if (ext === 'JPEG') return 'JPG'
    return ext
  }

  const kind = getDocumentPreviewKind(doc)
  const labels = {
    pdf: 'PDF',
    image: 'IMG',
    word: 'DOCX',
    excel: 'XLSX',
    hwp: 'HWP',
    hwpx: 'HWPX',
    file: 'FILE',
    text: 'TXT',
  }
  return labels[kind] || 'FILE'
}

export const ACCEPTED_UPLOAD_TYPES =
  '.txt,.pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.gif,.webp,.hwp,.hwpx,.md'

export const inferContentType = (fileName) => {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  const map = {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    csv: 'text/csv',
    txt: 'text/plain',
    md: 'text/markdown',
    hwp: 'application/x-hwp',
    hwpx: 'application/vnd.hancom.hwpx',
  }
  return map[ext] || 'application/octet-stream'
}
