import React, { useRef } from 'react'

export default function UploadModal({
  showUploadModal, setShowUploadModal,
  uploadTitle, setUploadTitle,
  uploadFile, setUploadFile,
  uploadTargetScopeId, setUploadTargetScopeId,
  isUploading, handleModalUpload,
  myScopes
}) {
  const fileInputRef = useRef(null)

  if (!showUploadModal) return null

  return (
    <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ minWidth: 360, padding: 24, background: '#fff', borderRadius: 8 }}>
        <h3 style={{ marginBottom: 16 }}>파일 업로드</h3>
        <form onSubmit={handleModalUpload} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
              value={uploadTargetScopeId} 
              onChange={e => setUploadTargetScopeId(e.target.value)}
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
            onChange={e => {
              const file = e.target.files[0];
              setUploadFile(file);
              if (file && !uploadTitle) setUploadTitle(file.name);
            }}
            required
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowUploadModal(false)}>취소</button>
            <button type="submit" className="btn btn-primary" disabled={isUploading}>
              {isUploading ? '업로드 중...' : '업로드'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
