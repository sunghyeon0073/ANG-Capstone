import { useState, useEffect, useRef } from 'react'
import {
  FiCheck,
  FiEdit3,
  FiImage,
  FiPenTool,
  FiRotateCcw,
  FiTrash2,
  FiUpload,
} from 'react-icons/fi'
import { getApprovalSignImage } from '../../api/approvalApi'

export function SignatureImg({ signId, alt, className }) {
  const [src, setSrc] = useState(null)

  useEffect(() => {
    let blobUrl = null
    getApprovalSignImage(signId)
      .then((res) => {
        const blob = new Blob([res.data], { type: res.headers['content-type'] || 'image/png' })
        blobUrl = URL.createObjectURL(blob)
        setSrc(blobUrl)
      })
      .catch(() => setSrc(null))
    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl) }
  }, [signId])

  if (!src) return <div className="esig-sign-img-loading" />
  return <img src={src} alt={alt} className={className} />
}

export default function SignaturePage({ signatures, signatureFile, setSignatureFile, signatureLabel, setSignatureLabel, signSaving, onUpload, onDelete }) {
  const canvasRef = useRef(null)
  const [tab, setTab] = useState('upload')
  const [drawing, setDrawing] = useState(false)
  const [hasDrawing, setHasDrawing] = useState(false)
  const [penColor, setPenColor] = useState('#000000')
  const [penSize, setPenSize] = useState(3)
  const [previewUrl, setPreviewUrl] = useState(null)

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect()
    const src = e.touches ? e.touches[0] : e
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: (src.clientX - rect.left) * scaleX,
      y: (src.clientY - rect.top) * scaleY,
    }
  }

  const startDraw = (e) => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d')
    const { x, y } = getPos(e, canvas)
    ctx.beginPath(); ctx.moveTo(x, y)
    ctx.strokeStyle = penColor; ctx.lineWidth = penSize
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    setDrawing(true)
    e.preventDefault()
  }

  const draw = (e) => {
    if (!drawing) return
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d')
    const { x, y } = getPos(e, canvas)
    ctx.lineTo(x, y); ctx.stroke()
    setHasDrawing(true)
    e.preventDefault()
  }

  const endDraw = () => setDrawing(false)

  const clearCanvas = () => {
    const canvas = canvasRef.current; if (!canvas) return
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
    setHasDrawing(false)
  }

  const saveDrawing = () => {
    const canvas = canvasRef.current; if (!canvas || !hasDrawing) return
    const dataUrl = canvas.toDataURL('image/png')
    setPreviewUrl(dataUrl)
    fetch(dataUrl)
      .then((r) => r.blob())
      .then((blob) => setSignatureFile(new File([blob], 'signature-draw.png', { type: 'image/png' })))
    setTab('upload')
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSignatureFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setPreviewUrl(ev.target.result)
    reader.readAsDataURL(file)
  }

  const prettyCreatedAt = (dt) => {
    if (!dt) return ''
    const d = new Date(dt)
    if (Number.isNaN(d.getTime())) return ''
    return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
  }

  return (
    <div className="esig-sign-fullpage">
      <div className="esig-sign-layout">
        <div className="esig-sign-left">
          <div className="esig-sign-section-title"><FiPenTool size={14} /> 등록된 서명 ({signatures.length})</div>
          {signatures.length === 0 ? (
            <div className="esig-sign-empty-state">
              <FiEdit3 size={36} />
              <p>등록된 서명 없음</p>
              <span>우측에서 서명을 등록하세요</span>
            </div>
          ) : (
            <div className="esig-sign-list">
              {signatures.map((sig) => (
                <div key={sig.id} className="esig-sign-list-item">
                  <div className="esig-sign-list-img-wrap">
                    <SignatureImg signId={sig.id} alt={sig.label} className="esig-sign-list-img" />
                  </div>
                  <div className="esig-sign-list-info">
                    <span className="esig-sign-list-label">{sig.label || '서명'}</span>
                    <span className="esig-sign-list-date">{prettyCreatedAt(sig.createdAt)}</span>
                  </div>
                  <button className="esig-icon-btn esig-icon-btn-danger" onClick={() => onDelete(sig.id)} title="삭제">
                    <FiTrash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="esig-sign-right">
          <div className="esig-sign-tabs">
            <button className={`esig-sign-tab ${tab === 'upload' ? 'active' : ''}`} onClick={() => setTab('upload')}>
              <FiUpload size={14} /> 이미지 업로드
            </button>
            <button className={`esig-sign-tab ${tab === 'draw' ? 'active' : ''}`} onClick={() => setTab('draw')}>
              <FiEdit3 size={14} /> 직접 서명
            </button>
          </div>

          {tab === 'upload' ? (
            <div className="esig-sign-upload-panel">
              <p className="esig-sign-page-hint">PNG, JPG, SVG 등 이미지 파일을 업로드해주세요.<br />투명 배경 PNG를 권장합니다.</p>
              <label className="esig-sign-upload-zone">
                <input type="file" accept="image/*" onChange={handleFileChange} />
                <FiImage size={28} />
                <span>{signatureFile ? signatureFile.name : '클릭하여 파일 선택'}</span>
              </label>
              {previewUrl && (
                <div className="esig-sign-preview-wrap">
                  <p className="esig-sign-page-label">미리보기</p>
                  <img src={previewUrl} alt="미리보기" className="esig-sign-page-img" />
                </div>
              )}
              <div className="esig-field" style={{ marginTop: 12 }}>
                <label>서명 이름 <span className="esig-modal-optional">(선택)</span></label>
                <input
                  type="text"
                  placeholder="예: 공식 서명, 도장 등"
                  value={signatureLabel}
                  onChange={(e) => setSignatureLabel(e.target.value)}
                />
              </div>
              <button className="esig-btn esig-btn-primary" onClick={onUpload} disabled={signSaving || !signatureFile} style={{ marginTop: 12 }}>
                <FiUpload size={13} /> {signSaving ? '등록 중...' : '서명 등록'}
              </button>
            </div>
          ) : (
            <div className="esig-sign-draw-panel">
              <div className="esig-sign-draw-toolbar">
                <label className="esig-sign-draw-tool">
                  색상
                  <input type="color" value={penColor} onChange={(e) => setPenColor(e.target.value)} />
                </label>
                <label className="esig-sign-draw-tool">
                  굵기
                  <input type="range" min={1} max={10} value={penSize} onChange={(e) => setPenSize(Number(e.target.value))} />
                  <span>{penSize}px</span>
                </label>
                <button className="esig-btn esig-btn-ghost" onClick={clearCanvas}>
                  <FiRotateCcw size={13} /> 지우기
                </button>
              </div>
              <canvas
                ref={canvasRef}
                className="esig-sign-canvas"
                width={480}
                height={240}
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={endDraw}
                onMouseLeave={endDraw}
                onTouchStart={startDraw}
                onTouchMove={draw}
                onTouchEnd={endDraw}
              />
              <div className="esig-sign-draw-actions">
                <button className="esig-btn esig-btn-ghost" onClick={clearCanvas}><FiRotateCcw size={13} /> 초기화</button>
                <button className="esig-btn esig-btn-primary" onClick={saveDrawing} disabled={!hasDrawing}><FiCheck size={13} /> 이미지로 변환</button>
              </div>
              <p className="esig-sign-page-hint" style={{ marginTop: 8 }}>변환 후 '이미지 업로드' 탭에서 등록하세요.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
