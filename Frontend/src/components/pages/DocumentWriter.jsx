import { useState, useEffect, useRef } from 'react'
import api from '../../api/axios'
import { getMyDocuments, getDepartmentDocuments } from '../../api/documentApi'
// removed mock data imports - use backend APIs only
import {
  getDocumentPreviewKind,
  getFileTypeLabel,
  ACCEPTED_UPLOAD_TYPES,
  inferContentType,
  isImageDocument,
} from '../../utils/documentFileUtils'
import DocumentFilePreview from './DocumentFilePreview'
import { FiChevronRight } from 'react-icons/fi'
// use backend download endpoint instead of frontend export logic

const parseCsvToTable = (text) => {
  const lines = text.trim().split('\n').filter(Boolean)
  if (lines.length < 2) return null

  const headers = lines[0].split(',').map((cell) => cell.trim())
  const rows = lines.slice(1).map((line) => line.split(',').map((cell) => cell.trim()))
  return { headers, rows }
}

export default function DocumentWriter() {
  const [documents, setDocuments] = useState([])
  const [filteredDocuments, setFilteredDocuments] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDoc, setSelectedDoc] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [prompt, setPrompt] = useState('')
  const [aiOutputFormat, setAiOutputFormat] = useState('pdf')
  const [aiLoading, setAiLoading] = useState(false)
  const [attachedDocs, setAttachedDocs] = useState([])
  const [category, setCategory] = useState('my')
  const [previewUrl, setPreviewUrl] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [myScopes, setMyScopes] = useState([])
  const [selectedScopeId, setSelectedScopeId] = useState('all')
  const [showFullView, setShowFullView] = useState(false)
  const [promptOpen, setPromptOpen] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    const fetchScopes = async () => {
      try {
        const res = await api.get('/scopes/my')
        const scopes = res.data?.data || []
        setMyScopes(scopes)
      } catch (err) {
        console.error('소속 부서 로드 실패', err)
        setMyScopes([])
      }
    }
    fetchScopes()
  }, [])

  useEffect(() => {
    fetchDocuments()
  }, [category, selectedScopeId])

  useEffect(() => {
    const filtered = documents.filter((doc) => {
      const matchesSearch =
        doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (doc.originalContent && doc.originalContent.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (doc.originalFileName && doc.originalFileName.toLowerCase().includes(searchTerm.toLowerCase()))

      return matchesSearch
    })
    setFilteredDocuments(filtered)
  }, [searchTerm, documents])

  useEffect(() => {
    let objectUrl = null

    const loadPreview = async () => {
      setPreviewUrl(null)
      setPreviewError(null)

      if (!selectedDoc) return

      const previewKind = getDocumentPreviewKind(selectedDoc)

      if (previewKind === 'text') return

      if (
        (previewKind === 'word' && (selectedDoc.mockPreviewHtml || selectedDoc.originalContent)) ||
        (previewKind === 'excel' && (selectedDoc.mockTableData || selectedDoc.originalContent))
      ) {
        return
      }

      if (!selectedDoc.fileId || (previewKind !== 'pdf' && previewKind !== 'image')) {
        return
      }

      if (selectedDoc.mockPreviewUrl) {
        setPreviewUrl(selectedDoc.mockPreviewUrl)
        return
      }

      if (String(selectedDoc.fileId).startsWith('mock-') || String(selectedDoc.fileId).startsWith('local-')) {
        return
      }

      try {
        setPreviewLoading(true)
        const response = await api.get(`/files/preview/${selectedDoc.fileId}`, {
          responseType: 'blob',
        })
        const previewType =
          previewKind === 'pdf'
            ? 'application/pdf'
            : selectedDoc.fileContentType || response.data?.type || 'image/*'
        objectUrl = URL.createObjectURL(new Blob([response.data], { type: previewType }))
        setPreviewUrl(objectUrl)
      } catch (err) {
        console.error('문서 미리보기 로드 실패:', err)
        setPreviewError('미리보기를 불러올 수 없습니다.')
      } finally {
        setPreviewLoading(false)
      }
    }

    loadPreview()

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [selectedDoc])

  useEffect(() => {
    if (!showFullView) return undefined

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setShowFullView(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showFullView])

  const handleExport = async () => {
    if (!selectedDoc) return

    try {
      setIsExporting(true)
      // call backend download endpoint which returns file blob
      const res = await api.get(`/documents/${selectedDoc.docId}/download`, {
        responseType: 'blob',
      })

      const disposition = res.headers['content-disposition']
      let filename = selectedDoc.originalFileName || selectedDoc.title || 'document'
      if (disposition) {
        const match = disposition.match(/filename\*=UTF-8''(.+)|filename="?([^;\"]+)"?/) 
        if (match) {
          filename = decodeURIComponent(match[1] || match[2])
        }
      }

      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      window.dispatchEvent(new CustomEvent('ang:mascot-alert', {
        detail: { message: '문서를 내보냈어요!' },
      }))
    } catch (err) {
      console.error('문서다운로드 실패:', err)
      alert(err.response?.data?.message || err.message || '문서다운로드에 실패했습니다.')
    } finally {
      setIsExporting(false)
    }
  }

  const fetchDocuments = async () => {
    try { 
      setLoading(true)
      let response
      if (category === 'my') {
        response = await getMyDocuments()
      } else {
        const scopeParam = selectedScopeId === 'all' ? null : selectedScopeId
        response = await getDepartmentDocuments({ keyword: null, scopeId: scopeParam })
      }
      setDocuments(response.data?.data || [])
      setError(null)
    } catch (err) {
      console.error('문서 목록 조회 실패:', err)
      setError('문서 목록을 불러올 수 없습니다.')
      setDocuments([])
    } finally {
      setLoading(false)
    }
  }

  // file preview generation removed; rely on backend-provided documents

  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      setIsUploading(true)
      window.dispatchEvent(new CustomEvent('ang:mascot-alert', {
        detail: { message: '파일을 업로드 중입니다...' },
      }))
      const formData = new FormData()
      formData.append('file', file)
      const response = await api.post('/documents/upload', formData)

      if (response.data?.success) {
        const newDoc = { ...response.data.data, source: 'uploaded' }
        setDocuments([newDoc, ...documents])
        setSelectedDoc(newDoc)
        window.dispatchEvent(new CustomEvent('ang:mascot-alert', {
          detail: { message: '파일이 업로드되었어요!' },
        }))
      } else {
        throw new Error(response.data?.message || '파일 업로드에 실패했습니다.')
      }
    } catch (err) {
      console.error('파일 업로드 실패:', err)
      alert(err.response?.data?.message || err.message || '파일 업로드에 실패했습니다.')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleAddToPrompt = () => {
    if (selectedDoc && !attachedDocs.some((doc) => doc.docId === selectedDoc.docId)) {
      setAttachedDocs([...attachedDocs, selectedDoc])
    }
  }

  const handleRemoveAttachedDoc = (docId) => {
    setAttachedDocs(attachedDocs.filter((doc) => doc.docId !== docId))
  }

  const handleAiGenerate = async () => {
    if (!prompt.trim()) {
      alert('프롬프트를 입력하세요.')
      return
    }

    try {
      setAiLoading(true)
      window.dispatchEvent(new CustomEvent('ang:mascot-alert', {
        detail: {
          message: '문서 생성 중... 제가 열심히 뛰고 있어요.',
          animation: 'run',
        },
      }))

      const payload = {
        prompt,
        outputFormat: aiOutputFormat,
        attachedDocIds: attachedDocs.map((doc) => doc.docId),
        attachedDocs: attachedDocs.length > 0
          ? attachedDocs.map((doc) => ({
              docId: doc.docId,
              title: doc.title,
              content: doc.originalContent || doc.title,
            }))
          : null,
      }

      const response = await api.post('/documents/ai-generate', payload)

      if (response.data.success) {
        if (category === 'my') {
          setDocuments([response.data.data, ...documents])
        }
        setSelectedDoc(response.data.data)
        setPrompt('')
        setAttachedDocs([])
        window.dispatchEvent(new CustomEvent('ang:mascot-alert', {
          detail: {
            message: 'AI 문서 초안이 완성됐어요.',
            animation: 'idle',
          },
        }))
        alert('문서가 생성되었습니다!')
      }
    } catch (err) {
      console.error('AI 문서 생성 실패:', err)
      window.dispatchEvent(new CustomEvent('ang:mascot-alert', {
        detail: {
          message: 'AI 문서 생성에 실패했어요. 연결 상태를 확인해주세요.',
          animation: 'idle',
        },
      }))
      alert(err.response?.data?.message || 'AI 문서 생성에 실패했습니다.')
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div className="document-writer-container">
      <div className="document-sidebar">
        <div className="sidebar-header">
          <h3>문서 목록</h3>
          <div className="category-tabs">
            <button
              type="button"
              className={`category-tab ${category === 'my' ? 'active' : ''}`}
              onClick={() => setCategory('my')}
            >
              내 문서
            </button>
            <button
              type="button"
              className={`category-tab ${category === 'dept' ? 'active' : ''}`}
              onClick={() => setCategory('dept')}
            >
              부서 문서
            </button>
          </div>

          {category === 'dept' && myScopes.length > 0 && (
            <div className="scope-filter">
              <select
                className="scope-select"
                value={selectedScopeId}
                onChange={(e) => setSelectedScopeId(e.target.value)}
              >
                <option value="all">전체 부서 문서보기</option>
                {myScopes.map((scope) => (
                  <option key={scope.id} value={scope.id}>{scope.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="search-container">
          <input
            type="text"
            placeholder="문서 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="document-list">
          {loading ? (
            <div className="loading">로딩 중...</div>
          ) : error ? (
            <div className="error">{error}</div>
          ) : filteredDocuments.length === 0 ? (
            <div className="empty-state">
              {documents.length === 0 ? '문서가 없습니다.' : '검색 결과가 없습니다.'}
            </div>
          ) : (
            filteredDocuments.map((doc) => (
              <div
                key={doc.docId}
                className={`document-item ${selectedDoc?.docId === doc.docId ? 'active' : ''}`}
                onClick={() => setSelectedDoc(doc)}
              >
                <div className="document-item-row">
                  <div className="doc-title">{doc.title}</div>
                  <span className={`doc-type-tag doc-type-tag--${getDocumentPreviewKind(doc)}`}>
                    {getFileTypeLabel(doc)}
                  </span>
                  {category === 'dept' && doc.scopeName && (
                    <span className="doc-scope-tag">{doc.scopeName}</span>
                  )}
                </div>
                <div className="doc-date">
                  {new Date(doc.createdAt).toLocaleDateString('ko-KR')}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className={`document-main ${promptOpen ? '' : 'document-main--prompt-collapsed'}`}>
        <div className="main-header">
          <h1>AI 문서작성</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className="btn-add-document"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? '업로드 중...' : '+ 파일 추가'}
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            className="file-input-hidden"
            accept={ACCEPTED_UPLOAD_TYPES}
            onChange={handleFileSelect}
          />
        </div>

        <div className="document-content">
          {selectedDoc ? (
            <div className="selected-document">
              <div className="doc-viewer-header">
                <div className="doc-viewer-header-left">
                  <h2 className="selected-document-title">{selectedDoc.title}</h2>
                  <div className="doc-viewer-tags">
                    <span className={`doc-type-tag doc-type-tag--${getDocumentPreviewKind(selectedDoc)}`}>
                      {getFileTypeLabel(selectedDoc)}
                    </span>
                    {selectedDoc.scopeName && (
                      <span className="doc-scope-badge">{selectedDoc.scopeName}</span>
                    )}
                  </div>
                  <div className="doc-meta doc-meta--compact">
                    <span>작성일: {new Date(selectedDoc.createdAt).toLocaleDateString('ko-KR')}</span>
                    {selectedDoc.originalFileName && (
                      <span>파일: {selectedDoc.originalFileName}</span>
                    )}
                  </div>
                </div>
                <div className="doc-viewer-header-actions">
                  <button
                    type="button"
                    className="btn-viewer-action"
                    onClick={() => setShowFullView(true)}
                  >
                    전체보기
                  </button>
                  <button
                    type="button"
                    className="btn-viewer-action btn-viewer-action--primary"
                    onClick={handleExport}
                    disabled={isExporting}
                  >
                    {isExporting ? '다운로드 중...' : '다운로드'}
                  </button>
                </div>
              </div>

              <DocumentFilePreview
                doc={selectedDoc}
                previewUrl={previewUrl}
                previewLoading={previewLoading}
                previewError={previewError}
              />
            </div>
          ) : (
            <div className="empty-content">
              <p>왼쪽 목록에서 문서를 선택하거나 새 문서를 작성하세요.</p>
            </div>
          )}
        </div>

        <div className="ai-prompt-section">
          <div className="prompt-tabs">
            <button
              type="button"
              className={`prompt-toggle-compact prompt-toggle-left ${promptOpen ? 'open' : ''}`}
              onClick={() => setPromptOpen((open) => !open)}
              aria-expanded={promptOpen}
              aria-label={promptOpen ? '프롬프트 닫기' : '프롬프트 열기'}
              title={promptOpen ? '프롬프트 닫기' : '프롬프트 열기'}
            >
              <FiChevronRight />
            </button>
            {attachedDocs.map((doc) => (
              <div key={doc.docId} className="prompt-tab prompt-tab-added">
                <button
                  type="button"
                  className="tab-remove-btn"
                  onClick={() => handleRemoveAttachedDoc(doc.docId)}
                  title="제거"
                >
                  ×
                </button>
                <span className="tab-name">{doc.title}</span>
              </div>
            ))}

            {selectedDoc && !attachedDocs.some((doc) => doc.docId === selectedDoc.docId) && (
              <div
                className="prompt-tab prompt-tab-pending"
                onClick={handleAddToPrompt}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleAddToPrompt()
                  }
                }}
              >
                <span className="tab-add-btn">+</span>
                <span className="tab-name">{selectedDoc.title}</span>
              </div>
            )}
          </div>

          {promptOpen && (
          <div className="prompt-input-group">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="프롬프트를 입력하세요..."
              className="prompt-textarea"
              disabled={aiLoading}
            />

            <div className="prompt-actions">
              <div className="ai-format-selector" aria-label="AI 문서 형식 선택">
                {['pdf', 'docx', 'xlsx', 'txt'].map((format) => (
                  <button
                    key={format}
                    type="button"
                    className={`ai-format-btn ${aiOutputFormat === format ? 'active' : ''}`}
                    onClick={() => setAiOutputFormat(format)}
                    disabled={aiLoading}
                  >
                    {format.toUpperCase()}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={handleAiGenerate}
                className="btn-generate"
                disabled={aiLoading}
              >
                {aiLoading ? '생성 중...' : 'AI 생성'}
              </button>
            </div>
          </div>
          )}
        </div>
      </div>

      {showFullView && selectedDoc && (
        <div
          className="modal-overlay doc-fullview-overlay"
          onClick={() => setShowFullView(false)}
          role="presentation"
        >
          <div
            className="doc-fullview-modal doc-fullview-modal--plain"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="doc-fullview-title"
          >
            <DocumentFilePreview
              doc={selectedDoc}
              previewUrl={previewUrl}
              previewLoading={previewLoading}
              previewError={previewError}
              variant="fullscreen"
            />
            <button
              type="button"
              className="modal-close"
              onClick={() => setShowFullView(false)}
              aria-label="닫기"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
