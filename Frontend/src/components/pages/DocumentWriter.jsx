import { useState, useEffect, useRef } from 'react'
import api from '../../api/axios'
import {
  getMyDocuments,
  getDepartmentDocuments,
  deleteDocument,
  downloadDocumentFile
} from '../../api/documentApi'
// removed mock data imports - use backend APIs only
import {
  getDocumentPreviewKind,
  getFileTypeLabel,
  ACCEPTED_UPLOAD_TYPES,
  inferContentType,
  isImageDocument,
} from '../../utils/documentFileUtils'
import DocumentFilePreview from './DocumentFilePreview'
import { FiChevronRight, FiEdit3, FiPlus } from 'react-icons/fi'
import { useAiGeneration } from '../../contexts/useAiGeneration'
// use backend download endpoint instead of frontend export logic

const parseCsvToTable = (text) => {
  const lines = text.trim().split('\n').filter(Boolean)
  if (lines.length < 2) return null

  const headers = lines[0].split(',').map((cell) => cell.trim())
  const rows = lines.slice(1).map((line) => line.split(',').map((cell) => cell.trim()))
  return { headers, rows }
}

const AI_PROGRESS_STEPS = {
  create: [
    { label: '요청 내용 분석 중', description: '작성 의도와 참조 문서를 확인하고 있습니다.', percent: 25 },
    { label: '문서 초안 구성 중', description: '기획서 흐름과 핵심 문장을 정리하고 있습니다.', percent: 55 },
    { label: '문서 파일 생성 중', description: '작성 결과를 문서 파일로 저장하고 있습니다.', percent: 82 },
    { label: '문서 목록에 반영 중', description: '완성된 문서를 불러오는 중입니다.', percent: 94 },
  ],
  edit: [
    { label: '원본 문서 분석 중', description: '선택한 문서와 수정 요청을 확인하고 있습니다.', percent: 25 },
    { label: '수정 내용 반영 중', description: '원본 구조를 기준으로 내용을 고치고 있습니다.', percent: 55 },
    { label: '수정본 저장 중', description: '수정된 문서를 파일로 저장하고 있습니다.', percent: 82 },
    { label: '문서 목록에 반영 중', description: '완성된 수정본을 불러오는 중입니다.', percent: 94 },
  ],
}

