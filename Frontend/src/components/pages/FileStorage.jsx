import React, { useState, useEffect, useRef } from 'react';
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
import { getScopes } from '../../api/scopeApi';
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
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
};

const getTagStyle = (doc) => {
  const kind = getDocumentPreviewKind(doc);
  switch (kind) {
    case 'pdf': return { background: '#fdecea', color: '#c62828', border: '1px solid #ffcdd2' };
    case 'image': return { background: '#e8f5e9', color: '#2e7d32', border: '1px solid #c8e6c9' };
    case 'word': return { background: '#e3f2fd', color: '#1565c0', border: '1px solid #bbdefb' };
    case 'excel': return { background: '#e8f5e9', color: '#1b5e20', border: '1px solid #c8e6c9' };
    case 'hwp':
    case 'hwpx': return { background: '#f3e5f5', color: '#7b1fa2', border: '1px solid #e1bee7' };
    case 'text': return { background: '#f5f5f5', color: '#616161', border: '1px solid #e0e0e0' };
    default: return { background: '#e8f0fe', color: '#1a73e8', border: '1px solid #d2e3fc' };
  }
};

export default function FileStorage({ currentSubPage = 'file-home' }) {
  const [docs, setDocs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [myScopes, setMyScopes] = useState([]);
  const [targetScopeId, setTargetScopeId] = useState('');
  const fileInputRef = useRef();

  const isMy = currentSubPage === 'file-my';
  const isShared = currentSubPage === 'file-shared';
  const isTrash = currentSubPage === 'file-trash';
  const showList = isMy || isShared || isTrash;

  const fetchDocs = async () => {
    if (!showList) return;
    try {
      setIsLoading(true);
      let res;
      if (isMy) {
        res = await getMyDocuments();
      } else if (isTrash) {
        res = await getTrashDocuments();
      } else {
        res = await getDepartmentDocuments({ keyword, scopeId: targetScopeId });
      }
      
      const sortedDocs = (res.data?.data || []).sort((a, b) => {
        const dateA = isTrash ? new Date(a.deletedAt) : new Date(a.createdAt);
        const dateB = isTrash ? new Date(b.deletedAt) : new Date(b.createdAt);
        return dateB - dateA;
      });
      setDocs(sortedDocs);
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
      const data = res.data?.data || [];
      
      const map = {};
      const roots = [];
      data.forEach(item => { map[item.id] = { ...item, children: [] }; });
      data.forEach(item => {
        if (item.parentId && map[item.parentId]) {
          map[item.parentId].children.push(map[item.id]);
        } else {
          roots.push(map[item.id]);
        }
      });

      const flatResult = [];
      const flattenWithIndent = (nodes, depth = 0) => {
        nodes.forEach(node => {
          flatResult.push({
            id: node.id,
            name: (depth > 0 ? '　'.repeat(depth) + '└ ' : '') + node.name
          });
          if (node.children && node.children.length > 0) {
            flattenWithIndent(node.children, depth + 1);
          }
        });
      };
      
      flattenWithIndent(roots);
      setMyScopes(flatResult);
    } catch (error) {
      console.error('부서 목록 로드 실패', error);
    }
  };

  useEffect(() => {
    fetchDocs();
    if (showList && !isTrash) fetchMyScopes();
  }, [currentSubPage, targetScopeId]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchDocs();
  };

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
      setShowUpload(false);
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
      
      let downloadName = fileName || 'downloaded_file';
      const disposition = res.headers['content-disposition'];
      if (disposition && disposition.indexOf('attachment') !== -1) {
        const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
        const matches = filenameRegex.exec(disposition);
        if (matches != null && matches[1]) { 
          downloadName = decodeURIComponent(matches[1].replace(/['"]/g, ''));
        }
      }
      
      link.setAttribute('download', downloadName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('다운로드 실패:', error);
      alert('파일 다운로드에 실패했습니다.');
    }
  };

  const handleDelete = async (docId) => {
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
      setDocs(prev => prev.filter(d => d.docId !== docId));
      if (selectedDoc?.docId === docId) setSelectedDoc(null);
    } catch (error) {
      alert('삭제 실패: ' + (error.response?.data?.message || '오류가 발생했습니다.'));
    }
  };

  const handleRestore = async (docId) => {
    try {
      await restoreDocument(docId);
      setDocs(prev => prev.filter(d => d.docId !== docId));
      alert('문서가 복구되었습니다.');
    } catch (error) {
      alert('복구 실패: ' + (error.response?.data?.message || '오류가 발생했습니다.'));
    }
  };

  const handleViewDetail = async (docId) => {
    try {
      const res = await getDocument(docId);
      setSelectedDoc(res.data?.data);
    } catch (error) {
      console.error('문서 조회 실패', error);
    }
  };

  const getPageTitle = () => {
    switch (currentSubPage) {
      case 'file-my': return '내 파일';
      case 'file-shared': return '공유파일';
      case 'file-template': return '빈 양식';
      case 'file-important': return '중요 문서함';
      case 'file-trash': return '휴지통';
      default: return '파일함';
    }
  };

  if (!showList) {
    return (
      <div className="file-page">
        <div className="file-header"><h1>{getPageTitle()}</h1></div>
        <div className="file-empty">준비 중입니다.</div>
      </div>
    );
  }

  return (
    <div className="file-page">
      <div className="file-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1>{getPageTitle()}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {isShared && (
            <div style={{ display: 'flex', gap: 8 }}>
              <select
                value={targetScopeId}
                onChange={e => setTargetScopeId(e.target.value)}
                style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #ddd', fontSize: 13 }}
              >
                <option value="">전체 부서</option>
                {myScopes.map(scope => (
                  <option key={scope.id} value={scope.id}>{scope.name}</option>
                ))}
              </select>
              <form onSubmit={handleSearch} style={{ display: 'flex', gap: 4 }}>
                <input
                  value={keyword}
                  onChange={e => setKeyword(e.target.value)}
                  placeholder="검색어 입력"
                  style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #ddd' }}
                />
                <button type="submit" className="btn btn-secondary" style={{ padding: '4px 12px' }}>검색</button>
              </form>
            </div>
          )}
          {isMy && (
            <button className="btn btn-primary" onClick={() => setShowUpload(true)} >
              + 업로드
            </button>
          )}
          {isTrash && (
            <div style={{ fontSize: 13, color: '#ff4d4f', display: 'flex', alignItems: 'center' }}>
              * 휴지통에 보관된 문서는 30일 후 자동으로 영구 삭제됩니다.
            </div>
          )}
        </div>
      </div>

      {showUpload && (
        <div className="modal-overlay" onClick={() => setShowUpload(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ minWidth: 360, padding: 24 }}>
            <h3 style={{ marginBottom: 16 }}>파일 업로드</h3>
            <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                value={uploadTitle}
                onChange={e => setUploadTitle(e.target.value)}
                placeholder="문서 제목"
                required
                style={{ padding: '8px 12px', borderRadius: 4, border: '1px solid #ddd' }}
              />
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 13, color: '#666' }}>저장 위치 (미선택 시 개인 보관함)</label>
                <select 
                  value={targetScopeId} 
                  onChange={e => setTargetScopeId(e.target.value)}
                  style={{ padding: '8px 12px', borderRadius: 4, border: '1px solid #ddd' }}
                >
                  <option value="">개인 문서함</option>
                  {myScopes.map(scope => (
                    <option key={scope.id} value={scope.id}>{scope.name}</option>
                  ))}
                </select>
              </div>

              <input
                type="file"
                ref={fileInputRef}
                onChange={e => setUploadFile(e.target.files[0])}
                required
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowUpload(false)}>취소</button>
                <button type="submit" className="btn btn-primary" disabled={uploading}>
                  {uploading ? '업로드 중...' : '업로드'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedDoc && (
        <div className="modal-overlay" onClick={() => setSelectedDoc(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ minWidth: 400, padding: 24 }}>
            <h3 style={{ marginBottom: 16 }}>📄 {selectedDoc.title}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, color: '#555' }}>
              <div><strong>{isTrash ? '삭제일' : '업로드일'}:</strong> {formatDate(isTrash ? selectedDoc.deletedAt : selectedDoc.createdAt)}</div>
              <div><strong>파일명:</strong> {selectedDoc.originalFileName || '-'}</div>
              <div><strong>파일크기:</strong> {formatSize(selectedDoc.fileSize)}</div>
              {selectedDoc.scopeName && selectedDoc.scopeName !== 'N/A' && <div><strong>소속 부서:</strong> {selectedDoc.scopeName}</div>}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              {selectedDoc.fileId && !isTrash && (
                <button 
                  className="btn btn-primary" 
                  onClick={() => handleDownload(selectedDoc.fileId, selectedDoc.originalFileName || selectedDoc.title)}
                >
                  다운로드
                </button>
              )}
              <button className="btn btn-secondary" onClick={() => setSelectedDoc(null)}>닫기</button>
            </div>
          </div>
        </div>
      )}

      <div className="file-container">
        {isLoading ? (
          <div className="file-empty">불러오는 중...</div>
        ) : docs.length === 0 ? (
          <div className="file-empty">파일이 없습니다.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f5f7fa', borderBottom: '2px solid #eee' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>제목</th>
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>{isTrash ? '삭제일' : '등록일'}</th>
                <th style={{ padding: '10px 12px', textAlign: 'center' }}>작업</th>
              </tr>
            </thead>
            <tbody>
              {docs.map(doc => (
                <tr key={doc.docId} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '10px 12px' }}>
                    <span
                      style={{ cursor: 'pointer', color: '#000' }}
                      onClick={() => handleViewDetail(doc.docId)}
                    >
                      <span style={{ 
                        display: 'inline-block', 
                        minWidth: 45, 
                        fontSize: 10, 
                        fontWeight: 'bold', 
                        padding: '2px 4px', 
                        borderRadius: 3, 
                        textAlign: 'center',
                        marginRight: 8,
                        ...getTagStyle(doc)
                      }}>
                        {getFileTypeLabel(doc)}
                      </span>
                      {doc.title}
                    </span>
                    {isTrash && (
                      <span style={{ 
                        marginLeft: 8, 
                        fontSize: 11, 
                        color: doc.scopeName && doc.scopeName !== 'N/A' ? '#1a73e8' : '#666', 
                        background: doc.scopeName && doc.scopeName !== 'N/A' ? '#e8f0fe' : '#f0f0f0', 
                        padding: '2px 8px', 
                        borderRadius: 10,
                        border: '1px solid',
                        borderColor: doc.scopeName && doc.scopeName !== 'N/A' ? '#d2e3fc' : '#ddd'
                      }}>
                        {doc.scopeName && doc.scopeName !== 'N/A' ? doc.scopeName : '개인 문서'}
                      </span>
                    )}
                    {!isMy && !isTrash && doc.scopeName && doc.scopeName !== 'N/A' && (
                      <span style={{ marginLeft: 8, fontSize: 11, color: '#999', background: '#f0f0f0', padding: '2px 6px', borderRadius: 10 }}>
                        {doc.scopeName}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px', color: '#888' }}>{formatDate(isTrash ? doc.deletedAt : doc.createdAt, true)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    {doc.fileId && !isTrash && (
                      <button
                        onClick={() => handleDownload(doc.fileId, doc.originalFileName || doc.title)}
                        style={{
                          background: '#4A90D9', color: '#fff', border: 'none',
                          borderRadius: 4, padding: '4px 10px', cursor: 'pointer', fontSize: 12,
                          marginRight: 4
                        }}
                      >
                        다운로드
                      </button>
                    )}
                    {(doc.canDelete || isTrash) && (
                      <div style={{ display: 'inline-block' }}>
                        {isTrash && (
                          <button
                            onClick={() => handleRestore(doc.docId)}
                            style={{
                              background: '#52c41a', color: '#fff', border: 'none',
                              borderRadius: 4, padding: '4px 10px', cursor: 'pointer', fontSize: 12,
                              marginRight: 4
                            }}
                          >
                            복구
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(doc.docId)}
                          style={{
                            background: '#ff4d4f', color: '#fff', border: 'none',
                            borderRadius: 4, padding: '4px 10px', cursor: 'pointer', fontSize: 12
                          }}
                        >
                          {isTrash ? '영구 삭제' : '삭제'}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
