import React from 'react'
import { getBaseName } from '../../utils/fileUtils'
import { getDocumentPreviewKind, getFileTypeLabel } from '../../utils/documentFileUtils'

function formatDate(dateString) {
  if (!dateString) return ''
  const date = new Date(dateString)
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
}

export default function DraftStudioSidebar({
  category, setCategory,
  myScopes, selectedScopeId, setSelectedScopeId,
  searchTerm, setSearchTerm,
  sortOrder, setSortOrder,
  filteredDocuments, loading, isFetchError, documents,
  attachedDocs, toggleAttachedDoc
}) {
  return (
    <div className="draft-studio-sidebar" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff' }}>

      <div className="document-picker-controls" style={{ padding: '14px 16px 10px', background: 'var(--color-surface-muted)' }}>
        <div className="category-tabs" style={{ margin: '0', display: 'flex', gap: '6px' }}>
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
            공유 문서
          </button>
        </div>

        {category === 'dept' && myScopes.length > 0 && (
          <div className="scope-filter" style={{ marginTop: '8px' }}>
            <select
              className="scope-select"
              value={selectedScopeId}
              onChange={(e) => setSelectedScopeId(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #ccc' }}
            >
              <option value="all">전체 공유 문서보기</option>
              {myScopes.map((scope) => (
                <option key={scope.id} value={scope.id}>{scope.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="search-with-filter" style={{ display: 'flex', gap: '8px', padding: '10px 0 0' }}>
          <input
            type="text"
            placeholder="문서 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
            style={{ flex: 1, padding: '8px 12px', borderRadius: '20px', border: '1px solid #ddd' }}
          />
          <button
            type="button"
            className="sort-toggle-btn"
            onClick={() => setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')}
            title={sortOrder === 'newest' ? '최신순 (오래된순으로 변경)' : '오래된순 (최신순으로 변경)'}
            style={{ width: '36px', borderRadius: '8px', border: '1px solid #ddd', background: '#fff', cursor: 'pointer' }}
          >
            {sortOrder === 'newest' ? '↓' : '↑'}
          </button>
        </div>
      </div>

      <div className="document-list document-picker-list" style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '16px', alignContent: 'start', background: '#f8fafc' }}>
        {loading ? (
          <div className="loading">로딩 중...</div>
        ) : isFetchError ? (
          <div className="error">문서 목록을 불러올 수 없습니다.</div>
        ) : filteredDocuments.length === 0 ? (
          <div className="empty-state" style={{ textAlign: 'center', color: '#999', marginTop: '20px' }}>
            {documents.length === 0 ? '문서가 없습니다.' : '검색 결과가 없습니다.'}
          </div>
        ) : (
          filteredDocuments.map((doc) => {
            const isChecked = attachedDocs.some(d => d.docId === doc.docId)
            return (
              <div
                key={doc.docId}
                className={`document-item ${isChecked ? 'active' : ''}`}
                onClick={() => toggleAttachedDoc(doc)}
                style={{ 
                  padding: '16px', borderRadius: '12px', cursor: 'pointer',
                  border: isChecked ? '2px solid var(--color-primary)' : '1px solid #e2e8f0',
                  background: isChecked ? 'var(--color-primary-soft)' : '#fff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  transition: 'all 0.2s',
                  display: 'flex', flexDirection: 'column', gap: '12px'
                }}
              >
                <div className="document-item-row" style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <input 
                    type="checkbox" 
                    checked={isChecked} 
                    readOnly 
                    style={{ marginTop: '2px', cursor: 'pointer', transform: 'scale(1.2)' }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="doc-title" style={{ fontSize: '15px', fontWeight: '600', marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: '1.4' }}>
                      {getBaseName(doc.title)}
                    </div>
                    <div className="document-item-meta" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#64748b' }}>
                      <span className={`doc-type-tag doc-type-tag--${getDocumentPreviewKind(doc)}`}>
                        {getFileTypeLabel(doc)}
                      </span>
                      {category === 'dept' && doc.scopeName && (
                        <span className={`doc-scope-tag ${doc.scopeName === 'N/A' ? 'doc-scope-tag--personal' : ''}`}>
                          {doc.scopeName === 'N/A' ? '개인' : doc.scopeName}
                        </span>
                      )}
                      <span className="doc-date" style={{ marginLeft: 'auto' }}>
                        {formatDate(doc.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
