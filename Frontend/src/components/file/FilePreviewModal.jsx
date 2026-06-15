import { useState, useEffect, useRef } from 'react'
import { renderAsync } from 'docx-preview'
import * as XLSX from 'xlsx'
import JSZip from 'jszip'
import {
  FiDownload, FiEdit2, FiShare2, FiTrash2, FiX,
  FiFile, FiAlertCircle, FiRotateCcw,
} from 'react-icons/fi'
import { downloadFile } from '../../api/fileApi'
import { getDocumentPreviewKind, inferContentType } from '../../utils/documentFileUtils'
import { getBaseName } from '../../utils/fileUtils'
import HwpViewer from '../pages/HwpViewer'

function DocxViewer({ data }) {
  const containerRef = useRef(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!data || !containerRef.current) return
    containerRef.current.innerHTML = ''
    setError(null)
    renderAsync(data, containerRef.current, null, {
      className: 'docx-preview-rendered',
      inWrapper: false,
      ignoreWidth: false,
      breakPages: true,
      useBase64URL: true,
    }).catch(() => setError('Word 파일 미리보기를 렌더링할 수 없습니다.'))
  }, [data])

  if (error) return <div className="fp-viewer-state fp-viewer-state--error"><FiAlertCircle size={28} /><p>{error}</p></div>
  return <div ref={containerRef} className="fp-viewer-docx" />
}

function ExcelViewer({ data }) {
  const [activeSheet, setActiveSheet] = useState(null)

  const workbook = (() => {
    if (!data) return null
    try { return XLSX.read(new Uint8Array(data), { type: 'array', cellDates: true }) }
    catch { return null }
  })()

  const sheetNames = workbook?.SheetNames || []
  const currentSheet = (activeSheet && sheetNames.includes(activeSheet)) ? activeSheet : sheetNames[0]

  const rows = (() => {
    if (!workbook || !currentSheet) return []
    return XLSX.utils.sheet_to_json(workbook.Sheets[currentSheet], {
      header: 1, blankrows: false, defval: '', raw: false,
    })
  })()

  if (!workbook) return <div className="fp-viewer-state fp-viewer-state--error">XLSX 파일을 읽을 수 없습니다.</div>
  if (!rows.length) return <div className="fp-viewer-state">표시할 데이터가 없습니다.</div>

  return (
    <div className="fp-viewer-excel">
      {sheetNames.length > 1 && (
        <div className="fp-viewer-excel-tabs">
          {sheetNames.map((name) => (
            <button
              key={name}
              type="button"
              className={`fp-viewer-excel-tab ${name === currentSheet ? 'active' : ''}`}
              onClick={() => setActiveSheet(name)}
            >
              {name}
            </button>
          ))}
        </div>
      )}
      <div className="fp-viewer-table-wrap">
        <table className="fp-viewer-table">
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) =>
                  ri === 0
                    ? <th key={ci}>{cell}</th>
                    : <td key={ci}>{cell}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function HwpxTextViewer({ data }) {
  const [text, setText] = useState('')
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!data) return
    JSZip.loadAsync(data)
      .then((zip) => {
        const sections = Object.values(zip.files)
          .filter((f) => /Contents\/section\d+\.xml$/i.test(f.name) || /section\d+\.xml$/i.test(f.name))
          .sort((a, b) => a.name.localeCompare(b.name))
        return Promise.all(sections.map((f) => f.async('text')))
      })
      .then((xmlTexts) => {
        const result = xmlTexts
          .join('\n')
          .replace(/<hp:br\s*\/>/g, '\n')
          .replace(/<hp:p\b[^>]*>/g, '\n')
          .replace(/<[^>]+>/g, '')
          .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
          .replace(/\n{3,}/g, '\n\n')
          .trim()
        setText(result || '')
        if (!result) setError('표시할 텍스트를 찾지 못했습니다.')
      })
      .catch(() => setError('HWPX 미리보기를 읽을 수 없습니다.'))
  }, [data])

  if (error) return <div className="fp-viewer-state fp-viewer-state--error"><FiAlertCircle size={28} /><p>{error}</p></div>
  if (!text) return <div className="fp-viewer-state"><div className="spinner" /><p>파일을 불러오는 중...</p></div>
  return <div className="fp-viewer-docx"><pre className="fp-viewer-txt">{text}</pre></div>
}

