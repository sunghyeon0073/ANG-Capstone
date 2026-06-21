import { useState, useMemo, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getMyDocuments,
  getDepartmentDocuments,
  deleteDocument,
  updateDocument,
  uploadDocument
} from '../api/documentApi'
import { getMyScopes } from '../api/scopeApi'
import { getBaseName, getExtension } from '../utils/fileUtils'
import { getDocumentPreviewKind } from '../utils/documentFileUtils'
import { useAiGeneration } from '../contexts/useAiGeneration'

const createDraftDocumentTab = () => ({
  id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  doc: null,
})

const extractDocumentList = (payload) => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.content)) return payload.content
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.data?.content)) return payload.data.content
  return []
}

export function useDocumentWorkspace() {
  const queryClient = useQueryClient()
  
  // -- View / Filter States --
  const [category, setCategory] = useState('my')
  const [selectedScopeId, setSelectedScopeId] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [sortOrder, setSortOrder] = useState('newest')
  const [myScopes, setMyScopes] = useState([])

  // -- Tab & Document Selection States --
  const [selectedDoc, setSelectedDoc] = useState(null)

  // -- Prompt & AI States --
  const [prompt, setPrompt] = useState('')
  const [attachedDocs, setAttachedDocs] = useState([])
  const [generationSummary, setGenerationSummary] = useState(null)
  const [aiProgressMode, setAiProgressMode] = useState(null)
  const [aiProgressStep, setAiProgressStep] = useState(0)
  const [targetFormat, setTargetFormat] = useState('docx') // Default AI output format

  const toggleAttachedDoc = (doc) => {
    setAttachedDocs(prev => {
      const exists = prev.find(d => d.docId === doc.docId)
      if (exists) return prev.filter(d => d.docId !== doc.docId)
      return [...prev, doc]
    })
  }

  const clearAttachedDocs = () => setAttachedDocs([])

  // -- Editor States --
  const [docxEditInstructions, setDocxEditInstructions] = useState([])
  const [docxEditMode, setDocxEditMode] = useState(false)
  const [titleEditMode, setTitleEditMode] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [isTitleSaving, setIsTitleSaving] = useState(false)
  
  // -- UI States --
  const [showFullView, setShowFullView] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const mountedRef = useRef(true)
  const { isGenerating: aiLoading, startGeneration } = useAiGeneration()

  // 1. Load Scopes
  useEffect(() => {
    const fetchScopes = async () => {
      try {
        const res = await getMyScopes()
        setMyScopes(res.data?.data || [])
      } catch (err) {
        console.error('Failed to load scopes', err)
      }
    }
    fetchScopes()
    return () => { mountedRef.current = false }
  }, [])

  // 2. Load Documents
  const { data: documents = [], isLoading: loading } = useQuery({
    queryKey: ['documents', category, selectedScopeId],
    queryFn: async () => {
      let response
      if (category === 'my') {
        response = await getMyDocuments({ size: 1000 })
      } else {
        const scopeParam = selectedScopeId === 'all' ? null : selectedScopeId
        response = await getDepartmentDocuments({ keyword: null, scopeId: scopeParam, size: 1000 })
      }
      return extractDocumentList(response.data?.data)
    }
  })

  // 3. Filter and Sort
  const filteredDocuments = useMemo(() => {
    const filtered = documents.filter((doc) => {
      if (!searchTerm) return true
      return doc.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
             doc.ownerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
             doc.originalContent?.toLowerCase().includes(searchTerm.toLowerCase())
    })
    return [...filtered].sort((a, b) => {
      if (sortOrder === 'newest') return new Date(b.createdAt) - new Date(a.createdAt)
      if (sortOrder === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt)
      if (sortOrder === 'title') return (a.title || "").localeCompare(b.title || "")
      return 0
    })
  }, [documents, searchTerm, sortOrder])



  useEffect(() => {
    setDocxEditInstructions([])
    setDocxEditMode(false)
  }, [selectedDoc?.docId])

  // Mutations
  const deleteMutation = useMutation({
    mutationFn: (docId) => deleteDocument(docId),
    onSuccess: (_, docId) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      if (selectedDoc?.docId === docId) setSelectedDoc(null)
      window.dispatchEvent(new CustomEvent('ang:mascot-alert', { detail: { message: '문서를 휴지통으로 보냈어요.' } }))
    },
    onError: (err) => {
      alert('삭제 실패: ' + (err.response?.data?.message || '오류가 발생했습니다.'))
    }
  })

  const updateMutation = useMutation({
    mutationFn: ({ docId, nextTitle }) => updateDocument(docId, { title: nextTitle }),
    onSuccess: (_, { docId, nextTitle }) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      const applyTitle = doc => doc.docId === docId ? { ...doc, title: nextTitle } : doc
      setSelectedDoc(prev => prev ? { ...prev, title: nextTitle } : prev)
      setAttachedDocs(prev => prev.map(applyTitle))
      setTitleEditMode(false)
    },
    onError: (err) => {
      alert(err.response?.data?.message || err.message || '문서 제목 수정에 실패했습니다.')
    }
  })

  const handleSelectDocument = (doc) => {
    setSelectedDoc(doc)
  }

  const handleDelete = (e, docId) => {
    e.stopPropagation()
    if (!window.confirm('정말 삭제하시겠습니까? 삭제된 문서는 휴지통으로 이동합니다.')) return
    deleteMutation.mutate(docId)
  }

  const saveTitleEdit = async () => {
    if (!selectedDoc || isTitleSaving) return
    const baseName = titleDraft.trim()
    if (!baseName) return alert('문서 제목을 입력해 주세요.')
    
    const ext = getExtension(selectedDoc.title)
    const nextTitle = baseName + ext
    if (nextTitle === selectedDoc.title) return setTitleEditMode(false)

    try {
      setIsTitleSaving(true)
      await updateMutation.mutateAsync({ docId: selectedDoc.docId, nextTitle })
    } finally {
      setIsTitleSaving(false)
    }
  }

  return {
    state: {
      category, selectedScopeId, searchTerm, sortOrder, myScopes,
      selectedDoc,
      prompt, attachedDocs, targetFormat, generationSummary, aiProgressMode, aiProgressStep,
      docxEditInstructions, docxEditMode, titleEditMode, titleDraft, isTitleSaving,
      showFullView, showUploadModal, isExporting,
      filteredDocuments, loading, aiLoading
    },
    actions: {
      setCategory, setSelectedScopeId, setSearchTerm, setSortOrder,
      setPrompt, setAttachedDocs, setTargetFormat, toggleAttachedDoc, clearAttachedDocs, setGenerationSummary,
      setAiProgressMode, setAiProgressStep, setDocxEditInstructions, setDocxEditMode,
      setTitleEditMode, setTitleDraft, setShowFullView,
      setShowUploadModal, setIsExporting, handleSelectDocument,
      handleDelete, saveTitleEdit, startGeneration, queryClient
    }
  }
}
