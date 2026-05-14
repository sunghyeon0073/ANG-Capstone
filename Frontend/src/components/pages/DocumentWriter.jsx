import { useState, useEffect, useRef } from 'react'
import api from '../../api/axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'
const fileStreamUrl = (fileId) => `${API_BASE_URL}/files/stream/${fileId}`
const fileDownloadUrl = (fileId) => `${API_BASE_URL}/files/download/${fileId}`

export default function DocumentWriter() {
  const [documents, setDocuments] = useState([])
  const [filteredDocuments, setFilteredDocuments] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDoc, setSelectedDoc] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [prompt, setPrompt] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [attachedDocs, setAttachedDocs] = useState([])
  const [isUploading, setIsUploading] = useState(false)
  const [docFilter, setDocFilter] = useState('all')
  const [showDocSelector, setShowDocSelector] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    fetchDocuments()
  }, [])

  useEffect(() => {
    const filtered = documents.filter(doc => {
      const matchesSearch =
        doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.originalContent?.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesFilter =
        docFilter === 'all' ||
        (docFilter === 'server' && doc.source === 'server') ||
        (docFilter === 'uploaded' && doc.source === 'uploaded')

      return matchesSearch && matchesFilter
    })
    setFilteredDocuments(filtered)
  }, [searchTerm, documents, docFilter])

  const fetchDocuments = async () => {
    try {
      setLoading(true)
      const response = await api.get('/documents')
      const docs = (response.data?.data || []).map(doc => ({
        ...doc,
        source: doc.source || 'server'
      }))
      setDocuments(docs)
      setError(null)
    } catch (err) {
      console.error('문서 목록 조회 실패:', err)
      setDocuments([])
      setError('문서 목록을 불러올 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      setIsUploading(true)
      const formData = new FormData()
      formData.append('file', file)

      window.dispatchEvent(new CustomEvent('ang:mascot-alert', {
        detail: { message: '파일을 업로드 중입니다...' }
      }))

      const response = await api.post('/documents/upload', formData)

      if (response.data.success) {
        const newDoc = response.data.data
        newDoc.source = 'uploaded'
        setDocuments([newDoc, ...documents])
        setSelectedDoc(newDoc)
        window.dispatchEvent(new CustomEvent('ang:mascot-alert', {
          detail: { message: '파일이 업로드되었어요!' }
        }))
      }
    } catch (err) {
      console.error('파일 업로드 실패:', err)
      window.dispatchEvent(new CustomEvent('ang:mascot-alert', {
        detail: { message: '파일 업로드에 실패했습니다.' }
      }))
      alert(err.response?.data?.message || '파일 업로드에 실패했습니다.')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleSelectDocument = (doc) => {
    setSelectedDoc(doc)
  }

  const handleAddDocumentClick = () => {
    fileInputRef.current?.click()
  }

  const handleAddToPrompt = () => {
    if (selectedDoc && !attachedDocs.some(d => d.docId === selectedDoc.docId)) {
      setAttachedDocs([...attachedDocs, selectedDoc])
    }
  }

  const handleAttachDocument = (doc) => {
    const isAttached = attachedDocs.some(d => d.docId === doc.docId)
    if (isAttached) {
      setAttachedDocs(attachedDocs.filter(d => d.docId !== doc.docId))
    } else {
      setAttachedDocs([...attachedDocs, doc])
    }
  }

  const handleRemoveAttachedDoc = (docId) => {
    setAttachedDocs(attachedDocs.filter(d => d.docId !== docId))
  }

  const handleAiGenerate = async () => {
    if (!prompt.trim()) {
      alert('프롬프트를 입력하세요.')
      return
    }

    try {
      setAiLoading(true)
      window.dispatchEvent(new CustomEvent('ang:mascot-alert', {
        detail: { message: '문서 읽는 중... 잠시만 기다려주세요.' }
      }))

      const payload = {
        prompt: prompt,
        attachedDocIds: attachedDocs.map(d => d.docId),
        attachedDocs: attachedDocs.length > 0 ? attachedDocs.map(d => ({
          docId: d.docId,
          title: d.title,
          content: d.originalContent
        })) : null
      }

      const response = await api.post('/documents/ai-generate', payload)

      if (response.data.success) {
        setDocuments([response.data.data, ...documents])
        setSelectedDoc(response.data.data)
        setPrompt('')
        setAttachedDocs([])
        window.dispatchEvent(new CustomEvent('ang:mascot-alert', {
          detail: { message: 'AI 문서 초안이 완성됐어요.' }
        }))
        alert('문서가 생성되었습니다!')
      }
    } catch (err) {
      console.error('AI 문서 생성 실패:', err)
      window.dispatchEvent(new CustomEvent('ang:mascot-alert', {
        detail: { message: 'AI 문서 생성에 실패했어요. 연결 상태를 확인해주세요.' }
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
          <div className="doc-filter-buttons">
            <button
              className={`filter-btn ${docFilter === 'all' ? 'active' : ''}`}
              onClick={() => setDocFilter('all')}
              title="모든 문서"
            >
              전체
            </button>
            <button
              className={`filter-btn ${docFilter === 'server' ? 'active' : ''}`}
              onClick={() => setDocFilter('server')}
              title="서버 문서"
            >
              서버
            </button>
            <button
              className={`filter-btn ${docFilter === 'uploaded' ? 'active' : ''}`}
              onClick={() => setDocFilter('uploaded')}
              title="내가 추가한 파일"
            >
              내가 추가
            </button>
          </div>
        </div>

        <div className="search-container">
          <input
            type="text"
            placeholder="문서 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
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
                onClick={() => handleSelectDocument(doc)}
              >
                <div className="doc-title">{doc.title}</div>
                <div className="doc-date">
                  {new Date(doc.createdAt).toLocaleDateString('ko-KR')}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="document-main">
        <div className="main-header">
          <h1>AI 문서작성</h1>
          <button
            className="btn-add-document"
            onClick={handleAddDocumentClick}
            disabled={isUploading}
            title="컴퓨터에서 파일 추가"
          >
            + 파일 추가
          </button>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
            accept=".txt,.pdf,.doc,.docx,.hwp,.md"
          />
        </div>

        <div className="document-content">
          {selectedDoc ? (
            <div className="selected-document">
              <h2>{selectedDoc.title}</h2>
              <div className="doc-meta">
                <span>작성일: {new Date(selectedDoc.createdAt).toLocaleDateString('ko-KR')}</span>
              </div>
              <div className="doc-body">
                {selectedDoc.fileId ? (
                  (() => {
                    const ct = selectedDoc.fileContentType || ''
                    if (ct.startsWith && ct.startsWith('image/')) {
                      return (
                        <img
                          src={fileStreamUrl(selectedDoc.fileId)}
                          alt={selectedDoc.title}
                          style={{ maxWidth: '100%' }}
                        />
                      )
                    }

                    if (ct.includes && ct.includes('pdf')) {
                      return (
                        <iframe
                          src={fileStreamUrl(selectedDoc.fileId)}
                          title={selectedDoc.title}
                          style={{ width: '100%', height: '600px', border: 'none' }}
                        />
                      )
                    }

                    // PPT/PPTX 및 기타 바이너리 파일은 인라인 렌더링이 어려움 -> 다운로드 링크 제공
                    return (
                      <div>
                        <p>미리보기를 지원하지 않는 파일 형식입니다.</p>
                        <a href={fileDownloadUrl(selectedDoc.fileId)} target="_blank" rel="noopener noreferrer">파일 다운로드</a>
                      </div>
                    )
                  })()
                ) : (
                  (selectedDoc.originalContent && selectedDoc.originalContent.trim()) ? selectedDoc.originalContent : '내용이 없습니다.'
                )}
              </div>
            </div>
          ) : (
            <div className="empty-content">
              <p>왼쪽 목록에서 문서를 선택하거나 새 문서를 작성하세요.</p>
            </div>
          )}
        </div>

        <div className="ai-prompt-section">
          <div className="prompt-tabs">
            {attachedDocs.map((doc) => (
              <div
                key={doc.docId}
                className="prompt-tab prompt-tab-added"
              >
                <button
                  className="tab-remove-btn"
                  onClick={() => handleRemoveAttachedDoc(doc.docId)}
                  title="제거"
                >
                  ×
                </button>
                <span className="tab-name">{doc.title}</span>
              </div>
            ))}

            {selectedDoc && !attachedDocs.some(d => d.docId === selectedDoc.docId) && (
              <div
                className="prompt-tab prompt-tab-pending"
                onClick={handleAddToPrompt}
              >
                <span className="tab-add-btn">+</span>
                <span className="tab-name">{selectedDoc.title}</span>
              </div>
            )}
          </div>

          <div className="prompt-input-group">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="프롬프트를 입력하세요..."
              className="prompt-textarea"
              disabled={aiLoading}
            />

            <div className="prompt-actions">
              <button
                onClick={handleAiGenerate}
                className="btn-generate"
                disabled={aiLoading}
              >
                {aiLoading ? '생성 중...' : 'AI 생성'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
