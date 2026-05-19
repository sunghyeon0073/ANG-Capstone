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
    contentType.includes('msword') ||
    ['doc', 'docx'].includes(ext)
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

/** @returns {'pdf'|'image'|'word'|'excel'|'file'|'text'} */
export const getDocumentPreviewKind = (doc) => {
  const hasFile =
    doc?.fileId || doc?.previewFileId || doc?.mockPreviewUrl || doc?.mockPreviewHtml || doc?.mockTableData

  if (!hasFile) return 'text'
  if (isPdfDocument(doc)) return 'pdf'
  if (isImageDocument(doc)) return 'image'
  if (isWordDocument(doc)) return 'word'
  if (isExcelDocument(doc)) return 'excel'
  if (doc?.fileId || doc?.mockPreviewUrl) return 'file'
  return 'text'
}

export const hasInlineFilePreview = (doc) => {
  const kind = getDocumentPreviewKind(doc)
  return ['pdf', 'image', 'word', 'excel'].includes(kind)
}

export const getFileTypeLabel = (doc) => {
  const kind = getDocumentPreviewKind(doc)
  const labels = {
    pdf: 'PDF',
    image: 'IMG',
    word: 'DOCX',
    excel: 'XLSX',
    file: 'FILE',
    text: 'TXT',
  }
  return labels[kind] || 'FILE'
}

export const ACCEPTED_UPLOAD_TYPES =
  '.txt,.pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.gif,.webp,.hwp,.md'

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
  }
  return map[ext] || 'application/octet-stream'
}
