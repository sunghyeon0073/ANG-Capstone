// 리팩토링: React Query 도입
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import '../../style/file-storage.css'
import { useState, useRef } from 'react';
import FileSourceModal from '../common/FileSourceModal';
import { showAlert } from '../../utils/alertUtils';
import { 
  FiFileText, FiGrid, FiList, FiSearch,
  FiFilter, FiInfo, FiDownload, FiTrash2, FiStar,
  FiUsers, FiFolder, FiChevronRight, FiUploadCloud,
  FiShare2, FiRotateCcw, FiChevronLeft, FiEye,
  FiMessageSquare, FiMail
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
  renameFile,
  shareFile,
} from '../../api/fileApi';
import { getMyScopes } from '../../api/scopeApi';
import { getApprovalTemplates } from '../../api/approvalApi';
import { getChatRooms, uploadChatFile } from '../../api/chatApi';
import { searchUsers } from '../../api/userApi';
import { saveMailDraft, uploadMailFile, sendMailDraft } from '../../api/mailApi';
import { getFileTypeLabel, getDocumentPreviewKind } from '../../utils/documentFileUtils';
// 리뷰 반영: 공통 유틸리티 사용
import { formatDate, formatDateTime } from '../../utils/dateUtils';
import { formatFileSize, getBaseName, getExtension } from '../../utils/fileUtils';
import FilePreviewModal from '../file/FilePreviewModal';

const FILE_TABS = new Set(['my', 'shared', 'important', 'template', 'trash', 'all']);

