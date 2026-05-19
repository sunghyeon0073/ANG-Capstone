import { getDocumentPreviewKind, getFileExtension } from './documentFileUtils'

export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

const sanitizeFilename = (name) =>
  (name || 'document').replace(/[<>:"/\\|?*]/g, '_').trim() || 'document'

const tableToCsv = (tableData) => {
  const escape = (value) => {
    const str = String(value ?? '')
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const lines = [tableData.headers.map(escape).join(',')]
  tableData.rows.forEach((row) => {
    lines.push(row.map(escape).join(','))
  })
  return lines.join('\n')
}

const buildHtmlExport = (doc) => {
  const body = doc.mockPreviewHtml
    ? doc.mockPreviewHtml
    : `<pre>${(doc.originalContent || '').replace(/</g, '&lt;')}</pre>`

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <title>${doc.title || 'document'}</title>
  <style>
    body { font-family: 'Segoe UI', sans-serif; padding: 32px; line-height: 1.7; color: #333; }
    h3 { margin-top: 0; }
  </style>
</head>
<body>
${body}
</body>
</html>`
}

export const exportDocument = async (doc, previewUrl) => {
  if (!doc) throw new Error('보낼 문서가 없습니다.')

  const baseName = sanitizeFilename(doc.title)
  const kind = getDocumentPreviewKind(doc)

  if (kind === 'excel' && doc.mockTableData) {
    const csv = tableToCsv(doc.mockTableData)
    downloadBlob(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }), `${baseName}.csv`)
    return { format: 'csv' }
  }

  if (kind === 'word' && (doc.mockPreviewHtml || doc.originalContent)) {
    const html = buildHtmlExport(doc)
    downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), `${baseName}.html`)
    return { format: 'html' }
  }

  if ((kind === 'pdf' || kind === 'image') && previewUrl) {
    const response = await fetch(previewUrl)
    const blob = await response.blob()
    const ext = getFileExtension(doc) || (kind === 'pdf' ? 'pdf' : 'png')
    const filename = doc.originalFileName || `${baseName}.${ext}`
    downloadBlob(blob, filename)
    return { format: ext }
  }

  if (doc.originalContent?.trim()) {
    downloadBlob(
      new Blob([doc.originalContent], { type: 'text/plain;charset=utf-8' }),
      `${baseName}.txt`
    )
    return { format: 'txt' }
  }

  throw new Error('보낼 내용이 없습니다.')
}