export default function FilePreviewModal({ doc, isTrash, onClose, onDownload, onRename, onShare, onDelete, onRestore }) {
  const [fileData, setFileData] = useState(null)
  const [blobUrl, setBlobUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const kind = getDocumentPreviewKind(doc)
  const hasFile = !!doc.fileId

  useEffect(() => {
    if (!hasFile) { setLoading(false); return }
    let objectUrl = null
    setLoading(true)
    setError(null)
    setFileData(null)
    setBlobUrl(null)

    downloadFile(doc.fileId)
      .then(async (res) => {
        const ab = await res.data.arrayBuffer()
        const mimeType = inferContentType(doc.originalFileName || doc.title || '')
        if (kind === 'pdf' || kind === 'image') {
          const blob = new Blob([ab], { type: mimeType })
          objectUrl = URL.createObjectURL(blob)
          setBlobUrl(objectUrl)
        } else {
          setFileData(ab)
        }
      })
      .catch(() => setError('파일을 불러오는 중 오류가 발생했습니다.'))
      .finally(() => setLoading(false))

    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [doc.fileId, kind, hasFile])

  const renderPreview = () => {
    if (!hasFile) return (
      <div className="fp-viewer-state">
        <FiFile size={48} />
        <p>미리보기를 지원하지 않는 항목입니다.</p>
      </div>
    )
    if (loading) return <div className="fp-viewer-state"><div className="spinner" /><p>파일을 불러오는 중...</p></div>
    if (error) return (
      <div className="fp-viewer-state fp-viewer-state--error">
        <FiAlertCircle size={36} />
        <p>{error}</p>
      </div>
    )
    switch (kind) {
      case 'pdf':
        return blobUrl ? (
          <object data={blobUrl} type="application/pdf" className="fp-viewer-iframe">
            <div className="fp-viewer-state fp-viewer-state--error">
              <FiAlertCircle size={32} />
              <p>PDF를 표시할 수 없습니다.<br />브라우저 PDF 뷰어를 확인하세요.</p>
            </div>
          </object>
        ) : null
      case 'image':
        return blobUrl ? <img src={blobUrl} alt="미리보기" className="fp-viewer-img" /> : null
      case 'word':
        return fileData ? <DocxViewer data={fileData} /> : <div className="fp-viewer-state"><div className="spinner" /></div>
      case 'excel':
        return fileData ? <ExcelViewer data={fileData} /> : <div className="fp-viewer-state"><div className="spinner" /></div>
      case 'hwpx':
        return fileData ? <HwpxTextViewer data={fileData} /> : <div className="fp-viewer-state"><div className="spinner" /></div>
      case 'hwp':
        return fileData ? <HwpViewer fileData={fileData} /> : <div className="fp-viewer-state"><div className="spinner" /></div>
      case 'text':
        return fileData ? (
          <div className="fp-viewer-docx">
            <pre className="fp-viewer-txt">{new TextDecoder().decode(fileData)}</pre>
          </div>
        ) : null
      default:
        return (
          <div className="fp-viewer-state">
            <FiFile size={48} />
            <p>이 파일 형식은 미리보기를 지원하지 않습니다.</p>
          </div>
        )
    }
  }

  return (
    <div className="fp-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="fp-modal">
        <header className="fp-modal-header">
          <span className="fp-modal-title" title={doc.title}>{getBaseName(doc.title)}</span>
          <button className="fp-modal-close" type="button" onClick={onClose}><FiX size={20} /></button>
        </header>

        <div className="fp-modal-preview">
          {renderPreview()}
        </div>

        <footer className="fp-modal-actions">
          {isTrash ? (
            <>
              <button className="fp-action-btn fp-action-btn--primary" type="button" onClick={() => onRestore(doc.docId)}>
                <FiRotateCcw /> 복구하기
              </button>
              <div style={{ flex: 1 }} />
              <button className="fp-action-btn fp-action-btn--danger" type="button" onClick={() => onDelete(doc.docId)}>
                <FiTrash2 /> 영구 삭제
              </button>
            </>
          ) : (
            <>
              {hasFile && (
                <button className="fp-action-btn fp-action-btn--primary" type="button" onClick={() => onDownload(doc.fileId, doc.originalFileName || doc.title)}>
                  <FiDownload /> 다운로드
                </button>
              )}
              <button className="fp-action-btn" type="button" onClick={() => onRename(doc)}>
                <FiEdit2 /> 이름 변경
              </button>
              <button className="fp-action-btn" type="button" onClick={() => onShare(doc)}>
                <FiShare2 /> 공유하기
              </button>
              <div style={{ flex: 1 }} />
              <button className="fp-action-btn fp-action-btn--danger" type="button" onClick={() => onDelete(doc.docId)}>
                <FiTrash2 /> 삭제
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  )
}
