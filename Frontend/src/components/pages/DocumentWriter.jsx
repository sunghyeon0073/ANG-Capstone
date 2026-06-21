import React, { useEffect, useRef, useState } from 'react'
import '../../style/document.css'
import '../../style/AIprompt.css'
import DocumentFilePreview from './DocumentFilePreview'
import DraftStudioSidebar from '../document/DraftStudioSidebar'
import FileStorage from './FileStorage'
import DraftStudioConfig from '../document/DraftStudioConfig'
import UploadModal from '../document/UploadModal'
import DocumentViewerPane from '../document/DocumentViewerPane'
import { useDocumentWorkspace } from '../../hooks/useDocumentWorkspace'
import { uploadDocument } from '../../api/documentApi'
import { getFilePreview, downloadFile } from '../../api/fileApi'
import { getDocumentPreviewKind, getFileTypeLabel } from '../../utils/documentFileUtils'
import { getBaseName, getExtension } from '../../utils/fileUtils'
import { generateTemplate } from '../../api/documentApi'

export default function DocumentWriter() {
  const { state, actions } = useDocumentWorkspace()
  const {
    category, selectedScopeId, searchTerm, sortOrder, myScopes,
    openDocumentTabs, activeDocumentTabId, selectedDoc,
    prompt, attachedDocs, targetFormat, generationSummary, aiProgressMode, aiProgressStep,
    docxEditInstructions, docxEditMode, titleEditMode, titleDraft, isTitleSaving,
    showFullView, showUploadModal, isExporting,
    filteredDocuments, loading, aiLoading
  } = state

  const [previewUrl, setPreviewUrl] = useState(null)
  const [previewData, setPreviewData] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState(null)

  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadFile, setUploadFile] = useState(null)
  const [uploadTargetScopeId, setUploadTargetScopeId] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [showReferenceModal, setShowReferenceModal] = useState(false)

  useEffect(() => {
    const handleGeneratedDocument = (event) => {
      const generatedDocument = event.detail?.document
      if (!generatedDocument) return

      actions.queryClient.invalidateQueries({ queryKey: ['documents'] })
      actions.handleSelectDocument(generatedDocument)
      actions.setGenerationSummary({
        title: generatedDocument.title || '생성된 문서',
        summary: "생성 완료",
        fileType: getFileTypeLabel(generatedDocument),
        createdAt: generatedDocument.createdAt,
      })
    }

    window.addEventListener('ang:ai-document-generated', handleGeneratedDocument)
    return () => window.removeEventListener('ang:ai-document-generated', handleGeneratedDocument)
  }, [activeDocumentTabId, category])

  useEffect(() => {
    let objectUrl = null

    const loadPreview = async () => {
      setPreviewUrl(null)
      setPreviewData(null)
      setPreviewError(null)

      if (!selectedDoc) return
      const previewKind = getDocumentPreviewKind(selectedDoc)
      if (previewKind === 'text') return

      if (!selectedDoc.fileId && !selectedDoc.previewFileId && ((previewKind === 'word' && (selectedDoc.mockPreviewHtml || selectedDoc.originalContent)) || (previewKind === 'excel' && (selectedDoc.mockTableData || selectedDoc.originalContent)))) return

      const shouldRenderOriginal = ['word', 'excel', 'hwp', 'hwpx'].includes(previewKind)
      const previewFileId = shouldRenderOriginal ? selectedDoc.fileId : selectedDoc.previewFileId || selectedDoc.fileId
      const canPreviewBlob = previewFileId && (shouldRenderOriginal || Boolean(selectedDoc.previewFileId) || previewKind === 'pdf' || previewKind === 'image' || selectedDoc.previewFileContentType?.toLowerCase().includes('pdf'))

      if (!canPreviewBlob) return
      if (selectedDoc.mockPreviewUrl) { setPreviewUrl(selectedDoc.mockPreviewUrl); return }
      if (String(previewFileId).startsWith('mock-') || String(previewFileId).startsWith('local-')) return

      try {
        setPreviewLoading(true)
        const response = await getFilePreview(previewFileId)
        const blob = response.data

        if (['word', 'excel', 'hwp', 'hwpx'].includes(previewKind)) {
          setPreviewData(await blob.arrayBuffer())
          return
        }

        const previewType = selectedDoc.previewFileId || previewKind === 'pdf' || selectedDoc.previewFileContentType?.toLowerCase().includes('pdf') ? 'application/pdf' : selectedDoc.fileContentType || blob?.type || 'image/*'
        objectUrl = URL.createObjectURL(new Blob([blob], { type: previewType }))
        setPreviewUrl(objectUrl)
      } catch (err) {
        console.error('문서 미리보기 로드 실패:', err)
        setPreviewError('미리보기를 불러올 수 없습니다.')
      } finally {
        setPreviewLoading(false)
      }
    }

    loadPreview()

    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [selectedDoc])

  const handleExport = async () => {
    if (!selectedDoc || !selectedDoc.fileId) return
    try {
      actions.setIsExporting(true)
      const res = await downloadFile(selectedDoc.fileId)

      const disposition = res.headers['content-disposition']
      let filename = selectedDoc.originalFileName || selectedDoc.title || 'document'
      if (disposition) {
        const match = disposition.match(/filename\*=UTF-8''(.+)|filename="?([^;\\"]+)"?/) 
        if (match) filename = decodeURIComponent(match[1] || match[2])
      }

      if ('showSaveFilePicker' in window) {
        try {
          const handle = await window.showSaveFilePicker({ suggestedName: filename })
          const writable = await handle.createWritable()
          await writable.write(res.data)
          await writable.close()

          window.dispatchEvent(new CustomEvent('ang:mascot-alert', { detail: { message: '파일을 원하는 위치에 저장했어요!' } }))
          return
        } catch (pickerErr) {
          if (pickerErr.name === 'AbortError') return
        }
      }

      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      window.dispatchEvent(new CustomEvent('ang:mascot-alert', { detail: { message: '문서를 다운로드했어요!' } }))
    } catch (err) {
      alert(err.response?.data?.message || err.message || '문서다운로드에 실패했습니다.')
    } finally {
      actions.setIsExporting(false)
    }
  }

  const handleModalUpload = async (e) => {
    e.preventDefault()
    if (!uploadFile || !uploadTitle.trim()) return

    try {
      setIsUploading(true)
      window.dispatchEvent(new CustomEvent('ang:mascot-alert', { detail: { message: '파일을 업로드 중입니다...' } }))
      const formData = new FormData()
      formData.append('file', uploadFile)
      formData.append('title', uploadTitle)
      if (uploadTargetScopeId) formData.append('targetScopeId', uploadTargetScopeId)
      
      const response = await uploadDocument(formData)

      if (response.data?.success) {
        const newDoc = { ...response.data.data, source: 'uploaded' }
        actions.queryClient.invalidateQueries({ queryKey: ['documents'] })
        actions.handleSelectDocument(newDoc)
        actions.setShowUploadModal(false)
        setUploadTitle('')
        setUploadFile(null)
        setUploadTargetScopeId('')
        window.dispatchEvent(new CustomEvent('ang:mascot-alert', { detail: { message: '파일이 업로드되었어요!' } }))
      } else {
        throw new Error(response.data?.message || '파일 업로드에 실패했습니다.')
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || '파일 업로드에 실패했습니다.')
    } finally {
      setIsUploading(false)
    }
  }

  const handleAiGenerate = async (mode = 'create', templatePayload = null) => {
    try {
      actions.setAiProgressMode(mode)
      actions.setAiProgressStep(0)
      actions.setGenerationSummary(null)

      if (mode === 'template' && templatePayload) {
        actions.setAiProgressStep(1)
        const { blob, filename } = await generateTemplate(
          templatePayload.templateFile,
          templatePayload.formData,
          templatePayload.title
        )
        
        actions.setAiProgressStep(2)
        const file = new File([blob], filename, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
        const formData = new FormData()
        formData.append('title', getBaseName(filename))
        formData.append('file', file)
        if (selectedScopeId && selectedScopeId !== 'all') {
          formData.append('targetScopeId', selectedScopeId)
        }

        const uploadResponse = await uploadDocument(formData)
        const generatedDocument = uploadResponse.data?.data

        actions.setAiProgressStep(3)
        if (generatedDocument) {
          actions.queryClient.invalidateQueries({ queryKey: ['documents'] })
          actions.handleSelectDocument(generatedDocument)
          actions.setGenerationSummary({
            title: generatedDocument.title || '생성된 문서',
            summary: "생성 완료",
            fileType: getFileTypeLabel(generatedDocument),
            createdAt: generatedDocument.createdAt,
          })
          window.dispatchEvent(new CustomEvent('ang:mascot-alert', {
            detail: { message: '문서가 완성되었습니다! 내용을 확인해 보세요.', animation: 'celebrate' }
          }))
        }
      } else {
        const p = prompt.trim()
        const selectedKind = selectedDoc ? getDocumentPreviewKind(selectedDoc) : null
        const hasDocxEditInstructions = mode === 'edit' && selectedKind === 'word' && docxEditInstructions.length > 0
        if (!p && !hasDocxEditInstructions) return alert("프롬프트를 입력하세요.")

        const editOutputFormat = selectedKind === 'hwp' || selectedKind === 'hwpx' ? 'hwp' : selectedKind === 'word' ? 'docx' : selectedKind === 'excel' ? 'xlsx' : selectedKind === 'pdf' ? 'pdf' : selectedKind === 'text' ? 'txt' : null
        const createOutputFormat = selectedKind === 'hwp' || selectedKind === 'hwpx' ? 'hwp' : selectedKind === 'excel' ? 'xlsx' : selectedKind === 'pdf' ? 'pdf' : 'docx'

        if (mode === 'edit' && !selectedDoc) return alert('수정할 문서를 선택하세요.')
        if (mode === 'edit' && !editOutputFormat) return alert('이 확장자는 AI 수정을 지원하지 않습니다.')

        const payload = {
          prompt: p,
          mode: 'create', // Always create a draft in Draft Studio
          outputFormat: targetFormat,
          sourceDocId: null, // RAG uses attachedDocIds
          attachedDocIds: attachedDocs.map((doc) => doc.docId),
        }

        if (hasDocxEditInstructions) {
          payload.docxEditInstructions = docxEditInstructions
        }

        await actions.startGeneration(payload)
        actions.setPrompt('')
        actions.setAttachedDocs([])
        actions.setDocxEditInstructions([])
        actions.setDocxEditMode(false)
      }
    } catch (err) {
      console.error('AI 문서 생성 실패:', err)
      window.dispatchEvent(new CustomEvent('ang:mascot-alert', {
        detail: { message: '문서 생성이 잠깐 막혔어요. 연결 상태를 확인하고 다시 시도해 주세요.', animation: 'idle' }
      }))
    } finally {
      actions.setAiProgressMode(null)
      actions.setAiProgressStep(0)
    }
  }

  return (
    <div className="document-writer-container" style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      
      {/* 1. Left Panel: AI Config (Full Width now) */}
      <div style={{ width: '400px', flexShrink: 0, borderRight: '1px solid #eef1f4', display: 'flex', flexDirection: 'column', background: '#f8fafc', overflow: 'hidden' }}>
        <DraftStudioConfig
          attachedDocs={attachedDocs} 
          clearAttachedDocs={actions.clearAttachedDocs} 
          toggleAttachedDoc={actions.toggleAttachedDoc}
          targetFormat={targetFormat} 
          setTargetFormat={actions.setTargetFormat}
          prompt={prompt} 
          setPrompt={actions.setPrompt}
          generationSummary={generationSummary}
          aiLoading={aiLoading} 
          aiProgressMode={aiProgressMode} 
          aiProgressStep={aiProgressStep}
          handleAiGenerate={handleAiGenerate}
          onOpenReferenceModal={() => setShowReferenceModal(true)}
        />
      </div>

      {/* 2. Main Pane: Result Viewer */}
      <div className="document-main" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <DocumentViewerPane
          selectedDoc={selectedDoc}
          titleEditMode={titleEditMode}
          titleDraft={titleDraft}
          setTitleDraft={actions.setTitleDraft}
          saveTitleEdit={actions.saveTitleEdit}
          cancelTitleEdit={() => actions.setTitleEditMode(false)}
          startTitleEdit={() => { actions.setTitleDraft(getBaseName(selectedDoc.title)); actions.setTitleEditMode(true); }}
          docxEditMode={docxEditMode}
          setDocxEditMode={actions.setDocxEditMode}
          setShowFullView={actions.setShowFullView}
          isExporting={isExporting}
          handleExport={handleExport}
          previewUrl={previewUrl}
          previewData={previewData}
          previewLoading={previewLoading}
          previewError={previewError}
          docxEditInstructions={docxEditInstructions}
          handleAddDocxEditInstruction={(inst) => actions.setDocxEditInstructions(curr => [...curr, inst])}
        />
      </div>

      <UploadModal
        showUploadModal={showUploadModal} setShowUploadModal={actions.setShowUploadModal}
        uploadTitle={uploadTitle} setUploadTitle={setUploadTitle}
        uploadFile={uploadFile} setUploadFile={setUploadFile}
        uploadTargetScopeId={uploadTargetScopeId} setUploadTargetScopeId={setUploadTargetScopeId}
        isUploading={isUploading} handleModalUpload={handleModalUpload}
        myScopes={myScopes}
      />

      {/* Reference Modal */}
      {showReferenceModal && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(4px)', animation: 'fadeIn 0.2s ease' }}>
          <div className="modal-content" style={{ background: '#fff', borderRadius: '16px', width: '90vw', maxWidth: '1400px', height: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)' }}>
            <div className="modal-header" style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>파일함에서 참조 문서 가져오기</h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>파일함에서 템플릿에 추가할 참조 문서를 선택하세요.</p>
              </div>
              <button onClick={() => setShowReferenceModal(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#94a3b8', padding: '4px', lineHeight: '1' }}>&times;</button>
            </div>
            
            <div className="modal-body" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
              <FileStorage 
                isPickerMode={true} 
                attachedDocs={attachedDocs} 
                toggleAttachedDoc={actions.toggleAttachedDoc} 
              />
            </div>
            
            <div className="modal-footer" style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button type="button" onClick={() => setShowReferenceModal(false)} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontWeight: '600', cursor: 'pointer' }}>
                닫기
              </button>
              <button type="button" onClick={() => setShowReferenceModal(false)} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'var(--color-primary)', color: '#fff', fontWeight: '600', cursor: 'pointer' }}>
                완료 ({attachedDocs.length}개 선택됨)
              </button>
            </div>
          </div>
        </div>
      )}
      
      {showFullView && selectedDoc && (
        <div
          className="modal-overlay doc-fullview-overlay"
          onClick={() => actions.setShowFullView(false)}
          role="presentation"
        >
          <div
            className="doc-fullview-modal doc-fullview-modal--plain"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="doc-fullview-title"
          >
            <DocumentFilePreview
              doc={selectedDoc}
              previewUrl={previewUrl}
              previewData={previewData}
              previewLoading={previewLoading}
              previewError={previewError}
              variant="fullscreen"
              docxEditInstructions={docxEditInstructions}
            />
            <button
              type="button"
              className="modal-close"
              onClick={() => actions.setShowFullView(false)}
              aria-label="닫기"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
