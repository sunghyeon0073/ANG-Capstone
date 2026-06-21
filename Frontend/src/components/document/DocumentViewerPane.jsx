import React from 'react'
import DocumentFilePreview from '../pages/DocumentFilePreview'
import { getBaseName } from '../../utils/fileUtils'
import { getDocumentPreviewKind, getFileTypeLabel } from '../../utils/documentFileUtils'

export default function DocumentViewerPane({
  selectedDoc,
  titleEditMode, titleDraft, setTitleDraft, saveTitleEdit, cancelTitleEdit, startTitleEdit,
  docxEditMode, setDocxEditMode,
  setShowFullView, isExporting, handleExport,
  previewUrl, previewData, previewLoading, previewError,
  docxEditInstructions, handleAddDocxEditInstruction
}) {
  return (
    <div className="document-editor-pane">

      <div className="document-content">
        {!selectedDoc && (
          <div className="empty-content">
            <p>좌측에서 문서를 선택하거나 새로 업로드하여 확인하세요.</p>
          </div>
        )}

        {selectedDoc ? (
          <div className="doc-viewer-active">
            <div className="doc-viewer-header">
              <div className="doc-viewer-header-info">
                <div className="doc-title-container">
                  {titleEditMode ? (
                    <div className="doc-title-editor">
                      <input
                        type="text"
                        value={titleDraft}
                        onChange={(e) => setTitleDraft(e.target.value)}
                        className="doc-title-input"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveTitleEdit()
                          if (e.key === 'Escape') cancelTitleEdit()
                        }}
                        autoFocus
                      />
                      <button onClick={saveTitleEdit} className="btn-title-save">저장</button>
                      <button onClick={cancelTitleEdit} className="btn-title-cancel">취소</button>
                    </div>
                  ) : (
                    <div className="doc-title-display">
                      <h2>{selectedDoc.title}</h2>
                      <button
                        type="button"
                        className="btn-edit-title"
                        onClick={startTitleEdit}
                        title="제목 수정"
                      >
                        수정
                      </button>
                    </div>
                  )}
                </div>
                <span className={`doc-type-badge doc-type-badge--${getDocumentPreviewKind(selectedDoc)}`}>
                  {getFileTypeLabel(selectedDoc)}
                </span>

                {selectedDoc.scopeName && (
                  <span className={`doc-scope-badge ${selectedDoc.scopeName === 'N/A' ? 'doc-scope-badge--personal' : ''}`}>
                    {selectedDoc.scopeName === 'N/A' ? '개인 문서' : selectedDoc.scopeName}
                  </span>
                )}
                <span className="doc-meta-item">
                  작성일: {new Date(selectedDoc.createdAt).toLocaleString('ko-KR', {
                    year: 'numeric', month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit', hour12: false
                  })}
                </span>
                {selectedDoc.originalFileName && (
                  <span className="doc-meta-item">파일명: {selectedDoc.originalFileName}</span>
                )}
              </div>
              <div className="doc-viewer-header-actions">
                <button
                  type="button"
                  className="btn-viewer-action"
                  onClick={() => setShowFullView(true)}
                >
                  전체보기
                </button>
                <button
                  type="button"
                  className="btn-viewer-action btn-viewer-action--primary"
                  onClick={handleExport}
                  disabled={isExporting}
                >
                  {isExporting ? '다운로드 중...' : '다운로드'}
                </button>
              </div>
            </div>

            <DocumentFilePreview
              doc={selectedDoc}
              previewUrl={previewUrl}
              previewData={previewData}
              previewLoading={previewLoading}
              previewError={previewError}
              docxEditInstructions={docxEditInstructions}
              onAddDocxEditInstruction={handleAddDocxEditInstruction}
              docxEditEnabled={docxEditMode}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
