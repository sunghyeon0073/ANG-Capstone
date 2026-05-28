import { useEffect, useMemo, useRef, useState } from 'react'
import { renderAsync } from 'docx-preview'
import * as XLSX from 'xlsx'
import JSZip from 'jszip'
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

function DocxPreview({ data }) {
  const containerRef = useRef(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    if (!data || !containerRef.current) return undefined

    containerRef.current.innerHTML = ''
    setError(null)

    renderAsync(data, containerRef.current, null, {
      className: 'docx-preview-rendered',
      inWrapper: false,
      ignoreWidth: false,
      ignoreHeight: false,
      breakPages: true,
      useBase64URL: true,
    }).catch((err) => {
      if (!cancelled) {
        console.error('DOCX preview render failed:', err)
        setError('DOCX 미리보기를 렌더링할 수 없습니다.')
      }
    })

    return () => {
      cancelled = true
    }
  }, [data])

  if (!data) return <div className="doc-preview-state">미리보기 데이터를 불러오는 중...</div>

  return (
    <div className="docx-preview-shell">
      {error && <div className="doc-preview-state error">{error}</div>}
      <div ref={containerRef} className="docx-preview-container" />
    </div>
  )
}

function ExcelWorkbookPreview({ data }) {
  const [activeSheetName, setActiveSheetName] = useState(null)
  const workbook = useMemo(() => {
    if (!data) return null
    try {
      return XLSX.read(data, { type: 'array', cellDates: true })
    } catch (err) {
      console.error('XLSX preview parse failed:', err)
      return null
    }
  }, [data])

  const sheetNames = useMemo(() => workbook?.SheetNames || [], [workbook])
  const selectedSheetName = activeSheetName && sheetNames.includes(activeSheetName)
    ? activeSheetName
    : sheetNames[0]

  const rows = useMemo(() => {
    if (!workbook || !selectedSheetName) return []
    return XLSX.utils.sheet_to_json(workbook.Sheets[selectedSheetName], {
      header: 1,
      blankrows: false,
      defval: '',
      raw: false,
    })
  }, [workbook, selectedSheetName])

  useEffect(() => {
    if (!activeSheetName && sheetNames[0]) {
      setActiveSheetName(sheetNames[0])
    }
  }, [activeSheetName, sheetNames])

  if (!data) return <div className="doc-preview-state">미리보기 데이터를 불러오는 중...</div>
  if (!workbook) return <div className="doc-preview-state error">XLSX 미리보기를 읽을 수 없습니다.</div>
  if (!rows.length) return <div className="doc-preview-state">표시할 데이터가 없습니다.</div>

  return (
    <div className="xlsx-preview">
      {sheetNames.length > 1 && (
        <div className="xlsx-preview-tabs">
          {sheetNames.map((sheetName) => (
            <button
              key={sheetName}
              type="button"
              className={`xlsx-preview-tab ${sheetName === selectedSheetName ? 'active' : ''}`}
              onClick={() => setActiveSheetName(sheetName)}
            >
              {sheetName}
            </button>
          ))}
        </div>
      )}
      <div className="doc-preview-table-wrap">
        <table className="doc-preview-table xlsx-preview-table">
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  rowIndex === 0
                    ? <th key={cellIndex}>{cell}</th>
                    : <td key={cellIndex}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function HwpxPreview({ data, fallbackContent }) {
  const [content, setContent] = useState('')
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    const extract = async () => {
      if (!data) {
        setContent('')
        return
      }

      try {
        const zip = await JSZip.loadAsync(data)
        const sectionFiles = Object.values(zip.files)
          .filter((file) => /Contents\/section\d+\.xml$/i.test(file.name) || /section\d+\.xml$/i.test(file.name))
          .sort((a, b) => a.name.localeCompare(b.name))

        const xmlTexts = await Promise.all(sectionFiles.map((file) => file.async('text')))
        const text = xmlTexts
          .join('\n')
          .replace(/<hp:br\s*\/>/g, '\n')
          .replace(/<hp:p\b[^>]*>/g, '\n')
          .replace(/<[^>]+>/g, '')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .replace(/\n{3,}/g, '\n\n')
          .trim()

        if (!cancelled) {
          setContent(text)
          setError(text ? null : 'HWPX에서 표시할 텍스트를 찾지 못했습니다.')
        }
      } catch (err) {
        console.error('HWPX preview parse failed:', err)
        if (!cancelled) setError('HWPX 미리보기를 읽을 수 없습니다.')
      }
    }

    extract()

    return () => {
      cancelled = true
    }
  }, [data])

  if (content) return <ExtractedContentPreview content={content} className="doc-preview-word doc-preview-word--text" />
  if (fallbackContent) return <ExtractedContentPreview content={fallbackContent} className="doc-preview-word doc-preview-word--text" />
  return <div className={`doc-preview-state ${error ? 'error' : ''}`}>{error || '미리보기를 불러오는 중...'}</div>
}

export default function DocumentFilePreview({
  doc,
  previewUrl,
  previewData,
  previewLoading,
  previewError,
  variant = 'inline',
}) {
  const previewKind = getDocumentPreviewKind(doc)
  const isImage = previewKind === 'image'
  const isPdf = previewKind === 'pdf'
  const isWord = previewKind === 'word'
  const isExcel = previewKind === 'excel'
  const isHwp = previewKind === 'hwp'
  const isHwpx = previewKind === 'hwpx'
  const hasGeneratedPdfPreview = Boolean(doc?.previewFileId)

  const previewClassName = [
    'doc-preview',
    variant === 'fullscreen' ? 'doc-preview--fullscreen' : '',
    isImage && previewUrl ? 'doc-preview--image' : '',
    isWord ? 'doc-preview--word' : '',
    isExcel ? 'doc-preview--excel' : '',
    isHwpx || isHwp ? 'doc-preview--word' : '',
  ]
    .filter(Boolean)
    .join(' ')

  if (!doc?.fileId && !doc?.previewFileId && !doc?.mockPreviewHtml && !doc?.mockTableData) {
    return <ExtractedContentPreview content={doc?.originalContent || '내용이 없습니다.'} />
  }

  if (!hasGeneratedPdfPreview && !hasInlineFilePreview(doc) && !isHwpx && !doc?.mockPreviewHtml && !doc?.mockTableData) {
    return (
      <div className="doc-preview-unsupported">
        <p>{doc.originalFileName || doc.title} 파일은 브라우저에서 직접 미리보기를 지원하지 않습니다.</p>
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
      ) : isWord && previewData ? (
        <DocxPreview data={previewData} />
      ) : isExcel && previewData ? (
        <ExcelWorkbookPreview data={previewData} />
      ) : isHwpx ? (
        <HwpxPreview data={previewData} fallbackContent={doc.originalContent} />
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
      ) : isHwp && doc.originalContent ? (
        <ExtractedContentPreview content={doc.originalContent} className="doc-preview-word doc-preview-word--text" />
      ) : (
        <div className="doc-preview-state">미리보기 데이터를 불러올 수 없습니다.</div>
      )}
    </div>
  )
}