const getFileTabFromPage = (page) => {
  const tab = String(page || '').replace(/^file-/, '');
  return FILE_TABS.has(tab) ? tab : 'my';
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

export default function FileStorage({
  currentSubPage = 'file-my',
  onSubPageChange,
}) {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'grid'
  const activeTab = getFileTabFromPage(currentSubPage); // 'my', 'shared', 'template', 'important', 'trash'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showFileSourceModal, setShowFileSourceModal] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [targetScopeId, setTargetScopeId] = useState('');
  const [filterTypes, setFilterTypes] = useState(['all']); 
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameTitle, setRenameTitle] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareTab, setShareTab] = useState('dept');
  const [shareTargetScopeId, setShareTargetScopeId] = useState('');
  const [shareSaving, setShareSaving] = useState(false);
  const [chatRooms, setChatRooms] = useState([]);
  const [chatRoomsLoading, setChatRoomsLoading] = useState(false);
  const [selectedChatRoomId, setSelectedChatRoomId] = useState(null);
  const [chatSharing, setChatSharing] = useState(false);
  const [mailRecipientQuery, setMailRecipientQuery] = useState('');
  const [mailRecipientOptions, setMailRecipientOptions] = useState([]);
  const [selectedMailRecipients, setSelectedMailRecipients] = useState([]);
  const [mailSubject, setMailSubject] = useState('');
  const [mailBody, setMailBody] = useState('');
  const [mailSharing, setMailSharing] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'uploadedAt', direction: 'desc' });
  const [previewDoc, setPreviewDoc] = useState(null);
  // Pagination State
  const [currentPage, setCurrentPage] = useState(0); // Backend is 0-indexed
  const itemsPerPage = 20;

  const mainRef = useRef();

  // 파일 유형 필터가 활성화된 경우 서버에서 전체를 가져와 클라이언트에서 재페이징
  const isFiltered = !filterTypes.includes('all');

  const { data: queryData = { content: [], totalPages: 0 }, isLoading } = useQuery({
    // 필터 활성 시 currentPage를 key에서 제외 → 페이지 이동해도 서버 재요청 없음
    queryKey: ['files', activeTab, targetScopeId, isFiltered ? 'all' : currentPage, sortConfig.key, sortConfig.direction, searchQuery],
    queryFn: async () => {
      let res;
      const isImportantTab = activeTab === 'important';
      const params = {
        page: isFiltered ? 0 : currentPage,
        size: isFiltered ? 9999 : itemsPerPage,
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
      showAlert('업로드 실패: ' + (error.response?.data?.message || '오류가 발생했습니다.'), 'error');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: ({ docId, isTrash }) => isTrash ? permanentDeleteFile(docId) : deleteFile(docId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['files'] });
      if (selectedDocId === variables.docId) setSelectedDocId(null);
      setPreviewDoc(null);
    },
    onError: () => showAlert('삭제 실패', 'error')
  });

  const restoreMutation = useMutation({
    mutationFn: (docId) => restoreFile(docId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files'] });
      setPreviewDoc(null);
      showAlert('문서가 복구되었습니다.', 'success');
    },
    onError: () => showAlert('복구 실패', 'error')
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
    onError: () => showAlert('이름 변경 실패', 'error')
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

  const selectedDoc = docs.find(d => d.docId === selectedDocId);

  // 클라이언트 필터 적용 (필터 활성 시 서버가 전체 반환했으므로 여기서 타입 필터링)
  const filteredDocs = isFiltered ? docs.filter(doc => {
    const kind = getDocumentPreviewKind(doc);
    return filterTypes.some(f => {
      if (f === 'pdf') return kind === 'pdf';
      if (f === 'hwp') return kind === 'hwp' || kind === 'hwpx';
      if (f === 'docx') return kind === 'word';
      if (f === 'excel') return kind === 'excel';
      if (f === 'image') return kind === 'image';
      return false;
    });
  }) : docs;

  // 필터 활성: 클라이언트 페이징 / 필터 비활성: 서버 페이징 그대로
  const displayTotalPages = isFiltered ? Math.ceil(filteredDocs.length / itemsPerPage) : totalPages;
  const displayDocs = isFiltered
    ? filteredDocs.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage)
    : filteredDocs;

  const openShareModal = () => {
    setShareTab('dept');
    setShareTargetScopeId('');
    setSelectedChatRoomId(null);
    setSelectedMailRecipients([]);
    setMailSubject(`파일 공유: ${getBaseName(selectedDoc?.title || '')}`);
    setMailBody('');
    setShowShareModal(true);
  };

  const mailSearchTimerRef = useRef(null);

  const handleShareTabChange = async (tabKey) => {
    setShareTab(tabKey);
    if (tabKey === 'chat') {
      setChatRoomsLoading(true);
      try {
        const rooms = await getChatRooms();
        setChatRooms(rooms);
      } catch {
        showAlert('채팅방 목록을 불러오지 못했습니다.', 'error');
      } finally {
        setChatRoomsLoading(false);
      }
    }
  };

  const handleMailRecipientSearch = (value) => {
    setMailRecipientQuery(value);
    clearTimeout(mailSearchTimerRef.current);
    if (!value.trim()) { setMailRecipientOptions([]); return; }
    mailSearchTimerRef.current = setTimeout(() => {
      searchUsers(value)
        .then(res => setMailRecipientOptions(res.data?.data || []))
        .catch(() => setMailRecipientOptions([]));
    }, 300);
  };

  const handleChatShare = async () => {
    if (!selectedChatRoomId) { showAlert('공유할 채팅방을 선택해주세요.', 'warning'); return; }
    setChatSharing(true);
    try {
      const res = await apiDownloadFile(selectedDoc.fileId);
      const file = new File([res.data], selectedDoc.originalFileName || selectedDoc.title, { type: res.data.type });
      await uploadChatFile(selectedChatRoomId, file);
      showAlert('파일이 채팅으로 공유되었습니다.', 'success');
      setShowShareModal(false);
      setSelectedChatRoomId(null);
    } catch {
      showAlert('채팅 공유에 실패했습니다.', 'error');
    } finally {
      setChatSharing(false);
    }
  };

  const handleMailShare = async (e) => {
    e.preventDefault();
    if (selectedMailRecipients.length === 0) { showAlert('받는 사람을 선택해주세요.', 'warning'); return; }
    if (!mailSubject.trim()) { showAlert('메일 제목을 입력해주세요.', 'warning'); return; }
    setMailSharing(true);
    try {
      const recipientEmpNos = selectedMailRecipients.map(r => r.empNo);
      const draftRes = await saveMailDraft({ title: mailSubject.trim(), body: mailBody, recipientEmpNos });
      const mailId = draftRes.data?.data;
      const fileRes = await apiDownloadFile(selectedDoc.fileId);
      const file = new File([fileRes.data], selectedDoc.originalFileName || selectedDoc.title, { type: fileRes.data.type });
      await uploadMailFile(mailId, file);
      await sendMailDraft(mailId);
      showAlert('파일이 메일로 공유되었습니다.', 'success');
      setShowShareModal(false);
      setSelectedMailRecipients([]);
      setMailSubject('');
      setMailBody('');
    } catch {
      showAlert('메일 공유에 실패했습니다.', 'error');
    } finally {
      setMailSharing(false);
    }
  };

  const handleShareSubmit = async (e) => {
    e.preventDefault();
    if (!shareTargetScopeId) {
      showAlert('공유할 부서를 선택해주세요.', 'warning');
      return;
    }
    setShareSaving(true);
    try {
      await shareFile(selectedDoc.fileId, shareTargetScopeId);
      queryClient.invalidateQueries({ queryKey: ['files'] });
      showAlert('파일이 공유되었습니다.', 'success');
      setShowShareModal(false);
      setShareTargetScopeId('');
    } catch {
      showAlert('공유에 실패했습니다.', 'error');
    } finally {
      setShareSaving(false);
    }
  };

  const handleUpload = (e) => {
    e.preventDefault();
    if (!uploadFile) {
      showAlert('업로드할 파일을 선택해주세요.', 'warning');
      return;
    }
    if (!uploadTitle.trim()) {
      showAlert('문서 제목을 입력해주세요.', 'warning');
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
    } catch {
      showAlert('파일 다운로드에 실패했습니다.', 'error');
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
          setSelectedDocId(null);
          setCurrentPage(0);
          onSubPageChange?.(`file-${id}`);
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
                  ) : displayDocs.length === 0 ? (
                  <div className="file-empty">
                  <FiFolder className="file-empty-icon" />
                  <p>{searchQuery ? '검색 결과가 없습니다.' : isFiltered ? '선택한 파일 유형이 없습니다.' : '파일이 없습니다.'}</p>
                  </div>
                  ) : viewMode === 'grid' ? (
                  <div className="file-grid">
                  {displayDocs.map(doc => (
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
                  {displayDocs.map(doc => (
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
                  {displayTotalPages > 1 && (
                    <footer className="file-pagination">
                      <button
                        className="pagination-btn"
                        disabled={currentPage === 0}
                        onClick={() => setCurrentPage(prev => prev - 1)}
                      >
                        <FiChevronLeft />
                      </button>
                      <span className="pagination-info">
                        Page <strong>{currentPage + 1}</strong> of {displayTotalPages}
                      </span>
                      <button
                        className="pagination-btn"
                        disabled={currentPage >= displayTotalPages - 1}
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
                  <button
                  className="btn btn-secondary"
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  onClick={openShareModal}
                  >
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
                <button
                  type="button"
                  className="custom-file-upload"
                  onClick={() => setShowFileSourceModal(true)}
                >
                  <FiUploadCloud style={{ marginRight: '8px' }} />
                  {uploadFile ? '파일 변경' : '파일 선택'}
                </button>
                {uploadFile && (
                  <div className="selected-file-info">
                    <strong>선택된 파일:</strong> {uploadFile.name} ({formatFileSize(uploadFile.size)})
                  </div>
                )}
                <FileSourceModal
                  isOpen={showFileSourceModal}
                  onClose={() => setShowFileSourceModal(false)}
                  onFilesSelected={(files) => {
                    const file = files[0];
                    setUploadFile(file);
                    if (file && !uploadTitle) setUploadTitle(getBaseName(file.name));
                    setShowFileSourceModal(false);
                  }}
                  multiple={false}
                />
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
          onShare={() => { setPreviewDoc(null); openShareModal(); }}
          onDelete={handleDeleteFromPreview}
          onRestore={handleRestoreFromPreview}
        />
      )}
      {/* Share Modal */}
      {showShareModal && selectedDoc && (
        <div className="modal-overlay" onClick={() => setShowShareModal(false)}>
          <div className="modal-content DMS-modal" onClick={e => e.stopPropagation()} style={{ width: '460px' }}>
            <div className="modal-header">
              <h3>파일 공유</h3>
              <button className="modal-close" onClick={() => setShowShareModal(false)}>&times;</button>
            </div>
            <div style={{ padding: '0 20px 4px' }}>
              <div style={{ background: '#f8f9fa', borderRadius: '6px', padding: '10px 14px', fontSize: '13px', color: '#555', marginBottom: '16px' }}>
                <strong style={{ display: 'block', marginBottom: '2px', color: '#222' }}>{getBaseName(selectedDoc.title)}</strong>
                현재 위치: {selectedDoc.scopeName && selectedDoc.scopeName !== 'N/A' ? selectedDoc.scopeName : '개인 보관함'}
              </div>
              {/* Tabs */}
              <div style={{ display: 'flex', borderBottom: '2px solid #eee', marginBottom: '16px' }}>
                {[
                  { key: 'dept', label: '부서 공유', icon: <FiUsers size={14} /> },
                  { key: 'chat', label: '채팅 공유', icon: <FiMessageSquare size={14} /> },
                  { key: 'mail', label: '메일 공유', icon: <FiMail size={14} /> },
                ].map(tab => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => handleShareTabChange(tab.key)}
                    style={{
                      flex: 1, padding: '8px 4px', border: 'none', background: 'none',
                      cursor: 'pointer', fontSize: '13px', fontWeight: shareTab === tab.key ? '600' : '400',
                      color: shareTab === tab.key ? 'var(--color-primary)' : '#666',
                      borderBottom: shareTab === tab.key ? '2px solid var(--color-primary)' : '2px solid transparent',
                      marginBottom: '-2px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                    }}
                  >
                    {tab.icon}{tab.label}
                  </button>
                ))}
              </div>

              {/* 부서 공유 탭 */}
              {shareTab === 'dept' && (
                <form onSubmit={handleShareSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div className="form-group">
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>공유할 부서 선택</label>
                    <select
                      className="calendar-input"
                      value={shareTargetScopeId}
                      onChange={e => setShareTargetScopeId(e.target.value)}
                      style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ced4da' }}
                      required
                    >
                      <option value="">부서를 선택하세요</option>
                      {myScopes.map(scope => (
                        <option key={scope.id} value={scope.id}>{scope.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-actions" style={{ paddingBottom: '20px' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowShareModal(false)}>취소</button>
                    <button type="submit" className="btn btn-primary" disabled={shareSaving}>
                      {shareSaving ? '공유 중...' : '공유하기'}
                    </button>
                  </div>
                </form>
              )}

              {/* 채팅 공유 탭 */}
              {shareTab === 'chat' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>채팅방 선택</label>
                    {chatRoomsLoading ? (
                      <div style={{ textAlign: 'center', padding: '24px', color: '#888' }}>채팅방 불러오는 중...</div>
                    ) : chatRooms.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '24px', color: '#888' }}>참여 중인 채팅방이 없습니다.</div>
                    ) : (
                      <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #ced4da', borderRadius: '6px' }}>
                        {chatRooms.map(room => (
                          <div
                            key={room.roomId}
                            onClick={() => setSelectedChatRoomId(room.roomId)}
                            style={{
                              padding: '10px 14px', cursor: 'pointer',
                              background: selectedChatRoomId === room.roomId ? '#e8f0fe' : 'transparent',
                              borderBottom: '1px solid #f0f0f0',
                              display: 'flex', alignItems: 'center', gap: '10px',
                            }}
                          >
                            <FiMessageSquare size={16} style={{ color: '#1a73e8', flexShrink: 0 }} />
                            <span style={{ fontSize: '14px', flex: 1 }}>
                              {room.name || (room.type !== 'GROUP' ? '1:1 채팅' : '채팅방')}
                            </span>
                            <span style={{ fontSize: '11px', color: '#999' }}>
                              {room.type === 'GROUP' ? `${room.members?.length || 0}명` : '1:1'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="form-actions" style={{ paddingBottom: '20px' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowShareModal(false)}>취소</button>
                    <button type="button" className="btn btn-primary" onClick={handleChatShare} disabled={chatSharing || !selectedChatRoomId}>
                      {chatSharing ? '공유 중...' : '공유하기'}
                    </button>
                  </div>
                </div>
              )}

              {/* 메일 공유 탭 */}
              {shareTab === 'mail' && (
                <form onSubmit={handleMailShare} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div className="form-group" style={{ position: 'relative' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>받는 사람</label>
                    <input
                      className="calendar-input"
                      value={mailRecipientQuery}
                      onChange={e => handleMailRecipientSearch(e.target.value)}
                      placeholder="이름 또는 사번으로 검색..."
                      style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ced4da', boxSizing: 'border-box' }}
                      autoComplete="off"
                    />
                    {mailRecipientOptions.length > 0 && (
                      <div style={{
                        position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                        background: '#fff', border: '1px solid #ced4da', borderRadius: '4px',
                        maxHeight: '150px', overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                      }}>
                        {mailRecipientOptions.map(user => (
                          <div
                            key={user.empNo}
                            onClick={() => {
                              if (!selectedMailRecipients.find(r => r.empNo === user.empNo)) {
                                setSelectedMailRecipients(prev => [...prev, user]);
                              }
                              setMailRecipientQuery('');
                              setMailRecipientOptions([]);
                            }}
                            style={{ padding: '8px 14px', cursor: 'pointer', fontSize: '13px' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f0f4ff'}
                            onMouseLeave={e => e.currentTarget.style.background = ''}
                          >
                            {user.name} <span style={{ color: '#999' }}>({user.empNo})</span>
                            {user.deptName && <span style={{ color: '#aaa', marginLeft: '8px', fontSize: '11px' }}>{user.deptName}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    {selectedMailRecipients.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                        {selectedMailRecipients.map(r => (
                          <span key={r.empNo} style={{
                            background: '#e8f0fe', color: '#1a73e8', borderRadius: '12px',
                            padding: '3px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px'
                          }}>
                            {r.name}
                            <button
                              type="button"
                              onClick={() => setSelectedMailRecipients(prev => prev.filter(x => x.empNo !== r.empNo))}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1a73e8', padding: '0', lineHeight: '1' }}
                            >×</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="form-group">
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>제목</label>
                    <input
                      className="calendar-input"
                      value={mailSubject}
                      onChange={e => setMailSubject(e.target.value)}
                      style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ced4da', boxSizing: 'border-box' }}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>메시지 (선택)</label>
                    <textarea
                      value={mailBody}
                      onChange={e => setMailBody(e.target.value)}
                      rows={3}
                      placeholder="첨부 파일에 대한 설명을 입력하세요."
                      style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ced4da', resize: 'none', fontSize: '13px', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div className="form-actions" style={{ paddingBottom: '20px' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowShareModal(false)}>취소</button>
                    <button type="submit" className="btn btn-primary" disabled={mailSharing}>
                      {mailSharing ? '전송 중...' : '메일 보내기'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
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
