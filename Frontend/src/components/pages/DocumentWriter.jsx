import { useEffect, useRef, useState } from 'react'
import api from '../../api/axios'
import { getDepartmentDocuments, getMyDocuments } from '../../api/documentApi'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'
const filePreviewUrl = (fileId) => `${API_BASE_URL}/files/preview/${fileId}`
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
  const [previewError, setPreviewError] = useState(false)
  const [category, setCategory] = useState('my')
  const [myScopes, setMyScopes] = useState([])
  const [selectedScopeId, setSelectedScopeId] = useState('all')
  const fileInputRef = useRef(null)

  useEffect(() => {
    const fetchScopes = async () => {
      try {
        const res = await api.get('/scopes/my')
        setMyScopes(res.data?.data || [])
      } catch (err) {
        console.error('소속 부서 로드 실패', err)
      }
    }

    fetchScopes()
  }, [])

  useEffect(() => {
    fetchDocuments()
  }, [category, selectedScopeId])

  useEffect(() => {
    const term = searchTerm.toLowerCase()
    const filtered = documents.filter(doc =>
      doc.title?.toLowerCase().includes(term) ||
      doc.originalContent?.toLowerCase().includes(term)
    )
    setFilteredDocuments(filtered)
  }, [searchTerm, documents])

  const fetchDocuments = async () => {
    try {
      setLoading(true)
      const response = category === 'my'
        ? await getMyDocuments()
        : await getDepartmentDocuments(null, selectedScopeId === 'all' ? null : selectedScopeId)

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

  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      setIsUploading(true)
      const formData = new FormData()
      formData.append('title', file.name)
      formData.append('file', file)

      if (category === 'dept' && selectedScopeId !== 'all') {
        formData.append('targetScopeId', selectedScopeId)
      }

      window.dispatchEvent(new CustomEvent('ang:mascot-alert', {
        detail: { message: '파일을 업로드 중입니다...' }
      }))

      const response = await api.post('/documents', formData)

      if (response.data.success) {
        const docId = response.data.data
        const detailResponse = await api.get(`/documents/${docId}`)
        const newDoc = { ...detailResponse.data.data, source: 'uploaded' }
        setDocuments(prev => [newDoc, ...prev])
        setSelectedDoc(newDoc)
        setPreviewError(false)
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
    setPreviewError(false)
  }

  const handleAddDocumentClick = () => {
    fileInputRef.current?.click()
  }

  const handleAddToPrompt = () => {
    if (selectedDoc && !attachedDocs.some(d => d.docId === selectedDoc.docId)) {
      setAttachedDocs(prev => [...prev, selectedDoc])
    }
  }

  const handleRemoveAttachedDoc = (docId) => {
    setAttachedDocs(prev => prev.filter(d => d.docId !== docId))
  }

  const handleAiGenerate = async () => {
    if (!prompt.trim()) {
      alert('프롬프트를 입력하세요.')
      return
    }

    try {
      setAiLoading(true)
      window.dispatchEvent(new CustomEvent('ang:mascot-alert', {
        detail: { message: '문서 생성 중... 잠시만 기다려주세요.' }
      }))

      const response = await api.post('/documents/ai-generate', {
        prompt,
        attachedDocIds: attachedDocs.map(d => d.docId),
        attachedDocs: attachedDocs.map(d => ({
          docId: d.docId,
          title: d.title,
          content: d.originalContent
        }))
      })

      if (response.data.success) {
        if (category === 'my') {
          setDocuments(prev => [response.data.data, ...prev])
        }
        setSelectedDoc(response.data.data)
        setPreviewError(false)
        setPrompt('')
        setAttachedDocs([])
        window.dispatchEvent(new CustomEvent('ang:mascot-alert', {
          detail: { message: 'AI 문서 초안이 완성됐어요.' }
        }))
        alert('문서가 생성되었습니다!')
      }
    } catch (err) {
      console.error('AI 문서 생성 실패:', err)
      alert(err.response?.data?.message || 'AI 문서 생성에 실패했습니다.')
    } finally {
      setAiLoading(false)
    }
  }

  const renderDocumentBody = () => {
    if (!selectedDoc.fileId) {
      return selectedDoc.originalContent?.trim() || '내용이 없습니다.'
    }

    if (previewError) {
      return renderPreviewFallback()
    }

    return (
      <iframe
        src={filePreviewUrl(selectedDoc.fileId)}
        title={selectedDoc.title}
        onError={() => setPreviewError(true)}
        style={{ width: '100%', height: '600px', border: 'none' }}
      />
    )
  }

  const renderPreviewFallback = () => (
    <div>
      <p>미리보기를 불러올 수 없습니다.</p>
      <a href={fileDownloadUrl(selectedDoc.fileId)} target="_blank" rel="noopener noreferrer">파일 다운로드</a>
    </div>
  )

  return (
    <div className="document-writer-container">
      <div className="document-sidebar">
        <div className="sidebar-header">
          <h3>문서 목록</h3>
          <div className="category-tabs" style={{ display: 'flex', marginTop: 10, borderBottom: '1px solid #eee' }}>
            <button
              onClick={() => setCategory('my')}
              style={{
                flex: 1,
                padding: '8px 0',
                border: 'none',
                background: 'none',
                borderBottom: category === 'my' ? '2px solid #4A90D9' : 'none',
                color: category === 'my' ? '#4A90D9' : '#888',
                cursor: 'pointer',
                fontWeight: category === 'my' ? 'bold' : 'normal'
              }}
            >
              내 문서
            </button>
            <button
              onClick={() => setCategory('dept')}
              style={{
                flex: 1,
                padding: '8px 0',
                border: 'none',
                background: 'none',
                borderBottom: category === 'dept' ? '2px solid #4A90D9' : 'none',
                color: category === 'dept' ? '#4A90D9' : '#888',
                cursor: 'pointer',
                fontWeight: category === 'dept' ? 'bold' : 'normal'
              }}
            >
              부서 문서
            </button>
          </div>

          {category === 'dept' && myScopes.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <select
                value={selectedScopeId}
                onChange={(e) => setSelectedScopeId(e.target.value)}
                style={{ width: '100%', padding: '6px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13 }}
              >
                <option value="all">전체 부서 문서보기</option>
                {myScopes.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
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
                onClick={() => handleSelectDocument(doc)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div className="doc-title">{doc.title}</div>
                  {category === 'dept' && doc.scopeName && (
                    <span style={{ fontSize: 10, background: '#f0f0f0', padding: '2px 4px', borderRadius: 4, color: '#666', marginLeft: 4 }}>
                      {doc.scopeName}
                    </span>
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
            accept=".txt,.pdf,.doc,.docx,.hwp,.md,.ppt,.pptx"
          />
        </div>

        <div className="document-content">
          {selectedDoc ? (
            <div className="selected-document">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <h2 style={{ margin: 0 }}>{selectedDoc.title}</h2>
                {selectedDoc.scopeName && (
                  <span style={{ fontSize: 12, background: '#e7f3ff', color: '#007bff', padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>
                    {selectedDoc.scopeName}
                  </span>
                )}
              </div>
              <div className="doc-meta">
                <span>작성일: {new Date(selectedDoc.createdAt).toLocaleDateString('ko-KR')}</span>
              </div>
              <div className="doc-body" style={{ whiteSpace: selectedDoc.fileId ? 'normal' : 'pre-wrap', lineHeight: '1.6' }}>
                {renderDocumentBody()}
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
              <div key={doc.docId} className="prompt-tab prompt-tab-added">
                <button
                  className="tab-remove-btn"
                  onClick={() => handleRemoveAttachedDoc(doc.docId)}
                  title="제거"
                >
                  x
                </button>
                <span className="tab-name">{doc.title}</span>
              </div>
            ))}

            {selectedDoc && !attachedDocs.some(d => d.docId === selectedDoc.docId) && (
              <div className="prompt-tab prompt-tab-pending" onClick={handleAddToPrompt}>
                <span className="tab-add-btn">+</span>
                <span className="tab-name">{selectedDoc.title}</span>
              </div>
            )}
          </div>

          <div className="prompt-header">
            <h3>AI 문서 생성</h3>
            <p>프롬프트를 입력하면 AI가 문서를 자동으로 생성합니다.</p>
          </div>
          <div className="prompt-input-group">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="생성할 문서의 주제와 내용을 입력하세요..."
              className="prompt-textarea"
              disabled={aiLoading}
            />
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
  )
}
