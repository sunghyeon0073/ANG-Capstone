import { useEffect, useMemo, useRef, useState } from 'react'
import { renderAsync } from 'docx-preview'
import * as XLSX from 'xlsx'
import JSZip from 'jszip'
import { getDocumentPreviewKind, hasInlineFilePreview } from '../../utils/documentFileUtils'
import HwpViewer from './HwpViewer'

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

const nextDocxBlockId = (index) => `B${String(index + 1).padStart(3, '0')}`

function DocxPreview({
  data,
  editInstructions = [],
  onAddEditInstruction,
  editable = false,
}) {
  const shellRef = useRef(null)
  const containerRef = useRef(null)
  const [error, setError] = useState(null)
  const [activePrompt, setActivePrompt] = useState(null)

  const markInstructionBlocks = () => {
    const container = containerRef.current
    if (!container) return

    const requestedBlockIds = new Set(editInstructions.map((instruction) => instruction.blockId))
    container.querySelectorAll('[data-docx-block-id]').forEach((element) => {
      element.classList.toggle('docx-edit-target--queued', requestedBlockIds.has(element.dataset.docxBlockId))
    })
  }

  useEffect(() => {
    let cancelled = false
    if (!data || !containerRef.current) return undefined

    const decorateEditableBlocks = () => {
      if (!editable || !containerRef.current) return
      const paragraphs = Array.from(containerRef.current.querySelectorAll('section.docx p'))
        .filter((element) => element.textContent?.trim())

      paragraphs.forEach((element, index) => {
        element.dataset.docxBlockId = nextDocxBlockId(index)
        element.classList.add('docx-edit-target')
        element.setAttribute('title', '클릭해서 이 문단에 수정 요청 추가')
      })
      markInstructionBlocks()
    }

    const updateScale = () => {
      const shell = shellRef.current
      const section = containerRef.current?.querySelector('section.docx')
      if (!shell || !section) return

      const availableWidth = shell.clientWidth - 48
      const pageWidth = section.offsetWidth
      if (!availableWidth || !pageWidth) return

      const scale = Math.min(1.6, Math.max(0.45, availableWidth / pageWidth))
      containerRef.current.style.setProperty('--docx-preview-scale', scale.toFixed(3))
    }

    containerRef.current.innerHTML = ''
    containerRef.current.style.setProperty('--docx-preview-scale', '1')
    setError(null)

    renderAsync(data, containerRef.current, null, {
      className: 'docx-preview-rendered',
      inWrapper: false,
      ignoreWidth: false,
      ignoreHeight: false,
      breakPages: true,
      useBase64URL: true,
    }).then(() => {
      if (!cancelled) {
        window.requestAnimationFrame(() => {
          updateScale()
          decorateEditableBlocks()
        })
      }
    }).catch((err) => {
      if (!cancelled) {
        console.error('DOCX preview render failed:', err)
        setError('DOCX 미리보기를 렌더링할 수 없습니다.')
      }
    })

    const resizeObserver = new ResizeObserver(() => {
      window.requestAnimationFrame(updateScale)
    })
    if (shellRef.current) resizeObserver.observe(shellRef.current)

    return () => {
      cancelled = true
      resizeObserver.disconnect()
    }
  }, [data])

  useEffect(() => {
    markInstructionBlocks()
  }, [editInstructions])

  const handlePreviewClick = (event) => {
    if (!editable || !onAddEditInstruction) return
    if (event.target.closest('.docx-edit-popover')) return

    const target = event.target.closest('[data-docx-block-id]')
    if (!target || !shellRef.current) {
      setActivePrompt(null)
      return
    }

    const shellRect = shellRef.current.getBoundingClientRect()
    const left = event.clientX - shellRect.left + shellRef.current.scrollLeft
    const top = event.clientY - shellRect.top + shellRef.current.scrollTop

    setActivePrompt({
      blockId: target.dataset.docxBlockId,
      selectedText: target.textContent.trim().replace(/\s+/g, ' '),
      instruction: '',
      left: Math.max(12, Math.min(left, shellRef.current.scrollLeft + shellRef.current.clientWidth - 380)),
      top: top + 12,
    })
  }

  const handlePromptSubmit = (event) => {
    event.preventDefault()
    const instruction = activePrompt?.instruction?.trim()
    if (!instruction) return

    onAddEditInstruction({
      id: `${activePrompt.blockId}-${Date.now()}`,
      blockId: activePrompt.blockId,
      selectedText: activePrompt.selectedText,
      instruction,
    })
    setActivePrompt(null)
  }

  if (!data) return <div className="doc-preview-state">미리보기 데이터를 불러오는 중...</div>

  return (
    <div ref={shellRef} className="docx-preview-shell" onClick={handlePreviewClick}>
      {error && <div className="doc-preview-state error">{error}</div>}
      <div ref={containerRef} className="docx-preview-container" />
      {activePrompt && (
        <form
          className="docx-edit-popover"
          style={{ left: activePrompt.left, top: activePrompt.top }}
          onClick={(event) => event.stopPropagation()}
          onSubmit={handlePromptSubmit}
        >
          <div className="docx-edit-popover-meta">{activePrompt.blockId}</div>
          <input
            type="text"
            value={activePrompt.instruction}
            onChange={(event) => setActivePrompt((current) => ({ ...current, instruction: event.target.value }))}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setActivePrompt(null)
            }}
            placeholder="이 문단을 어떻게 수정할까요?"
            autoFocus
          />
          <button type="submit">추가</button>
        </form>
      )}
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
  docxEditInstructions = [],
  onAddDocxEditInstruction,
}) {
  const previewKind = getDocumentPreviewKind(doc)
  const isImage = previewKind === 'image'
  const isPdf = previewKind === 'pdf'
  const isWord = previewKind === 'word'
  const isExcel = previewKind === 'excel'
  const isHwp = previewKind === 'hwp' || previewKind === 'hwpx'
  const hasGeneratedPdfPreview = Boolean(doc?.previewFileId)

  const previewClassName = [
    'doc-preview',
    variant === 'fullscreen' ? 'doc-preview--fullscreen' : '',
    isImage && previewUrl ? 'doc-preview--image' : '',
    isWord ? 'doc-preview--word' : '',
    isExcel ? 'doc-preview--excel' : '',
    isHwp ? 'doc-preview--hwp' : '',
  ]
    .filter(Boolean)
    .join(' ')

  if (!doc?.fileId && !doc?.previewFileId && !doc?.mockPreviewHtml && !doc?.mockTableData) {
    return <ExtractedContentPreview content={doc?.originalContent || '내용이 없습니다.'} />
  }

  if (!hasGeneratedPdfPreview && !hasInlineFilePreview(doc) && !isHwp && !doc?.mockPreviewHtml && !doc?.mockTableData) {
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
      ) : previewKind === 'hwp' && (previewUrl || previewData) ? (
        <HwpViewer previewUrl={previewUrl} fileData={previewData} />
      ) : previewKind === 'hwpx' && (previewUrl || previewData) ? (
        <HwpxPreview data={previewData} fallbackContent={doc.originalContent} />
      ) : isWord && previewData ? (
        <DocxPreview
          data={previewData}
          editInstructions={docxEditInstructions}
          onAddEditInstruction={onAddDocxEditInstruction}
          editable={variant === 'inline'}
        />
      ) : isExcel && previewData ? (
        <ExcelWorkbookPreview data={previewData} />
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
