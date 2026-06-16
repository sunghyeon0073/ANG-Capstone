// 리팩토링: React Query 도입
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import '../../style/file-storage.css'
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  FiFileText, FiGrid, FiList, FiSearch,
  FiFilter, FiInfo, FiDownload, FiTrash2, FiStar,
  FiUsers, FiFolder, FiChevronRight, FiUploadCloud,
  FiShare2, FiRotateCcw, FiChevronLeft, FiEye
} from 'react-icons/fi';
import { FaStar, FaRegStar, FaFilePdf, FaFileWord, FaFileExcel, 
  FaFileImage, FaFileAlt, FaFilePowerpoint, FaFileCsv } from 'react-icons/fa';
// 리뷰 반영: 불필요한 axios import 제거
import {
  getMyFiles,
  getDepartmentFiles,
  getTrashFiles,
  uploadFile as apiUploadFile,
  deleteFile,
  permanentDeleteFile,
  restoreFile,
  downloadFile as apiDownloadFile,
  toggleFavoriteFile,
  getFavoriteFiles,
  getAllFiles,
  renameFile
} from '../../api/fileApi';
import { getMyScopes } from '../../api/scopeApi';
import { getApprovalTemplates } from '../../api/approvalApi';
import { getFileTypeLabel, getDocumentPreviewKind } from '../../utils/documentFileUtils';
// 리뷰 반영: 공통 유틸리티 사용
import { formatDate, formatDateTime } from '../../utils/dateUtils';
import { formatFileSize, getBaseName, getExtension } from '../../utils/fileUtils';
import FilePreviewModal from '../file/FilePreviewModal';

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
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'grid'
  const [activeTab, setActiveTab] = useState('my'); // 'my', 'shared', 'template', 'important', 'trash'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [targetScopeId, setTargetScopeId] = useState('');
  const [filterTypes, setFilterTypes] = useState(['all']); 
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameTitle, setRenameTitle] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'uploadedAt', direction: 'desc' });
  const [previewDoc, setPreviewDoc] = useState(null);
  // Pagination State
  const [currentPage, setCurrentPage] = useState(0); // Backend is 0-indexed
  const itemsPerPage = 20;

  const mainRef = useRef();

  // 리팩토링: React Query의 useQuery를 사용하여 데이터 패칭 로직 교체
  const { data: queryData = { content: [], totalPages: 0 }, isLoading, isError } = useQuery({
    queryKey: ['files', activeTab, targetScopeId, currentPage, sortConfig.key, sortConfig.direction, searchQuery],
    queryFn: async () => {
      let res;
      const isImportantTab = activeTab === 'important';
      const params = {
        page: currentPage,
        size: itemsPerPage,
        sort: `${isImportantTab ? 'createdAt' : sortConfig.key},${sortConfig.direction}`,
        keyword: searchQuery
      };

      if (activeTab === 'trash') {
        res = await getTrashFiles(params);
      } else if (activeTab === 'shared') {
        const sharedParams = { ...params };
        if (targetScopeId && targetScopeId !== 'all') {
          sharedParams.scopeId = targetScopeId;
        }
        res = await getDepartmentFiles(sharedParams);
      } else if (activeTab === 'important') {
        res = await getFavoriteFiles(params);
      } else if (activeTab === 'template') {
        res = await getApprovalTemplates();
        const templates = res.data?.data || [];
        return {
          content: templates.map(t => ({
            docId: `temp-${t.id}`,
            title: t.title,
            fileSize: 0,
            createdAt: t.createdAt,
            isFavorite: false,
            scopeName: t.category || '양식',
            isTemplate: true,
            formSchema: t.formSchema
          })),
          totalPages: 1
        };
      } else if (activeTab === 'all') {
        res = await getAllFiles(params);
      } else {
        res = await getMyFiles(params);
      }
      
      const pagedRes = res.data?.data;
      if (pagedRes && Array.isArray(pagedRes.content)) {
        return {
          content: pagedRes.content.map(item => ({
            ...item,
            docId: item.fileId,
            fileId: item.fileId,
          })),
          totalPages: pagedRes.totalPages
        };
      }
      return { content: [], totalPages: 0 };
    }
  });

  const docs = queryData.content;
  const totalPages = queryData.totalPages;

  // 리팩토링: 부서 목록도 useQuery로 전환
  const { data: myScopes = [] } = useQuery({
    queryKey: ['myScopes'],
    queryFn: async () => {
      const res = await getMyScopes();
      return res.data?.data || [];
    }
  });

  // 리팩토링: 상태 변경 로직을 useMutation으로 교체 및 캐시 자동 갱신 적용
  const uploadMutation = useMutation({
    mutationFn: (formData) => apiUploadFile(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'] });
      setShowUploadModal(false);
      setUploadTitle('');
      setUploadFile(null);
      setTargetScopeId('');
    },
    onError: (error) => {
      alert('업로드 실패: ' + (error.response?.data?.message || '오류가 발생했습니다.'));
    }
  });

  const deleteMutation = useMutation({
    mutationFn: ({ docId, isTrash }) => isTrash ? permanentDeleteFile(docId) : deleteFile(docId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['files'] });
      if (selectedDocId === variables.docId) setSelectedDocId(null);
      setPreviewDoc(null);
    },
    onError: () => alert('삭제 실패')
  });

  const restoreMutation = useMutation({
    mutationFn: (docId) => restoreFile(docId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'] });
      setPreviewDoc(null);
      alert('문서가 복구되었습니다.');
    },
    onError: () => alert('복구 실패')
  });

  const toggleFavoriteMutation = useMutation({
    mutationFn: (docId) => toggleFavoriteFile(docId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['files'] }),
    onError: () => console.error('즐겨찾기 토글 실패')
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, data }) => renameFile(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'] });
      setShowRenameModal(false);
    },
    onError: () => alert('이름 변경 실패')
  });

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

  const handleToggleFavorite = (e, docId) => {
    e.stopPropagation();
    toggleFavoriteMutation.mutate(docId);
  };

  const handleRename = (e) => {
    e.preventDefault();
    if (!selectedDocId || !renameTitle.trim() || !selectedDoc) return;
    
    // 원래 확장자를 가져와서 새 이름에 붙여줍니다.
    const ext = getExtension(selectedDoc.title);
    const finalTitle = renameTitle.trim() + ext;
    
    renameMutation.mutate({ id: selectedDocId, data: { title: finalTitle } });
  };

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
    setCurrentPage(0);
  };

  const selectedDoc = useMemo(() => {
    return docs.find(d => d.docId === selectedDocId);
  }, [docs, selectedDocId]);

  const handleUpload = (e) => {
    e.preventDefault();
    if (!uploadFile) {
      alert('업로드할 파일을 선택해주세요.');
      return;
    }
    if (!uploadTitle.trim()) {
      alert('문서 제목을 입력해주세요.');
      return;
    }
    const formData = new FormData();
    formData.append('title', uploadTitle);
    formData.append('file', uploadFile);
    if (targetScopeId) {
      formData.append('targetScopeId', targetScopeId);
    }
    uploadMutation.mutate(formData);
  };

  const handleDownload = async (fileId, fileName) => {
    try {
      const res = await apiDownloadFile(fileId);
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

  const handleDelete = (docId) => {
    const isTrash = activeTab === 'trash';
    const msg = isTrash 
      ? '정말 영구 삭제하시겠습니까? 삭제 후에는 복구할 수 없습니다.' 
      : '정말 삭제하시겠습니까? 삭제된 문서는 휴지통으로 이동합니다.';
    if (!window.confirm(msg)) return;
    deleteMutation.mutate({ docId, isTrash });
  };

  const handleRestore = (docId) => {
    restoreMutation.mutate(docId);
  };

  const handleDeleteFromPreview = (docId) => {
    handleDelete(docId);
  };

  const handleRestoreFromPreview = (docId) => {
    handleRestore(docId);
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
                    // 검색어는 queryKey에 포함되어 있으므로 상태 변경만으로 리패칭됨
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
                  <div className="file-card-name" title={doc.title}>{getBaseName(doc.title)}</div>
                  <div className="file-card-meta">{formatFileSize(doc.fileSize)}</div>
                  </div>
                  </div>
                  ))}
                  </div>
                  ) : (
                  <table className="file-table" onClick={e => e.stopPropagation()}>
                  <thead>
                  <tr>
                  <th className="file-table-star-cell"></th>
                  <th onClick={() => handleSort('originalFileName')} style={{ cursor: 'pointer' }}>
                  이름 {sortConfig.key === 'originalFileName' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort('fileSize')} style={{ cursor: 'pointer' }}>
                  크기 {sortConfig.key === 'fileSize' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  <th onClick={() => handleSort(activeTab === 'trash' ? 'deletedAt' : 'uploadedAt')} style={{ cursor: 'pointer' }}>
                  {activeTab === 'trash' ? '삭제일' : '수정한 날짜'} {sortConfig.key === (activeTab === 'trash' ? 'deletedAt' : 'uploadedAt') && (sortConfig.direction === 'asc' ? '↑' : '↓')}
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
                      <span style={{ fontSize: '15px' }}>{getBaseName(doc.title)}</span>
                    </div>
                  </td>

                  <td>{formatFileSize(doc.fileSize)}</td>
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
                  <div className="detail-title">{getBaseName(selectedDoc.title)}</div>

                  <div className="detail-info-list">
                  <div className="detail-info-item">
                  <span className="detail-info-label">유형</span>
                  <span className="detail-info-value">{getFileTypeLabel(selectedDoc)}</span>
                  </div>
                  <div className="detail-info-item">
                  <span className="detail-info-label">크기</span>
                  <span className="detail-info-value">{formatFileSize(selectedDoc.fileSize)}</span>
                  </div>
                  <div className="detail-info-item">
                  <span className="detail-info-label">위치</span>
                  <span className="detail-info-value">{selectedDoc.scopeName !== 'N/A' ? selectedDoc.scopeName : '개인 문서함'}</span>
                  </div>
                  <div className="detail-info-item">
                  <span className="detail-info-label">생성일</span>
                  <span className="detail-info-value">{formatDateTime(selectedDoc.createdAt).date} {formatDateTime(selectedDoc.createdAt).time}</span>
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
                    setRenameTitle(getBaseName(selectedDoc.title));
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
                    if (file && !uploadTitle) setUploadTitle(getBaseName(file.name));
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
                    <strong>선택된 파일:</strong> {uploadFile.name} ({formatFileSize(uploadFile.size)})
                  </div>
                )}
              </div>
              <div className="form-actions" style={{ marginTop: '10px', display: 'flex', gap: '12px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowUploadModal(false)} style={{ flex: 1, margin: 0 }}>취소</button>
                <button type="submit" className="btn btn-primary" disabled={uploadMutation.isPending} style={{ flex: 1, margin: 0 }}>
                  {uploadMutation.isPending ? '업로드 중...' : '업로드'}
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
            setRenameTitle(getBaseName(doc.title));
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
