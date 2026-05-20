import React, { useState, useEffect, useRef } from 'react';
import {
  getMyDocuments,
  getDepartmentDocuments,
  uploadDocument,
  deleteDocument,
  getDocument,
  downloadDocumentFile
} from '../../api/documentApi';
import { getScopes } from '../../api/scopeApi';

const formatDate = (iso) => iso ? new Date(iso).toLocaleDateString('ko-KR') : '-';
const formatSize = (bytes) => {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
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
  const showList = isMy || isShared;

  const fetchDocs = async () => {
    if (!showList) return;
    try {
      setIsLoading(true);
      const res = isMy
        ? await getMyDocuments()
        : await getDepartmentDocuments(keyword);
      setDocs(res.data?.data || []);
    } catch (error) {
      console.error('문서 로드 실패', error);
      setDocs([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMyScopes = async () => {
    try {
      const res = await getScopes();
      // 조직도 API는 트리 구조이므로 평탄화하거나 현재 사용자가 속한 부서만 필터링해야 함
      const data = res.data?.data || [];
      const flatScopes = [];
      const flatten = (items) => {
        items.forEach(item => {
          flatScopes.push({ id: item.id, name: item.name });
          if (item.children) flatten(item.children);
        });
      };
      flatten(Array.isArray(data) ? data : [data]);
      setMyScopes(flatScopes);
    } catch (error) {
      console.error('부서 목록 로드 실패', error);
    }
  };

  useEffect(() => {
    fetchDocs();
    if (isMy) fetchMyScopes();
  }, [currentSubPage]);

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
    if (!window.confirm('정말 삭제하시겠습니까? 실제 파일도 함께 삭제됩니다.')) return;
    try {
      await deleteDocument(docId);
      setDocs(prev => prev.filter(d => d.docId !== docId));
      if (selectedDoc?.docId === docId) setSelectedDoc(null);
    } catch (error) {
      alert('삭제 실패: ' + (error.response?.data?.message || '오류가 발생했습니다.'));
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
      case 'file-home': return '홈';
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
            <form onSubmit={handleSearch} style={{ display: 'flex', gap: 4 }}>
              <input
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                placeholder="검색어 입력"
                style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #ddd' }}
              />
              <button type="submit" className="btn btn-secondary" style={{ padding: '4px 12px' }}>검색</button>
            </form>
          )}
          {isMy && (
            <button className="btn btn-primary" onClick={() => setShowUpload(true)} style={{ padding: '4px 12px' }}>
              + 업로드
            </button>
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
              <div><strong>업로드일:</strong> {formatDate(selectedDoc.createdAt)}</div>
              <div><strong>파일명:</strong> {selectedDoc.originalFileName || '-'}</div>
              <div><strong>파일크기:</strong> {formatSize(selectedDoc.fileSize)}</div>
              {selectedDoc.scopeName && <div><strong>소속 부서:</strong> {selectedDoc.scopeName}</div>}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              {selectedDoc.fileId && (
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
                <th style={{ padding: '10px 12px', textAlign: 'left' }}>등록일</th>
                <th style={{ padding: '10px 12px', textAlign: 'center' }}>작업</th>
              </tr>
            </thead>
            <tbody>
              {docs.map(doc => (
                <tr key={doc.docId} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '10px 12px' }}>
                    <span
                      style={{ cursor: 'pointer', color: '#4A90D9' }}
                      onClick={() => handleViewDetail(doc.docId)}
                    >
                      📄 {doc.title}
                    </span>
                    {doc.scopeName && <span style={{ marginLeft: 8, fontSize: 11, color: '#999', background: '#f0f0f0', padding: '2px 6px', borderRadius: 10 }}>{doc.scopeName}</span>}
                  </td>
                  <td style={{ padding: '10px 12px', color: '#888' }}>{formatDate(doc.createdAt)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    {doc.fileId && (
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
                    {doc.canDelete && (
                      <button
                        onClick={() => handleDelete(doc.docId)}
                        style={{
                          background: '#ff4d4f', color: '#fff', border: 'none',
                          borderRadius: 4, padding: '4px 10px', cursor: 'pointer', fontSize: 12
                        }}
                      >
                        삭제
                      </button>
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
