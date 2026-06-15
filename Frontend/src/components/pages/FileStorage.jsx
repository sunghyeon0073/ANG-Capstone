import '../../style/file-storage.css'
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  FiFileText, FiGrid, FiList, FiSearch,
  FiFilter, FiInfo, FiDownload, FiTrash2, FiStar,
  FiUsers, FiFolder, FiChevronRight, FiUploadCloud,
  FiShare2, FiRotateCcw, FiChevronLeft, FiEye
} from 'react-icons/fi';
import { 
  FaStar, FaRegStar, FaFilePdf, FaFileWord, FaFileExcel, 
  FaFileImage, FaFileAlt, FaFilePowerpoint, FaFileCsv 
} from 'react-icons/fa';
import api from '../../api/axios';
import {
  getMyDocuments,
  getDepartmentDocuments,
  getTrashDocuments,
  uploadDocument,
  deleteDocument,
  permanentDeleteDocument,
  restoreDocument,
  downloadDocumentFile,
  toggleFavorite,
  getFavoriteDocuments,
  getAllDocuments
} from '../../api/documentApi';
import { getApprovalTemplates } from '../../api/approvalApi';
import { getFileTypeLabel, getDocumentPreviewKind } from '../../utils/documentFileUtils';
import FilePreviewModal from '../file/FilePreviewModal';

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
  const ext = doc.title?.split('.').pop()?.toLowerCase() || '';

  switch (kind) {
    case 'pdf': return <FaFilePdf style={{ color: '#e74c3c' }} />;
    case 'image': return <FaFileImage style={{ color: '#2ecc71' }} />;
    case 'excel': 
      return ext === 'csv' ? <FaFileCsv style={{ color: '#27ae60' }} /> : <FaFileExcel style={{ color: '#27ae60' }} />;
    case 'word': return <FaFileWord style={{ color: '#2980b9' }} />;
    case 'hwp':
    case 'hwpx': return <FaFileAlt style={{ color: '#8e44ad' }} />;
    default: 
      if (ext === 'pptx' || ext === 'ppt') return <FaFilePowerpoint style={{ color: '#e67e22' }} />;
      return <FaFileAlt style={{ color: '#95a5a6' }} />;
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
  const [filterTypes, setFilterTypes] = useState(['all']); 
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameTitle, setRenameTitle] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'desc' });
  const [previewDoc, setPreviewDoc] = useState(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(0); // Backend is 0-indexed
  const [totalPages, setTotalPages] = useState(0);
  const itemsPerPage = 20;

  const mainRef = useRef();

  const toggleFilter = (type) => {
    setFilterTypes(prev => {
      if (type === 'all') return ['all'];
      let next = prev.filter(t => t !== 'all');
      if (next.includes(type)) {
        next = next.filter(t => t !== type);
        return next.length === 0 ? ['all'] : next;
      } else {
        return [...next, type];
      }
    });
    setCurrentPage(0);
  };

  const fetchDocs = async () => {
    try {
      setIsLoading(true);
      let res;
      const params = {
        page: currentPage,
        size: itemsPerPage,
        sort: `${sortConfig.key},${sortConfig.direction}`,
        keyword: searchQuery
      };

      if (activeTab === 'trash') {
        res = await getTrashDocuments(params);
      } else if (activeTab === 'shared') {
        res = await getDepartmentDocuments({ ...params, scopeId: targetScopeId });
      } else if (activeTab === 'important') {
        res = await getFavoriteDocuments(params);
      } else if (activeTab === 'template') {
        res = await getApprovalTemplates();
        const templates = res.data?.data || [];
        const transformedTemplates = templates.map(t => ({
          docId: `temp-${t.id}`,
          title: t.title,
          fileSize: 0,
          createdAt: t.createdAt,
          isFavorite: false,
          scopeName: t.category || '양식',
          isTemplate: true,
          formSchema: t.formSchema
        }));
        setDocs(transformedTemplates);
        setTotalPages(1);
        setIsLoading(false);
        return;
      } else if (activeTab === 'all') {
        res = await getAllDocuments(params);
      } else {
        res = await getMyDocuments(params);
      }
      
      const pagedRes = res.data?.data;
      if (pagedRes && Array.isArray(pagedRes.content)) {
        setDocs(pagedRes.content);
        setTotalPages(pagedRes.totalPages);
      } else {
        setDocs([]);
        setTotalPages(0);
      }
    } catch (error) {
      console.error('문서 로드 실패', error);
      setDocs([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleFavorite = async (e, docId) => {
    e.stopPropagation();
    try {
      const res = await toggleFavorite(docId);
      const newState = res.data?.data;
      
      if (newState !== undefined) {
        setDocs(prev => prev.map(doc => 
          doc.docId === docId ? { ...doc, isFavorite: newState } : doc
        ));

        if (activeTab === 'important' && newState === false) {
          setDocs(prev => prev.filter(doc => doc.docId !== docId));
        }
      }
    } catch (error) {
      console.error('즐겨찾기 토글 실패', error);
    }
  };

  const handleRename = async (e) => {
    e.preventDefault();
    if (!selectedDocId || !renameTitle.trim()) return;
    try {
      await api.put(`/documents/${selectedDocId}`, { title: renameTitle });
      setDocs(prev => prev.map(doc => 
        doc.docId === selectedDocId ? { ...doc, title: renameTitle } : doc
      ));
      setShowRenameModal(false);
    } catch (error) {
      alert('이름 변경 실패');
    }
  };

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
    setCurrentPage(0);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, targetScopeId, currentPage, sortConfig]);

  useEffect(() => {
    fetchMyScopes();
  }, []);

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

  const handleDeleteFromPreview = async (docId) => {
    const isTrash = activeTab === 'trash';
    const msg = isTrash
      ? '정말 영구 삭제하시겠습니까? 삭제 후에는 복구할 수 없습니다.'
      : '정말 삭제하시겠습니까? 삭제된 문서는 휴지통으로 이동합니다.';
    if (!window.confirm(msg)) return;
    try {
      if (isTrash) await permanentDeleteDocument(docId);
      else await deleteDocument(docId);
      fetchDocs();
      if (selectedDocId === docId) setSelectedDocId(null);
      setPreviewDoc(null);
    } catch {
      alert('삭제 실패');
    }
  };

  const handleRestoreFromPreview = async (docId) => {
    try {
      await restoreDocument(docId);
      fetchDocs();
      setPreviewDoc(null);
      alert('문서가 복구되었습니다.');
    } catch {
      alert('복구 실패');
    }
  };

  const renderSidebarItem = (id, icon, label) => (
    <div 
      className={`file-sidebar-item ${activeTab === id ? 'active' : ''}`}
      onClick={() => {
        if (activeTab !== id) {
          setActiveTab(id);
          setSelectedDocId(null);
          setCurrentPage(0);
        }
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
    <div className="file-page" onClick={e => e.stopPropagation()}>
      {/* Left Sidebar */}
      <aside className="file-sidebar" onClick={e => e.stopPropagation()}>
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
      <main className="file-main" ref={mainRef} onClick={e => e.stopPropagation()}>
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setCurrentPage(0);
                    fetchDocs();
                  }
                }}
              />
            </div>

            <div className="file-view-controls">
              <div className="filter-dropdown-container">
                <button 
                  className={`icon-btn ${!filterTypes.includes('all') || targetScopeId ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowFilterDropdown(!showFilterDropdown);
                  }}
                  title="필터"
                >
                  <FiFilter />
                </button>
                {showFilterDropdown && (
                  <div className="filter-dropdown" onClick={e => e.stopPropagation()}>
                  <div className="filter-group">
                    <label>파일 유형 (다중 선택)</label>
                    <div className="filter-checkbox-list">
                      {[
                        { id: 'all', label: '전체' },
                        { id: 'pdf', label: 'PDF' },
                        { id: 'hwp', label: 'HWP/X' },
                        { id: 'docx', label: 'DOCX' },
                        { id: 'excel', label: 'XLSX' },
                        { id: 'image', label: 'IMAGE' },
                      ].map(item => (
                        <label key={item.id} className="filter-checkbox-item">
                          <input 
                            type="checkbox" 
                            checked={filterTypes.includes(item.id)}
                            onChange={() => toggleFilter(item.id)}
                          />
                          {item.label}
                        </label>
                      ))}
                    </div>
                  </div>
                  {activeTab === 'shared' && (
                    <div className="filter-group">
                      <label>부서 선택</label>
                      <select 
                        className="filter-select"
                        value={targetScopeId}
                        onChange={(e) => {
                          setTargetScopeId(e.target.value);
                          setCurrentPage(0);
                        }}
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
                    style={{ width: '100%', padding: '8px', marginTop: '10px' }}
                    onClick={() => setShowFilterDropdown(false)}
                  >
                    닫기
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
                  ) : docs.length === 0 ? (
                  <div className="file-empty">
                  <FiFolder className="file-empty-icon" />
                  <p>{searchQuery ? '검색 결과가 없습니다.' : '파일이 없습니다.'}</p>
                  </div>
                  ) : viewMode === 'grid' ? (
                  <div className="file-grid">
                  {docs.map(doc => (
                  <div 
                  key={doc.docId} 
                  className={`file-card ${selectedDocId === doc.docId ? 'selected' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedDocId(prev => prev === doc.docId ? null : doc.docId);
                  }}
                  >
                  <div className="file-card-star" onClick={(e) => handleToggleFavorite(e, doc.docId)}>
                  {doc.isFavorite ? (
                    <FaStar className="file-star-icon active" />
                  ) : (
                    <FaRegStar className="file-star-icon" />
                  )}
                  </div>
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
                  <table className="file-table" onClick={e => e.stopPropagation()}>
                  <thead>
                  <tr>
                  <th className="file-table-star-cell"></th>
                  <th onClick={() => handleSort('title')} style={{ cursor: 'pointer' }}>
                  이름 {sortConfig.key === 'title' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('fileSize')} style={{ cursor: 'pointer' }}>
                  크기 {sortConfig.key === 'fileSize' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort(activeTab === 'trash' ? 'deletedAt' : 'createdAt')} style={{ cursor: 'pointer' }}>
                  {activeTab === 'trash' ? '삭제일' : '수정한 날짜'} {sortConfig.key === (activeTab === 'trash' ? 'deletedAt' : 'createdAt') && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th>부서</th>
                  </tr>
                  </thead>
                  <tbody>
                  {docs.map(doc => (
                  <tr 
                  key={doc.docId} 
                  className={selectedDocId === doc.docId ? 'selected' : ''}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedDocId(prev => prev === doc.docId ? null : doc.docId);
                  }}
                  >
                  <td className="file-table-star-cell" onClick={(e) => handleToggleFavorite(e, doc.docId)}>
                    {doc.isFavorite ? (
                      <FaStar className="file-star-icon active" />
                    ) : (
                      <FaRegStar className="file-star-icon" />
                    )}
                  </td>
                  <td>
                    <div className="file-table-name-cell">
                      <span style={{ fontSize: '30px' }}>{getFileIcon(doc)}</span>
                      <span style={{ fontSize: '15px' }}>{doc.title}</span>
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
                  {totalPages > 1 && (
                    <footer className="file-pagination">
                      <button 
                        className="pagination-btn" 
                        disabled={currentPage === 0}
                        onClick={() => setCurrentPage(prev => prev - 1)}
                      >
                        <FiChevronLeft />
                      </button>
                      <span className="pagination-info">
                        Page <strong>{currentPage + 1}</strong> of {totalPages}
                      </span>
                      <button 
                        className="pagination-btn" 
                        disabled={currentPage >= totalPages - 1}
                        onClick={() => setCurrentPage(prev => prev + 1)}
                      >
                        <FiChevronRight />
                      </button>
                    </footer>
                  )}
                  </main>

                  {/* Right Detail Panel */}
                  <aside className="file-detail-panel" onClick={e => e.stopPropagation()}>
                  {selectedDoc ? (
                  <>
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
                  {selectedDoc.fileId && (
                  <button
                  className="btn btn-secondary"
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  onClick={() => setPreviewDoc(selectedDoc)}
                  >
                  <FiEye /> 미리보기
                  </button>
                  )}
                  <button
                  className="btn btn-primary"
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  onClick={() => handleDownload(selectedDoc.fileId, selectedDoc.originalFileName || selectedDoc.title)}
                  >
                  <FiDownload /> 다운로드
                  </button>
                  <button 
                  className="btn btn-secondary" 
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  onClick={() => {
                    setRenameTitle(selectedDoc.title);
                    setShowRenameModal(true);
                  }}
                  >
                  <FiFileText /> 이름 변경
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
                  </>
                  ) : (
                    <div className="detail-empty-state">
                      <FiInfo className="detail-empty-state-icon" />
                      <p>파일을 선택하면<br/>상세 정보가 표시됩니다.</p>
                    </div>
                  )}
                  </aside>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="modal-content DMS-modal" onClick={e => e.stopPropagation()} style={{ width: '450px', padding: '0' }}>
            <div className="modal-header" style={{ padding: '20px 24px', borderBottom: '1px solid #eee', marginBottom: '0' }}>
              <h3 style={{ fontSize: '18px' }}>파일 업로드</h3>
              <button className="modal-close" onClick={() => setShowUploadModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleUpload} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="form-group">
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>문서 제목</label>
                <input 
                  className="calendar-input"
                  value={uploadTitle}
                  onChange={e => setUploadTitle(e.target.value)}
                  placeholder="제목을 입력하세요"
                  required
                  style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ced4da' }}
                />
              </div>
              <div className="form-group">
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>저장 위치</label>
                <select 
                  className="calendar-input"
                  value={targetScopeId} 
                  onChange={e => setTargetScopeId(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ced4da' }}
                >
                  <option value="">개인 보관함</option>
                  {myScopes.map(scope => (
                    <option key={scope.id} value={scope.id}>{scope.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>파일 선택</label>
                <input 
                  type="file" 
                  id="file-upload-input"
                  onChange={e => {
                    const file = e.target.files[0];
                    setUploadFile(file);
                    if (file && !uploadTitle) setUploadTitle(file.name.split('.').slice(0, -1).join('.'));
                  }}
                  required
                  style={{ display: 'none' }}
                />
                <label htmlFor="file-upload-input" className="custom-file-upload">
                  <FiUploadCloud style={{ marginRight: '8px' }} />
                  {uploadFile ? '파일 변경' : '컴퓨터에서 파일 선택'}
                </label>
                {uploadFile && (
                  <div className="selected-file-info">
                    <strong>선택된 파일:</strong> {uploadFile.name} ({formatSize(uploadFile.size)})
                  </div>
                )}
              </div>
              <div className="form-actions" style={{ marginTop: '10px', display: 'flex', gap: '12px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowUploadModal(false)} style={{ flex: 1, margin: 0 }}>취소</button>
                <button type="submit" className="btn btn-primary" disabled={uploading} style={{ flex: 1, margin: 0 }}>
                  {uploading ? '업로드 중...' : '업로드'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* File Preview Modal */}
      {previewDoc && (
        <FilePreviewModal
          doc={previewDoc}
          isTrash={activeTab === 'trash'}
          onClose={() => setPreviewDoc(null)}
          onDownload={handleDownload}
          onRename={(doc) => {
            setPreviewDoc(null);
            setSelectedDocId(doc.docId);
            setRenameTitle(doc.title);
            setShowRenameModal(true);
          }}
          onShare={() => {}}
          onDelete={handleDeleteFromPreview}
          onRestore={handleRestoreFromPreview}
        />
      )}
      {/* Rename Modal */}
      {showRenameModal && (
        <div className="modal-overlay" onClick={() => setShowRenameModal(false)}>
          <div className="modal-content DMS-modal" onClick={e => e.stopPropagation()} style={{ width: '400px' }}>
            <div className="modal-header">
              <h3>이름 변경</h3>
              <button className="modal-close" onClick={() => setShowRenameModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleRename} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div className="form-group">
                <label>새 이름</label>
                <input 
                  className="calendar-input"
                  value={renameTitle}
                  onChange={e => setRenameTitle(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <div className="form-actions" style={{ marginTop: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowRenameModal(false)}>취소</button>
                <button type="submit" className="btn btn-primary">변경</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
