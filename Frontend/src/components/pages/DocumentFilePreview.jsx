import { getDocumentPreviewKind, hasInlineFilePreview } from '../../utils/documentFileUtils'

function stripHtml(content) {
  return (content || '')
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\/\s*(p|div|li|h[1-6]|tr)\s*>/gi, '\n')
    .replace(/<\/\s*(td|th)\s*>/gi, '\t')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t\v\f\r]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function ExtractedContentPreview({ content, className = '' }) {
  if (!content) return null
  return <div className={`doc-body ${className}`.trim()}>{stripHtml(content)}</div>
}

function ExcelTablePreview({ tableData }) {
  if (!tableData?.headers?.length) return null

  return (
    <div className="doc-preview-table-wrap">
      <table className="doc-preview-table">
        <thead>
          <tr>
            {tableData.headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tableData.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={`${rowIndex}-${cellIndex}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function DocumentFilePreview({
  doc,
  previewUrl,
  previewLoading,
  previewError,
  variant = 'inline',
}) {
  const previewKind = getDocumentPreviewKind(doc)
  const isImage = previewKind === 'image'
  const isPdf = previewKind === 'pdf'
  const isWord = previewKind === 'word'
  const isExcel = previewKind === 'excel'
  const hasGeneratedPdfPreview = Boolean(doc?.previewFileId)

  const previewClassName = [
    'doc-preview',
    variant === 'fullscreen' ? 'doc-preview--fullscreen' : '',
    isImage && previewUrl ? 'doc-preview--image' : '',
    isWord ? 'doc-preview--word' : '',
    isExcel ? 'doc-preview--excel' : '',
  ]
    .filter(Boolean)
    .join(' ')

  if (!doc?.fileId && !doc?.previewFileId && !doc?.mockPreviewHtml && !doc?.mockTableData) {
    return <ExtractedContentPreview content={doc?.originalContent || '내용이 없습니다.'} />
  }

  if (!hasGeneratedPdfPreview && !hasInlineFilePreview(doc) && !doc?.mockPreviewHtml && !doc?.mockTableData) {
    return (
      <div className="doc-preview-unsupported">
        <p>{doc.originalFileName || doc.title} 파일은 브라우저에서 미리보기를 지원하지 않습니다.</p>
        {doc.originalContent && (
          <ExtractedContentPreview content={doc.originalContent} className="doc-body--extracted" />
        )}
      </div>
    )
  }

  return (
    <div className={previewClassName}>
      {previewLoading ? (
        <div className="doc-preview-state">미리보기를 불러오는 중...</div>
      ) : previewError ? (
        <div className="doc-preview-state error">{previewError}</div>
      ) : (isPdf || hasGeneratedPdfPreview) && previewUrl ? (
        <iframe
          src={previewUrl}
          title={`${doc.title} 미리보기`}
          className="doc-preview-frame"
        />
      ) : isImage && previewUrl ? (
        <img
          src={previewUrl}
          alt={`${doc.title} 미리보기`}
          className="doc-preview-image"
        />
      ) : isWord && doc.mockPreviewHtml ? (
        <div
          className="doc-preview-word"
          dangerouslySetInnerHTML={{ __html: doc.mockPreviewHtml }}
        />
      ) : isWord && doc.originalContent ? (
        <ExtractedContentPreview content={doc.originalContent} className="doc-preview-word doc-preview-word--text" />
      ) : isExcel && doc.mockTableData ? (
        <ExcelTablePreview tableData={doc.mockTableData} />
      ) : isExcel && doc.originalContent ? (
        <ExtractedContentPreview content={doc.originalContent} className="doc-preview-word doc-preview-word--text" />
      ) : (
        <div className="doc-preview-state">미리보기 데이터를 불러올 수 없습니다.</div>
      )}
    </div>
  )
}
