import { useState, useEffect, useRef, useMemo } from 'react'
import { renderAsync } from 'docx-preview'
import * as XLSX from 'xlsx'
import JSZip from 'jszip'
import { FiFileText } from 'react-icons/fi'
import { getApprovalAttachment, getApprovalAttachmentById } from '../../api/approvalApi'
import HwpViewer from '../pages/HwpViewer'

export function ExcelSheetViewer({ data }) {
  const [activeSheet, setActiveSheet] = useState(null)

  const workbook = useMemo(() => {
    if (!data) return null
    try { return XLSX.read(new Uint8Array(data), { type: 'array', cellDates: true }) }
    catch { return null }
  }, [data])

  const sheetNames = workbook?.SheetNames || []
  const currentSheet = (activeSheet && sheetNames.includes(activeSheet)) ? activeSheet : sheetNames[0]

  const rows = useMemo(() => {
    if (!workbook || !currentSheet) return []
    return XLSX.utils.sheet_to_json(workbook.Sheets[currentSheet], {
      header: 1, blankrows: false, defval: '', raw: false,
    })
  }, [workbook, currentSheet])

  if (!workbook) return <div className="esig-viewer-state esig-viewer-state--error">XLSX 파일을 읽을 수 없습니다.</div>
  if (!rows.length) return <div className="esig-viewer-state">표시할 데이터가 없습니다.</div>

  return (
    <div className="esig-viewer-excel">
      {sheetNames.length > 1 && (
        <div className="esig-viewer-excel-tabs">
          {sheetNames.map((name) => (
            <button
              key={name}
              className={`esig-viewer-excel-tab ${name === currentSheet ? 'active' : ''}`}
              onClick={() => setActiveSheet(name)}
            >
              {name}
            </button>
          ))}
        </div>
      )}
      <div className="esig-viewer-table-wrap">
        <table className="esig-viewer-table">
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

export function HwpxViewer({ data }) {
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

  if (error) return <div className="esig-viewer-state esig-viewer-state--error"><FiFileText size={36} /><p>{error}</p></div>
  if (!text) return <div className="esig-viewer-state">파일을 불러오는 중...</div>
  return (
    <div className="esig-viewer-docx">
      <pre className="esig-viewer-txt">{text}</pre>
    </div>
  )
}

export function AttachmentViewer({ docId, attachmentId, fileName, attachmentUrl }) {
  const [viewer, setViewer] = useState({ status: 'idle', type: null, url: null, data: null })
  const docxRef = useRef(null)

  useEffect(() => {
    const hasAttachment = attachmentId != null || attachmentUrl
    if (!docId || !hasAttachment) {
      setViewer({ status: 'none', type: null, url: null, data: null })
      return
    }

    let blobUrl = null
    setViewer({ status: 'loading', type: null, url: null, data: null })

    const fetchFn = attachmentId != null
      ? () => getApprovalAttachmentById(docId, attachmentId)
      : () => getApprovalAttachment(docId)

    fetchFn()
      .then(async (res) => {
        const blob = new Blob([res.data], { type: res.headers['content-type'] || 'application/octet-stream' })
        const ct = (res.headers['content-type'] || '').toLowerCase()
        const urlLower = (fileName || attachmentUrl || '').toLowerCase()

        let type = 'other'
        if (ct.includes('pdf') || urlLower.match(/\.pdf(\?|$)/)) type = 'pdf'
        else if (ct.startsWith('image/') || urlLower.match(/\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/)) type = 'image'
        else if (ct.includes('wordprocessingml') || urlLower.match(/\.docx?(\?|$)/)) type = 'word'
        else if (ct.includes('spreadsheetml') || ct.includes('ms-excel') || urlLower.match(/\.(xlsx?|csv)(\?|$)/)) type = 'excel'
        else if (ct.includes('hwpx') || urlLower.match(/\.hwpx(\?|$)/)) type = 'hwpx'
        else if (ct.includes('hwp') || urlLower.match(/\.hwp(\?|$)/)) type = 'hwp'
        else if (ct.startsWith('text/') || urlLower.match(/\.txt(\?|$)/)) type = 'txt'

        if (type === 'pdf' || type === 'image') {
          blobUrl = URL.createObjectURL(blob)
          setViewer({ status: 'ready', type, url: blobUrl, data: null })
        } else if (type === 'word' || type === 'excel' || type === 'hwp' || type === 'hwpx') {
          const buffer = await blob.arrayBuffer()
          setViewer({ status: 'ready', type, url: null, data: buffer })
        } else if (type === 'txt') {
          const text = await blob.text()
          setViewer({ status: 'ready', type: 'txt', url: null, data: text })
        } else {
          blobUrl = URL.createObjectURL(blob)
          setViewer({ status: 'ready', type: 'other', url: blobUrl, data: null })
        }
      })
      .catch(() => setViewer({ status: 'error', type: null, url: null, data: null }))

    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl) }
  }, [docId, attachmentId, attachmentUrl])

  useEffect(() => {
    if (viewer.type !== 'word' || !viewer.data || !docxRef.current) return
    docxRef.current.innerHTML = ''
    renderAsync(viewer.data, docxRef.current, null, {
      className: 'esig-docx-rendered', inWrapper: false, breakPages: true, useBase64URL: true,
    }).catch((e) => console.error('DOCX render failed:', e))
  }, [viewer])

  if (viewer.status === 'idle' || viewer.status === 'none') {
    return <div className="esig-viewer-state"><FiFileText size={36} /><p>첨부된 파일이 없습니다.</p></div>
  }
  if (viewer.status === 'loading') return <div className="esig-viewer-state">파일을 불러오는 중...</div>
  if (viewer.status === 'error') {
    return (
      <div className="esig-viewer-state esig-viewer-state--error">
        <FiFileText size={36} />
        <p>파일을 불러오지 못했습니다.</p>
        <span>백엔드 첨부파일 엔드포인트를 확인해주세요.</span>
      </div>
    )
  }
  if (viewer.type === 'pdf') return <iframe src={viewer.url} className="esig-viewer-frame" title="첨부 PDF" />
  if (viewer.type === 'image') {
    return <div className="esig-viewer-image-wrap"><img src={viewer.url} alt="첨부 이미지" className="esig-viewer-image" /></div>
  }
  if (viewer.type === 'word') return <div ref={docxRef} className="esig-viewer-docx" />
  if (viewer.type === 'excel') return <ExcelSheetViewer data={viewer.data} />
  if (viewer.type === 'hwp') {
    return <div className="esig-viewer-docx"><HwpViewer fileData={viewer.data} /></div>
  }
  if (viewer.type === 'hwpx') return <HwpxViewer data={viewer.data} />
  if (viewer.type === 'txt') {
    return <div className="esig-viewer-docx"><pre className="esig-viewer-txt">{viewer.data}</pre></div>
  }
  return (
    <div className="esig-viewer-state">
      <FiFileText size={36} />
      <p>미리보기를 지원하지 않는 형식입니다.</p>
      <a className="esig-btn esig-btn-ghost" href={viewer.url} download>파일 다운로드</a>
    </div>
  )
}
