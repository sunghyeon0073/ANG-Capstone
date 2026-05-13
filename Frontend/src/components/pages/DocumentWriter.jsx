import { useState, useEffect } from 'react'
import api from '../../api/axios'

export default function DocumentWriter() {
  const [documents, setDocuments] = useState([])
  const [filteredDocuments, setFilteredDocuments] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDoc, setSelectedDoc] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [prompt, setPrompt] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  useEffect(() => {
    fetchDocuments()
  }, [])

  useEffect(() => {
    const filtered = documents.filter(doc =>
      doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.originalContent?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    setFilteredDocuments(filtered)
  }, [searchTerm, documents])

  const fetchDocuments = async () => {
    try {
      setLoading(true)
      const response = await api.get('/documents')
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

  const handleAiGenerate = async () => {
    if (!prompt.trim()) {
      alert('프롬프트를 입력하세요.')
      return
    }

    try {
      setAiLoading(true)
      const response = await api.post('/documents/ai-generate', {
        prompt: prompt
      })

      if (response.data.success) {
        // 생성된 문서를 문서 목록에 추가
        setDocuments([response.data.data, ...documents])
        setSelectedDoc(response.data.data)
        setPrompt('')
        alert('문서가 생성되었습니다!')
      }
    } catch (err) {
      console.error('AI 문서 생성 실패:', err)
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
                onClick={() => setSelectedDoc(doc)}
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
        </div>

        <div className="document-content">
          {selectedDoc ? (
            <div className="selected-document">
              <h2>{selectedDoc.title}</h2>
              <div className="doc-meta">
                <span>작성일: {new Date(selectedDoc.createdAt).toLocaleDateString('ko-KR')}</span>
              </div>
              <div className="doc-body">
                {selectedDoc.originalContent || '내용이 없습니다.'}
              </div>
            </div>
          ) : (
            <div className="empty-content">
              <p>왼쪽 목록에서 문서를 선택하거나 새 문서를 작성하세요.</p>
            </div>
          )}
        </div>

        <div className="ai-prompt-section">
          <div className="prompt-header">
            <h3>AI 문서 생성</h3>
            <p>프롬프트를 입력하면 AI가 문서를 자동으로 생성합니다.</p>
          </div>
          <div className="prompt-input-group">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="생성할 문서의 주제나 내용을 입력하세요..."
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
