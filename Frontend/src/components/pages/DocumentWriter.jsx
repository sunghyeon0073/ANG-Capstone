import { useState, useEffect } from 'react'
import api from '../../api/axios'
import { getMyDocuments, getDepartmentDocuments } from '../../api/documentApi'
import { getScopes } from '../../api/scopeApi' // 본인 소속 부서 목록을 가져오기 위함

export default function DocumentWriter() {
  const [documents, setDocuments] = useState([])
  const [filteredDocuments, setFilteredDocuments] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDoc, setSelectedDoc] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [prompt, setPrompt] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [category, setCategory] = useState('my') // 'my' 또는 'dept'
  
  // 다중 부서 처리를 위한 상태
  const [myScopes, setMyScopes] = useState([])
  const [selectedScopeId, setSelectedScopeId] = useState('all') // 'all' 또는 특정 scopeId

  // 1. 초기 로딩 시 소속 부서 목록 가져오기
  useEffect(() => {
    const fetchScopes = async () => {
      try {
        const res = await api.get('/scopes/my'); // 본인이 소속된 부서 목록 API
        setMyScopes(res.data?.data || []);
      } catch (err) {
        console.error('소속 부서 로드 실패', err);
      }
    };
    fetchScopes();
  }, []);

  // 2. 카테고리나 선택된 부서가 바뀔 때마다 문서 목록 갱신
  useEffect(() => {
    fetchDocuments()
  }, [category, selectedScopeId])

  useEffect(() => {
    const filtered = documents.filter(doc =>
      doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.originalContent && doc.originalContent.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    setFilteredDocuments(filtered)
  }, [searchTerm, documents])

  const fetchDocuments = async () => {
    try {
      setLoading(true)
      let response;
      if (category === 'my') {
        response = await getMyDocuments();
      } else {
        // 부서 문서일 경우 선택된 scopeId가 있으면 해당 부서만, 없으면 전체(null) 조회
        const scopeParam = selectedScopeId === 'all' ? null : selectedScopeId;
        response = await getDepartmentDocuments(null, scopeParam);
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
        prompt: prompt
      })

      if (response.data.success) {
        if (category === 'my') {
          setDocuments([response.data.data, ...documents])
        }
        setSelectedDoc(response.data.data)
        setPrompt('')
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

  return (
    <div className="document-writer-container">
      <div className="document-sidebar">
        <div className="sidebar-header">
          <h3>문서 목록</h3>
          <div className="category-tabs" style={{ display: 'flex', marginTop: 10, borderBottom: '1px solid #eee' }}>
            <button 
              onClick={() => setCategory('my')}
              style={{ 
                flex: 1, padding: '8px 0', border: 'none', background: 'none',
                borderBottom: category === 'my' ? '2px solid #4A90D9' : 'none',
                color: category === 'my' ? '#4A90D9' : '#888', cursor: 'pointer', fontWeight: category === 'my' ? 'bold' : 'normal'
              }}
            >내 문서</button>
            <button 
              onClick={() => setCategory('dept')}
              style={{ 
                flex: 1, padding: '8px 0', border: 'none', background: 'none',
                borderBottom: category === 'dept' ? '2px solid #4A90D9' : 'none',
                color: category === 'dept' ? '#4A90D9' : '#888', cursor: 'pointer', fontWeight: category === 'dept' ? 'bold' : 'normal'
              }}
            >부서 문서</button>
          </div>
          
          {/* 부서 선택 필터 (부서 문서 탭일 때만 노출) */}
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
                onClick={() => setSelectedDoc(doc)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div className="doc-title">{doc.title}</div>
                  {/* 부서 문서 탭에서 전체보기일 때 부서 이름 태그 표시 */}
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
              <div className="doc-body" style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
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
