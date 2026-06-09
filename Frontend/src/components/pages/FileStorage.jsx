import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  FiFile, FiImage, FiFileText, FiGrid, FiList, FiSearch, 
  FiFilter, FiInfo, FiDownload, FiTrash2, FiStar, 
  FiClock, FiUsers, FiFolder, FiChevronRight, FiUploadCloud,
  FiMoreVertical, FiShare2, FiRotateCcw
} from 'react-icons/fi';
import api from '../../api/axios';
import {
  getMyDocuments,
  getDepartmentDocuments,
  getTrashDocuments,
  uploadDocument,
  deleteDocument,
  permanentDeleteDocument,
  restoreDocument,
  getDocument,
  downloadDocumentFile
} from '../../api/documentApi';
import { getFileTypeLabel, getDocumentPreviewKind } from '../../utils/documentFileUtils';

const formatDate = (iso, includeTime = false) => {
  if (!iso) return '-';
  const date = new Date(iso);
  const dateStr = date.toLocaleDateString('ko-KR');
  if (!includeTime) return dateStr;
  const timeStr = date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  return `${dateStr} ${timeStr}`;
};

const formatSize = (bytes) => {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getFileIcon = (doc) => {
  const kind = getDocumentPreviewKind(doc);
  switch (kind) {
    case 'pdf': return <FiFileText style={{ color: '#e74c3c' }} />;
    case 'image': return <FiImage style={{ color: '#2ecc71' }} />;
    case 'excel': return <FiFileText style={{ color: '#27ae60' }} />;
    case 'word': return <FiFileText style={{ color: '#2980b9' }} />;
    case 'hwp': return <FiFileText style={{ color: '#8e44ad' }} />;
    default: return <FiFile style={{ color: '#95a5a6' }} />;
  }
};

export default function FileStorage() {
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'grid'
  const [activeTab, setActiveTab] = useState('my'); // 'my', 'shared', 'template', 'important', 'trash'
  const [docs, setDocs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [myScopes, setMyScopes] = useState([]);
  const [targetScopeId, setTargetScopeId] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all', 'pdf', 'image', 'document'
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  const fileInputRef = useRef();

  const fetchDocs = async () => {
    try {
      setIsLoading(true);
      let res;
      if (activeTab === 'trash') {
        res = await getTrashDocuments();
      } else if (activeTab === 'shared') {
        res = await getDepartmentDocuments({ keyword: searchQuery, scopeId: targetScopeId });
      } else {
        // For 'my', 'template', 'important' we use getMyDocuments and filter client-side for now
        res = await getMyDocuments();
      }
      
      let fetchedDocs = res.data?.data || [];
      setDocs(fetchedDocs);
    } catch (error) {
      console.error('문서 로드 실패', error);
      setDocs([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMyScopes = async () => {
    try {
      const res = await api.get('/scopes/my');
      setMyScopes(res.data?.data || []);
    } catch (error) {
      console.error('부서 목록 로드 실패', error);
    }
  };

  useEffect(() => {
    fetchDocs();
    fetchMyScopes();
  }, [activeTab, targetScopeId]);

  const filteredDocs = useMemo(() => {
    return docs.filter(doc => {
      const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            (doc.originalFileName && doc.originalFileName.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const kind = getDocumentPreviewKind(doc);
      let matchesType = true;
      if (filterType === 'pdf') matchesType = kind === 'pdf';
      else if (filterType === 'image') matchesType = kind === 'image';
      else if (filterType === 'document') matchesType = ['word', 'excel', 'hwp'].includes(kind);

      return matchesSearch && matchesType;
    });
  }, [docs, searchQuery, filterType]);

  const selectedDoc = useMemo(() => {
    return docs.find(d => d.docId === selectedDocId);
  }, [docs, selectedDocId]);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile || !uploadTitle.trim()) return;
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('title', uploadTitle);
      formData.append('file', uploadFile);
      if (targetScopeId) {
        formData.append('targetScopeId', targetScopeId);
      }
      
      await uploadDocument(formData);
      setShowUploadModal(false);
      setUploadTitle('');
      setUploadFile(null);
      setTargetScopeId('');
      fetchDocs();
    } catch (error) {
      alert('업로드 실패: ' + (error.response?.data?.message || '오류가 발생했습니다.'));
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (fileId, fileName) => {
    try {
      const res = await downloadDocumentFile(fileId);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName || 'file');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert('파일 다운로드에 실패했습니다.');
    }
  };

  const handleDelete = async (docId) => {
    const isTrash = activeTab === 'trash';
    const msg = isTrash 
      ? '정말 영구 삭제하시겠습니까? 삭제 후에는 복구할 수 없습니다.' 
      : '정말 삭제하시겠습니까? 삭제된 문서는 휴지통으로 이동합니다.';
    if (!window.confirm(msg)) return;
    try {
      if (isTrash) {
        await permanentDeleteDocument(docId);
      } else {
        await deleteDocument(docId);
      }
      fetchDocs();
      if (selectedDocId === docId) setSelectedDocId(null);
    } catch (error) {
      alert('삭제 실패');
    }
  };

  const handleRestore = async (docId) => {
    try {
      await restoreDocument(docId);
      fetchDocs();
      alert('문서가 복구되었습니다.');
    } catch (error) {
      alert('복구 실패');
    }
  };

  const renderSidebarItem = (id, icon, label) => (
    <div 
      className={`file-sidebar-item ${activeTab === id ? 'active' : ''}`}
      onClick={() => {
        setActiveTab(id);
        setSelectedDocId(null);
      }}
    >
      <span className="file-sidebar-icon">{icon}</span>
      {label}
    </div>
  );

  const getPageTitle = () => {
    switch (activeTab) {
      case 'my': return '내 파일';
      case 'shared': return '공유 문서함';
      case 'template': return '빈 양식';
      case 'important': return '중요 문서';
      case 'trash': return '휴지통';
      default: return '파일함';
    }
  };

  return (
    <div className="file-page">
      {/* Left Sidebar */}
      <aside className="file-sidebar">
        <div style={{ padding: '0 24px 20px' }}>
          <button 
            className="btn btn-primary" 
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px' }}
            onClick={() => setShowUploadModal(true)}
          >
            <FiUploadCloud /> 업로드
          </button>
        </div>
        
        {renderSidebarItem('my', <FiFolder />, '내 파일')}
        {renderSidebarItem('shared', <FiUsers />, '공유 문서함')}
        {renderSidebarItem('important', <FiStar />, '중요 문서')}
        {renderSidebarItem('template', <FiFileText />, '빈 양식')}
        <div style={{ flex: 1 }} />
        {renderSidebarItem('trash', <FiTrash2 />, '휴지통')}
      </aside>

      {/* Main Content */}
      <main className="file-main">
        <header className="file-main-header">
          <div className="file-breadcrumb">
            <FiFolder style={{ marginRight: '8px', color: 'var(--color-primary)' }} />
            {getPageTitle()}
            {targetScopeId && (
              <>
                <FiChevronRight style={{ fontSize: '14px', color: '#adb5bd' }} />
                <span style={{ fontSize: '14px', color: '#666', fontWeight: 'normal' }}>
                  {myScopes.find(s => s.id == targetScopeId)?.name || '부서'}
                </span>
              </>
            )}
          </div>

          <div className="file-actions-bar">
            <div className="file-search-container">
              <FiSearch style={{ color: '#adb5bd' }} />
              <input 
                type="text" 
                className="file-search-input" 
                placeholder="파일 이름으로 검색..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="file-view-controls">
              <div className="filter-dropdown-container">
                <button 
                  className={`icon-btn ${filterType !== 'all' || targetScopeId ? 'active' : ''}`}
                  onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                  title="필터"
                >
                  <FiFilter />
                </button>
                {showFilterDropdown && (
                  <div className="filter-dropdown">
                    <div className="filter-group">
                      <label>파일 형식</label>
                      <select 
                        className="filter-select"
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                      >
                        <option value="all">전체</option>
                        <option value="pdf">PDF 문서</option>
                        <option value="image">이미지</option>
                        <option value="document">오피스 문서 (Word, Excel, HWP)</option>
                      </select>
                    </div>
                    {activeTab === 'shared' && (
                      <div className="filter-group">
                        <label>부서 선택</label>
                        <select 
                          className="filter-select"
                          value={targetScopeId}
                          onChange={(e) => setTargetScopeId(e.target.value)}
                        >
                          <option value="">전체 부서</option>
                          {myScopes.map(scope => (
                            <option key={scope.id} value={scope.id}>{scope.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <button 
                      className="btn btn-primary" 
                      style={{ width: '100%', padding: '6px' }}
                      onClick={() => setShowFilterDropdown(false)}
                    >
                      적용
                    </button>
                  </div>
                )}
              </div>
              <button 
                className={`icon-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
                title="목록 보기"
              >
                <FiList />
              </button>
              <button 
                className={`icon-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
                title="그리드 보기"
              >
                <FiGrid />
              </button>
            </div>
          </div>
        </header>

        <div className="file-content-scroll">
          {isLoading ? (
            <div className="file-empty">
              <div className="spinner" />
              <p>파일을 불러오는 중...</p>
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="file-empty">
              <FiFolder className="file-empty-icon" />
              <p>{searchQuery ? '검색 결과가 없습니다.' : '파일이 없습니다.'}</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="file-grid">
              {filteredDocs.map(doc => (
                <div 
                  key={doc.docId} 
                  className={`file-card ${selectedDocId === doc.docId ? 'selected' : ''}`}
                  onClick={() => setSelectedDocId(doc.docId)}
                  onDoubleClick={() => activeTab !== 'trash' && handleDownload(doc.fileId, doc.originalFileName)}
                >
                  <div className="file-card-icon">
                    {getFileIcon(doc)}
                  </div>
                  <div className="file-card-info">
                    <div className="file-card-name" title={doc.title}>{doc.title}</div>
                    <div className="file-card-meta">{formatSize(doc.fileSize)}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <table className="file-table">
              <thead>
                <tr>
                  <th>이름</th>
                  <th>크기</th>
                  <th>{activeTab === 'trash' ? '삭제일' : '수정한 날짜'}</th>
                  <th>부서</th>
                </tr>
              </thead>
              <tbody>
                {filteredDocs.map(doc => (
                  <tr 
                    key={doc.docId} 
                    className={selectedDocId === doc.docId ? 'selected' : ''}
                    onClick={() => setSelectedDocId(doc.docId)}
                    onDoubleClick={() => activeTab !== 'trash' && handleDownload(doc.fileId, doc.originalFileName)}
                  >
                    <td>
                      <div className="file-table-name-cell">
                        <span style={{ fontSize: '18px' }}>{getFileIcon(doc)}</span>
                        <span>{doc.title}</span>
                      </div>
                    </td>
                    <td>{formatSize(doc.fileSize)}</td>
                    <td>{formatDate(activeTab === 'trash' ? doc.deletedAt : doc.createdAt)}</td>
                    <td>
                      <span style={{ 
                        fontSize: '11px', 
                        color: doc.scopeName && doc.scopeName !== 'N/A' ? '#1a73e8' : '#666',
                        background: doc.scopeName && doc.scopeName !== 'N/A' ? '#e8f0fe' : '#f8f9fa',
                        padding: '2px 8px',
                        borderRadius: '10px'
                      }}>
                        {doc.scopeName && doc.scopeName !== 'N/A' ? doc.scopeName : '개인'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* Right Detail Panel */}
      {selectedDoc && (
        <aside className="file-detail-panel">
          <div className="detail-preview">
            {getFileIcon(selectedDoc)}
          </div>
          <div className="detail-title">{selectedDoc.title}</div>
          
          <div className="detail-info-list">
            <div className="detail-info-item">
              <span className="detail-info-label">유형</span>
              <span className="detail-info-value">{getFileTypeLabel(selectedDoc)}</span>
            </div>
            <div className="detail-info-item">
              <span className="detail-info-label">크기</span>
              <span className="detail-info-value">{formatSize(selectedDoc.fileSize)}</span>
            </div>
            <div className="detail-info-item">
              <span className="detail-info-label">위치</span>
              <span className="detail-info-value">{selectedDoc.scopeName !== 'N/A' ? selectedDoc.scopeName : '개인 문서함'}</span>
            </div>
            <div className="detail-info-item">
              <span className="detail-info-label">생성일</span>
              <span className="detail-info-value">{formatDate(selectedDoc.createdAt, true)}</span>
            </div>
            {activeTab === 'trash' && (
              <div className="detail-info-item">
                <span className="detail-info-label">삭제일</span>
                <span className="detail-info-value">{formatDate(selectedDoc.deletedAt, true)}</span>
              </div>
            )}
          </div>

          <div className="detail-actions">
            {activeTab === 'trash' ? (
              <>
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => handleRestore(selectedDoc.docId)}>
                  <FiRotateCcw /> 복구하기
                </button>
                <button className="btn btn-danger" style={{ width: '100%' }} onClick={() => handleDelete(selectedDoc.docId)}>
                  <FiTrash2 /> 영구 삭제
                </button>
              </>
            ) : (
              <>
                <button 
                  className="btn btn-primary" 
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  onClick={() => handleDownload(selectedDoc.fileId, selectedDoc.originalFileName || selectedDoc.title)}
                >
                  <FiDownload /> 다운로드
                </button>
                <button className="btn btn-secondary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <FiShare2 /> 공유하기
                </button>
                <button 
                  className="btn btn-danger" 
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '10px' }}
                  onClick={() => handleDelete(selectedDoc.docId)}
                >
                  <FiTrash2 /> 삭제
                </button>
              </>
            )}
          </div>
        </aside>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="modal-content DMS-modal" onClick={e => e.stopPropagation()} style={{ width: '400px' }}>
            <div className="modal-header">
              <h3>파일 업로드</h3>
              <button className="modal-close" onClick={() => setShowUploadModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleUpload} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div className="form-group">
                <label>문서 제목</label>
                <input 
                  className="calendar-input"
                  value={uploadTitle}
                  onChange={e => setUploadTitle(e.target.value)}
                  placeholder="제목을 입력하세요"
                  required
                />
              </div>
              <div className="form-group">
                <label>저장 위치</label>
                <select 
                  className="calendar-input"
                  value={targetScopeId} 
                  onChange={e => setTargetScopeId(e.target.value)}
                >
                  <option value="">개인 보관함</option>
                  {myScopes.map(scope => (
                    <option key={scope.id} value={scope.id}>{scope.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>파일 선택</label>
                <input 
                  type="file" 
                  onChange={e => {
                    const file = e.target.files[0];
                    setUploadFile(file);
                    if (file && !uploadTitle) setUploadTitle(file.name.split('.').slice(0, -1).join('.'));
                  }}
                  required
                />
              </div>
              <div className="form-actions" style={{ marginTop: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowUploadModal(false)}>취소</button>
                <button type="submit" className="btn btn-primary" disabled={uploading}>
                  {uploading ? '업로드 중...' : '업로드 시작'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