export default function DocumentWriter() {
  const [documents, setDocuments] = useState([])
  const [filteredDocuments, setFilteredDocuments] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDoc, setSelectedDoc] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [prompt, setPrompt] = useState('')
  const [attachedDocs, setAttachedDocs] = useState([])
  const [category, setCategory] = useState('my')
  const [sortOrder, setSortOrder] = useState('newest')
  const [previewUrl, setPreviewUrl] = useState(null)
  const [previewData, setPreviewData] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [myScopes, setMyScopes] = useState([])
  const [selectedScopeId, setSelectedScopeId] = useState('all')
  const [showFullView, setShowFullView] = useState(false)
  const [promptOpen, setPromptOpen] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadFile, setUploadFile] = useState(null)
  const [uploadTargetScopeId, setUploadTargetScopeId] = useState('')
  const [aiProgressMode, setAiProgressMode] = useState(null)
  const [aiProgressStep, setAiProgressStep] = useState(0)
  const [docxEditInstructions, setDocxEditInstructions] = useState([])
  const [docxEditMode, setDocxEditMode] = useState(false)
  const fileInputRef = useRef(null)
  const mountedRef = useRef(true)
  const { isGenerating: aiLoading, startGeneration } = useAiGeneration()

  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    const fetchScopes = async () => {
      try {
        const res = await api.get('/scopes/my')
        const scopes = res.data?.data || []
        setMyScopes(scopes)
      } catch (err) {
        console.error('소속 부서 로드 실패', err)
        setMyScopes([])
      }
    }
    fetchScopes()
  }, [])

  useEffect(() => {
    fetchDocuments()
  }, [category, selectedScopeId])

  useEffect(() => {
    setDocxEditInstructions([])
    setDocxEditMode(false)
  }, [selectedDoc?.docId])

  useEffect(() => {
    const handleGeneratedDocument = (event) => {
      const generatedDocument = event.detail?.document
      if (!generatedDocument) return

      if (category === 'my') {
        setDocuments((currentDocuments) => {
          const exists = currentDocuments.some((doc) => doc.docId === generatedDocument.docId)
          return exists ? currentDocuments : [generatedDocument, ...currentDocuments]
        })
      }
      setSelectedDoc(generatedDocument)
    }

    window.addEventListener('ang:ai-document-generated', handleGeneratedDocument)
    return () => window.removeEventListener('ang:ai-document-generated', handleGeneratedDocument)
  }, [category])

  useEffect(() => {
    const filtered = documents.filter((doc) => {
      const matchesSearch =
        doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (doc.originalContent && doc.originalContent.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (doc.originalFileName && doc.originalFileName.toLowerCase().includes(searchTerm.toLowerCase()))

      return matchesSearch
    })

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime()
      const dateB = new Date(b.createdAt).getTime()
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB
    })

    setFilteredDocuments(sorted)
  }, [searchTerm, documents, sortOrder])

  useEffect(() => {
    if (!aiLoading || !aiProgressMode) return undefined

    setAiProgressStep(0)
    const timer = window.setInterval(() => {
      setAiProgressStep((currentStep) => {
        const lastStep = AI_PROGRESS_STEPS[aiProgressMode].length - 1
        return currentStep >= lastStep ? currentStep : currentStep + 1
      })
    }, 1400)

    return () => window.clearInterval(timer)
  }, [aiLoading, aiProgressMode])

  useEffect(() => {
    let objectUrl = null

    const loadPreview = async () => {
      setPreviewUrl(null)
      setPreviewData(null)
      setPreviewError(null)

      if (!selectedDoc) return

      const previewKind = getDocumentPreviewKind(selectedDoc)

      if (previewKind === 'text') return

      if (
        !selectedDoc.fileId &&
        !selectedDoc.previewFileId &&
        (
          (previewKind === 'word' && (selectedDoc.mockPreviewHtml || selectedDoc.originalContent)) ||
          (previewKind === 'excel' && (selectedDoc.mockTableData || selectedDoc.originalContent))
        )
      ) {
        return
      }

      const shouldRenderOriginal = ['word', 'excel', 'hwp', 'hwpx'].includes(previewKind)
      const previewFileId = shouldRenderOriginal
        ? selectedDoc.fileId
        : selectedDoc.previewFileId || selectedDoc.fileId
      const canPreviewBlob = previewFileId && (
        shouldRenderOriginal ||
        Boolean(selectedDoc.previewFileId) ||
        previewKind === 'pdf' ||
        previewKind === 'image' ||
        selectedDoc.previewFileContentType?.toLowerCase().includes('pdf')
      )

      if (!canPreviewBlob) {
        return
      }

      if (selectedDoc.mockPreviewUrl) {
        setPreviewUrl(selectedDoc.mockPreviewUrl)
        return
      }

      if (String(previewFileId).startsWith('mock-') || String(previewFileId).startsWith('local-')) {
        return
      }

      try {
        setPreviewLoading(true)
        const response = await api.get(`/files/preview/${previewFileId}`, {
          responseType: 'blob',
        })
        const blob = response.data

        if (['word', 'excel', 'hwp', 'hwpx'].includes(previewKind)) {
          setPreviewData(await blob.arrayBuffer())
          return
        }

        const previewType =
          selectedDoc.previewFileId || previewKind === 'pdf' || selectedDoc.previewFileContentType?.toLowerCase().includes('pdf')
            ? 'application/pdf'
            : selectedDoc.fileContentType || blob?.type || 'image/*'
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

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [selectedDoc])

  useEffect(() => {
    if (!showFullView) return undefined

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setShowFullView(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showFullView])

  const handleExport = async () => {
    if (!selectedDoc || !selectedDoc.fileId) return

    try {
      setIsExporting(true)
      const res = await downloadDocumentFile(selectedDoc.fileId)

      const disposition = res.headers['content-disposition']
      let filename = selectedDoc.originalFileName || selectedDoc.title || 'document'
      if (disposition) {
        const match = disposition.match(/filename\*=UTF-8''(.+)|filename="?([^;\\"]+)"?/) 
        if (match) {
          filename = decodeURIComponent(match[1] || match[2])
        }
      }

      // 1. Try modern File System Access API (showSaveFilePicker)
      if ('showSaveFilePicker' in window) {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: filename,
          })
          const writable = await handle.createWritable()
          await writable.write(res.data)
          await writable.close()

          window.dispatchEvent(new CustomEvent('ang:mascot-alert', {
            detail: { message: '파일을 원하는 위치에 저장했어요!' },
          }))
          return // Exit after successful modern save
        } catch (pickerErr) {
          // User cancelled or other error - if cancelled, just return
          if (pickerErr.name === 'AbortError') return
          console.warn('File picker failed, falling back to traditional download:', pickerErr)
        }
      }

      // 2. Fallback to traditional <a> tag download
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      window.dispatchEvent(new CustomEvent('ang:mascot-alert', {
        detail: { message: '문서를 다운로드했어요!' },
      }))
    } catch (err) {
      console.error('문서다운로드 실패:', err)
      alert(err.response?.data?.message || err.message || '문서다운로드에 실패했습니다.')
    } finally {
      setIsExporting(false)
    }
  }

  const fetchDocuments = async () => {
    try { 
      setLoading(true)
      let response
      if (category === 'my') {
        response = await getMyDocuments()
      } else {
        const scopeParam = selectedScopeId === 'all' ? null : selectedScopeId
        response = await getDepartmentDocuments({ keyword: null, scopeId: scopeParam })
      }
      setDocuments(response.data?.data || [])
      setError(null)
    } catch (err) {
      console.error('문서 목록 조회 실패:', err)
      setError('문서 목록을 불러올 수 없습니다.')
      setDocuments([])
    } finally {
      setLoading(false)
    }
  }

  // file preview generation removed; rely on backend-provided documents

  const handleModalUpload = async (e) => {
    e.preventDefault()
    if (!uploadFile || !uploadTitle.trim()) return

    try {
      setIsUploading(true)
      window.dispatchEvent(new CustomEvent('ang:mascot-alert', {
        detail: { message: '파일을 업로드 중입니다...' },
      }))
      const formData = new FormData()
      formData.append('file', uploadFile)
      formData.append('title', uploadTitle)
      if (uploadTargetScopeId) {
        formData.append('targetScopeId', uploadTargetScopeId)
      }
      
      const response = await api.post('/documents', formData, { headers: { 'Content-Type': 'multipart/form-data' } })

      if (response.data?.success) {
        const newDoc = { ...response.data.data, source: 'uploaded' }
        if (category === 'my' && !uploadTargetScopeId) {
          setDocuments([newDoc, ...documents])
        } else if (category === 'dept' && uploadTargetScopeId) {
          // If we are in department view and uploaded to a department, we should ideally refresh or check if it matches
          fetchDocuments()
        }
        setSelectedDoc(newDoc)
        setShowUploadModal(false)
        setUploadTitle('')
        setUploadFile(null)
        setUploadTargetScopeId('')
        window.dispatchEvent(new CustomEvent('ang:mascot-alert', {
          detail: { message: '파일이 업로드되었어요!' },
        }))
      } else {
        throw new Error(response.data?.message || '파일 업로드에 실패했습니다.')
      }
    } catch (err) {
      console.error('파일 업로드 실패:', err)
      alert(err.response?.data?.message || err.message || '파일 업로드에 실패했습니다.')
    } finally {
      setIsUploading(false)
    }
  }

  const handleDelete = async (e, docId) => {
    e.stopPropagation()
    if (!window.confirm('정말 삭제하시겠습니까? 삭제된 문서는 휴지통으로 이동합니다.')) return
    try {
      await deleteDocument(docId)
      setDocuments(prev => prev.filter(d => d.docId !== docId))
      if (selectedDoc?.docId === docId) setSelectedDoc(null)
      window.dispatchEvent(new CustomEvent('ang:mascot-alert', {
        detail: { message: '문서를 휴지통으로 보냈어요.' },
      }))
    } catch (err) {
      alert('삭제 실패: ' + (err.response?.data?.message || '오류가 발생했습니다.'))
    }
  }

  const handleAddToPrompt = () => {
    if (selectedDoc && !attachedDocs.some((doc) => doc.docId === selectedDoc.docId)) {
      setAttachedDocs([...attachedDocs, selectedDoc])
    }
  }

  const handleRemoveAttachedDoc = (docId) => {
    setAttachedDocs(attachedDocs.filter((doc) => doc.docId !== docId))
  }

  const handleAddDocxEditInstruction = (instruction) => {
    setDocxEditInstructions((current) => [...current, instruction])
  }

  const handleRemoveDocxEditInstruction = (instructionId) => {
    setDocxEditInstructions((current) => current.filter((instruction) => instruction.id !== instructionId))
  }

  const handleAiGenerate = async (mode = 'create') => {
    const selectedKind = selectedDoc ? getDocumentPreviewKind(selectedDoc) : null
    const hasDocxEditInstructions = mode === 'edit' && selectedKind === 'word' && docxEditInstructions.length > 0

    if (!prompt.trim() && !hasDocxEditInstructions) {
      alert('프롬프트를 입력하세요.')
      return
    }

    const editOutputFormat =
      selectedKind === 'hwp' || selectedKind === 'hwpx'
        ? 'hwp'
        : selectedKind === 'word'
          ? 'docx'
          : selectedKind === 'excel'
            ? 'xlsx'
            : selectedKind === 'pdf'
              ? 'pdf'
              : selectedKind === 'text'
                ? 'txt'
                : null

    // 새 문서 작성 시에는 선택된 문서의 형식을 그대로 따라간다 (hwp 선택 → hwp 생성, xlsx 선택 → xlsx 생성 등).
    const createOutputFormat =
      selectedKind === 'hwp' || selectedKind === 'hwpx'
        ? 'hwp'
        : selectedKind === 'excel'
          ? 'xlsx'
          : selectedKind === 'pdf'
            ? 'pdf'
            : 'docx'

    if (mode === 'edit' && !selectedDoc) {
      alert('수정할 문서를 선택하세요.')
      return
    }

    if (mode === 'edit' && !editOutputFormat) {
      alert('이미지 형식은 AI 수정을 지원하지 않습니다.')
      return
    }

    const scopedEditPrompt = docxEditInstructions
      .map((instruction, index) => [
        `${index + 1}. blockId: ${instruction.blockId}`,
        `selectedText: ${instruction.selectedText}`,
        `instruction: ${instruction.instruction}`,
      ].join('\n'))
      .join('\n\n')

    const finalPrompt = hasDocxEditInstructions
      ? [
        prompt.trim(),
        '아래 DOCX 블록별 수정 요청은 사용자가 미리보기에서 직접 지정한 위치입니다. 반드시 각 요청의 blockId를 유지하고, selectedText를 find 값으로 우선 사용해 주세요. instruction에 해당하는 내용만 replace에 반영하고, 요청하지 않은 문단은 수정하지 마세요. selectedText가 비어 있으면 해당 blockId 근처 문맥에서 instruction만 반영할 최소 find/replace를 만드세요.',
        scopedEditPrompt,
      ].filter(Boolean).join('\n\n')
      : prompt

    const payload = {
      prompt: finalPrompt,
      mode,
      outputFormat: mode === 'edit' ? editOutputFormat : createOutputFormat,
      sourceDocId: mode === 'edit' ? selectedDoc.docId : null,
      attachedDocIds: attachedDocs
        .filter((doc) => mode !== 'edit' || doc.docId !== selectedDoc.docId)
        .map((doc) => doc.docId),
    }

    try {
      setAiProgressMode(mode)
      setAiProgressStep(0)
      await startGeneration(payload)
      if (mountedRef.current) {
        setPrompt('')
        setAttachedDocs([])
        setDocxEditInstructions([])
      }
    } catch (err) {
      console.error('AI 문서 생성 실패:', err)
      if (mountedRef.current) {
        alert(err.response?.data?.message || err.message || 'AI 문서 생성에 실패했습니다.')
      }
    } finally {
      if (mountedRef.current) {
        setAiProgressMode(null)
        setAiProgressStep(0)
      }
    }
  }

  const aiProgressSteps = aiProgressMode ? AI_PROGRESS_STEPS[aiProgressMode] : []
  const currentAiProgress = aiProgressSteps[aiProgressStep] || aiProgressSteps[0]

  return (
    <div className="document-writer-container">
      <div className="document-sidebar">
        <div className="sidebar-header">
          <div className="document-sidebar-title-row">
            <h3>문서 목록</h3>
            <button
              type="button"
              className="document-upload-icon-btn"
              onClick={() => setShowUploadModal(true)}
              disabled={isUploading}
              title="파일 업로드"
              aria-label="파일 업로드"
            >
              <FiPlus />
            </button>
          </div>
          <div className="category-tabs">
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
              부서 문서
            </button>
          </div>

          {category === 'dept' && myScopes.length > 0 && (
            <div className="scope-filter">
              <select
                className="scope-select"
                value={selectedScopeId}
                onChange={(e) => setSelectedScopeId(e.target.value)}
              >
                <option value="all">전체 부서 문서보기</option>
                {myScopes.map((scope) => (
                  <option key={scope.id} value={scope.id}>{scope.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="search-with-filter">
          <input
            type="text"
            placeholder="문서 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <button 
            type="button"
            className="sort-toggle-btn"
            onClick={() => setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')}
            title={sortOrder === 'newest' ? '최신순 (오래된순으로 변경)' : '오래된순 (최신순으로 변경)'}
          >
            {sortOrder === 'newest' ? '↓' : '↑'}
          </button>
        </div>

        <div className="document-list">
          {loading ? (
            <div className="loading">로딩 중...</div>
          ) : error ? (
            <div className="error">{error}</div>
          ) : filteredDocuments.length === 0 ? (
            <div className="empty-state">
              {documents.length === 0 ? '문서가 없습니다.' : '검색 결과가 없습니다.'}
            </div>
          ) : (
            filteredDocuments.map((doc) => (
              <div
                key={doc.docId}
                className={`document-item ${selectedDoc?.docId === doc.docId ? 'active' : ''}`}
                onClick={() => setSelectedDoc(doc)}
              >
                <div className="document-item-row">
                  <div className="doc-title">{doc.title}</div>
                  <div className="document-item-actions">
                    <span className={`doc-type-tag doc-type-tag--${getDocumentPreviewKind(doc)}`}>
                      {getFileTypeLabel(doc)}
                    </span>
                    {doc.canDelete && (
                      <button
                        className="btn-delete-doc"
                        onClick={(e) => handleDelete(e, doc.docId)}
                        title="삭제"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  {category === 'dept' && doc.scopeName && (
                    <span className={`doc-scope-tag ${doc.scopeName === 'N/A' ? 'doc-scope-tag--personal' : ''}`}>
                      {doc.scopeName === 'N/A' ? '개인 문서' : doc.scopeName}
                    </span>
                  )}
                </div>
                <div className="doc-date">
                  {new Date(doc.createdAt).toLocaleString('ko-KR', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className={`document-main ${promptOpen ? '' : 'document-main--prompt-collapsed'}`}>
        <div className="document-content">
          {selectedDoc ? (
            <div className="selected-document">
              <div className="doc-viewer-header">
                <div className="doc-viewer-header-left">
                  <h2 className="selected-document-title">{selectedDoc.title}</h2>
                  <span className={`doc-type-tag doc-type-tag--${getDocumentPreviewKind(selectedDoc)}`}>
                    {getFileTypeLabel(selectedDoc)}
                  </span>
                  {getDocumentPreviewKind(selectedDoc) === 'word' && (
                    <button
                      type="button"
                      className={`doc-edit-mode-toggle ${docxEditMode ? 'active' : ''}`}
                      onClick={() => setDocxEditMode((enabled) => !enabled)}
                    >
                      {docxEditMode ? 'DOCX 편집 끄기' : 'DOCX 편집'}
                    </button>
                  )}
                  {selectedDoc.scopeName && (
                    <span className={`doc-scope-badge ${selectedDoc.scopeName === 'N/A' ? 'doc-scope-badge--personal' : ''}`}>
                      {selectedDoc.scopeName === 'N/A' ? '개인 문서' : selectedDoc.scopeName}
                    </span>
                  )}
                  <span className="doc-meta-item">
                    작성일: {new Date(selectedDoc.createdAt).toLocaleString('ko-KR', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false
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
          ) : (
            <div className="empty-content">
              <p>왼쪽 목록에서 문서를 선택하거나 새 문서를 작성하세요.</p>
            </div>
          )}
        </div>

        <div className="ai-prompt-section">
          <div className="prompt-tabs">
            <button
              type="button"
              className={`prompt-toggle-compact prompt-toggle-left ${promptOpen ? 'open' : ''}`}
              onClick={() => setPromptOpen((open) => !open)}
              aria-expanded={promptOpen}
              aria-label={promptOpen ? '프롬프트 닫기' : '프롬프트 열기'}
              title={promptOpen ? '프롬프트 닫기' : '프롬프트 열기'}
            >
              <FiChevronRight />
            </button>
            {attachedDocs.map((doc) => (
              <div key={doc.docId} className="prompt-tab prompt-tab-added">
                <button
                  type="button"
                  className="tab-remove-btn"
                  onClick={() => handleRemoveAttachedDoc(doc.docId)}
                  title="제거"
                >
                  ×
                </button>
                <span className="tab-name">{doc.title}</span>
              </div>
            ))}

            {docxEditInstructions.map((instruction) => (
              <div key={instruction.id} className="prompt-tab prompt-tab-docx-edit">
                <button
                  type="button"
                  className="tab-remove-btn"
                  onClick={() => handleRemoveDocxEditInstruction(instruction.id)}
                  title="삭제"
                >
                  ×
                </button>
                <span className="tab-name">{instruction.blockId} 수정 요청</span>
              </div>
            ))}

            {selectedDoc && !attachedDocs.some((doc) => doc.docId === selectedDoc.docId) && (
              <div
                className="prompt-tab prompt-tab-pending"
                onClick={handleAddToPrompt}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleAddToPrompt()
                  }
                }}
              >
                <span className="tab-add-btn">+</span>
                <span className="tab-name">{selectedDoc.title}</span>
              </div>
            )}
          </div>

          {promptOpen && (
          <div className="prompt-input-group">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="프롬프트를 입력하세요..."
              className="prompt-textarea"
              disabled={aiLoading}
            />

            {aiLoading && currentAiProgress && (
              <div className="ai-progress-panel" role="status" aria-live="polite">
                <div className="ai-progress-copy">
                  <strong>{currentAiProgress.label}</strong>
                  <span>{currentAiProgress.description}</span>
                </div>
                <div className="ai-progress-track" aria-hidden="true">
                  <div
                    className="ai-progress-fill"
                    style={{ width: `${currentAiProgress.percent}%` }}
                  />
                </div>
              </div>
            )}

            <div className="prompt-actions">
              <div className="prompt-actions-left">
                <button
                  type="button"
                  onClick={() => handleAiGenerate('create')}
                  className="btn-generate btn-generate--create"
                  disabled={aiLoading}
                >
                  {aiLoading ? '생성 중...' : '새 문서 작성'}
                </button>
              </div>

              <div className="prompt-actions-right">
                <button
                  type="button"
                  onClick={() => handleAiGenerate('edit')}
                  className="btn-generate btn-generate--edit"
                  disabled={aiLoading || !selectedDoc}
                >
                  <FiEdit3 />
                  <span>{aiLoading ? '수정 중...' : '선택 문서 수정'}</span>
                </button>
                {selectedDoc && getDocumentPreviewKind(selectedDoc) === 'word' && (
                  <button
                    type="button"
                    className={`btn-generate btn-generate--docx-edit ${docxEditMode ? 'active' : ''}`}
                    onClick={() => setDocxEditMode((enabled) => !enabled)}
                    disabled={aiLoading}
                  >
                    {docxEditMode ? 'DOCX 편집 끄기' : 'DOCX 편집'}
                  </button>
                )}
              </div>
            </div>
          </div>
          )}
        </div>
      </div>

      {showFullView && selectedDoc && (
        <div
          className="modal-overlay doc-fullview-overlay"
          onClick={() => setShowFullView(false)}
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
              onClick={() => setShowFullView(false)}
              aria-label="닫기"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {showUploadModal && (
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
      )}
    </div>
  )
}
