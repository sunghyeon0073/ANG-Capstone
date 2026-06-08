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

const getDocxEditableBlocks = (container) => {
  const section =
    container?.querySelector('section.docx') ||
    container?.querySelector('.docx-preview-rendered') ||
    container?.querySelector('.docx') ||
    container?.querySelector('section') ||
    container?.firstElementChild
  if (!section) return []

  const blockSelectors = 'p, h1, h2, h3, h4, h5, h6, li, td, th'
  const blocks = Array.from(section.querySelectorAll(blockSelectors))
    .filter((element) => element.textContent?.trim())

  if (blocks.length) return blocks

  return Array.from(section.querySelectorAll('div, span'))
    .filter((element) => {
      const text = element.textContent?.trim()
      if (!text) return false
      return !Array.from(element.children).some((child) => child.textContent?.trim() === text)
    })
}

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
  const [hoveredBlock, setHoveredBlock] = useState(null)

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
      const paragraphs = getDocxEditableBlocks(containerRef.current)

      containerRef.current.classList.toggle('docx-edit-enabled', paragraphs.length > 0)
      paragraphs.forEach((element, index) => {
        element.dataset.docxBlockId = nextDocxBlockId(index)
        element.classList.add('docx-edit-target')
        element.setAttribute('title', '클릭해서 이 문단에 수정 요청 추가')
      })
      markInstructionBlocks()
    }

    const updateScale = () => {
      const shell = shellRef.current
      const section =
        containerRef.current?.querySelector('section.docx') ||
        containerRef.current?.querySelector('.docx-preview-rendered') ||
        containerRef.current?.querySelector('.docx') ||
        containerRef.current?.querySelector('section') ||
        containerRef.current?.firstElementChild
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

    const decorateRenderedDocx = () => {
      if (cancelled) return
      updateScale()
      decorateEditableBlocks()
    }

    renderAsync(data, containerRef.current, null, {
      className: 'docx-preview-rendered',
      inWrapper: false,
      ignoreWidth: false,
      ignoreHeight: false,
      breakPages: true,
      useBase64URL: true,
    }).then(() => {
      if (!cancelled) {
        window.requestAnimationFrame(decorateRenderedDocx)
        window.setTimeout(decorateRenderedDocx, 80)
        window.setTimeout(decorateRenderedDocx, 250)
        window.setTimeout(decorateRenderedDocx, 600)
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

    const mutationObserver = new MutationObserver(() => {
      window.requestAnimationFrame(decorateRenderedDocx)
    })
    mutationObserver.observe(containerRef.current, { childList: true, subtree: true })

    return () => {
      cancelled = true
      resizeObserver.disconnect()
      mutationObserver.disconnect()
    }
  }, [data, editable])

  useEffect(() => {
    markInstructionBlocks()
  }, [editInstructions])

  useEffect(() => {
    if (!editable) {
      setHoveredBlock(null)
      setActivePrompt(null)
    }
  }, [editable])

  const resolveDocxTarget = (eventTarget) => {
    const container = containerRef.current
    const section =
      container?.querySelector('section.docx') ||
      container?.querySelector('.docx-preview-rendered') ||
      container?.querySelector('.docx') ||
      container?.querySelector('section') ||
      container?.firstElementChild
    if (!container || !section || !eventTarget) return null

    const directTarget = eventTarget.closest('[data-docx-block-id]')
    const fallbackTarget = eventTarget.closest('p, h1, h2, h3, h4, h5, h6, li, td, th, span, div')
    const target = directTarget || (section.contains(fallbackTarget) ? fallbackTarget : null)
    if (!target) return null

    if (!target.dataset.docxBlockId) {
      getDocxEditableBlocks(container).forEach((element, index) => {
        if (!element.dataset.docxBlockId) {
          element.dataset.docxBlockId = nextDocxBlockId(index)
          element.classList.add('docx-edit-target')
        }
      })
    }

    const resolvedTarget = target.closest('[data-docx-block-id]') || target
    if (!resolvedTarget.dataset.docxBlockId) {
      resolvedTarget.dataset.docxBlockId = nextDocxBlockId(getDocxEditableBlocks(container).length)
      resolvedTarget.classList.add('docx-edit-target')
    }

    return resolvedTarget
  }

  const resolveDocxTargetFromPoint = (clientX, clientY) => {
    const container = containerRef.current
    if (!container) return null

    const blocks = getDocxEditableBlocks(container)
    if (!blocks.length) return null

    let nearestBlock = null
    let nearestDistance = Number.POSITIVE_INFINITY

    blocks.forEach((block, index) => {
      if (!block.dataset.docxBlockId) {
        block.dataset.docxBlockId = nextDocxBlockId(index)
        block.classList.add('docx-edit-target')
      }

      const rect = block.getBoundingClientRect()
      const inside =
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom

      if (inside) {
        nearestBlock = block
        nearestDistance = 0
        return
      }

      const dx = clientX < rect.left ? rect.left - clientX : clientX > rect.right ? clientX - rect.right : 0
      const dy = clientY < rect.top ? rect.top - clientY : clientY > rect.bottom ? clientY - rect.bottom : 0
      const distance = Math.hypot(dx, dy)

      if (distance < nearestDistance) {
        nearestBlock = block
        nearestDistance = distance
      }
    })

    return nearestDistance <= 80 ? nearestBlock : null
  }

  const handlePreviewMouseMove = (event) => {
    if (!editable || activePrompt) return
    const target = resolveDocxTarget(event.target) || resolveDocxTargetFromPoint(event.clientX, event.clientY)
    if (!target || !shellRef.current) {
      const shellRect = shellRef.current?.getBoundingClientRect()
      if (!shellRect) {
        setHoveredBlock(null)
        return
      }
      setHoveredBlock({
        blockId: 'B000',
        left: Math.max(8, event.clientX - shellRect.left + shellRef.current.scrollLeft - 80),
        top: Math.max(8, event.clientY - shellRect.top + shellRef.current.scrollTop - 14),
        width: 160,
        height: 28,
      })
      return
    }

    const targetRect = target.getBoundingClientRect()
    const shellRect = shellRef.current.getBoundingClientRect()
    setHoveredBlock({
      blockId: target.dataset.docxBlockId,
      left: targetRect.left - shellRect.left + shellRef.current.scrollLeft,
      top: targetRect.top - shellRect.top + shellRef.current.scrollTop,
      width: Math.max(targetRect.width, 24),
      height: Math.max(targetRect.height, 18),
    })
  }

  const handlePreviewClick = (event) => {
    if (!editable || !onAddEditInstruction) return
    if (event.target.closest('.docx-edit-popover')) return

    const resolvedTarget = resolveDocxTarget(event.target) || resolveDocxTargetFromPoint(event.clientX, event.clientY)
    if (!shellRef.current) {
      setActivePrompt(null)
      return
    }

    const shellRect = shellRef.current.getBoundingClientRect()
    const left = event.clientX - shellRect.left + shellRef.current.scrollLeft
    const top = event.clientY - shellRect.top + shellRef.current.scrollTop

    setActivePrompt({
      blockId: resolvedTarget?.dataset?.docxBlockId || 'B000',
      selectedText: resolvedTarget?.textContent?.trim().replace(/\s+/g, ' ') || '',
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
    <div
      ref={shellRef}
      className={`docx-preview-shell ${editable ? 'docx-preview-shell--editable' : ''}`.trim()}
      onClick={handlePreviewClick}
      onMouseMove={handlePreviewMouseMove}
      onMouseLeave={() => setHoveredBlock(null)}
    >
      {error && <div className="doc-preview-state error">{error}</div>}
      <div ref={containerRef} className="docx-preview-container" />
      {editable && <div className="docx-edit-mode-badge">DOCX 편집</div>}
      {editable && hoveredBlock && !activePrompt && (
        <div
          className="docx-edit-hover-box"
          style={{
            left: hoveredBlock.left,
            top: hoveredBlock.top,
            width: hoveredBlock.width,
            height: hoveredBlock.height,
          }}
          aria-hidden="true"
        />
      )}
      {editable && activePrompt && (
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
  docxEditEnabled = false,
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
          editable={variant === 'inline' && docxEditEnabled}
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
