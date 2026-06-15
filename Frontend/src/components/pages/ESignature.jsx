import '../../style/esignature.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AttachmentViewer, ExcelSheetViewer, HwpxViewer } from '../esignature/AttachmentViewers'
import ActionModal from '../esignature/ActionModal'
import SignaturePage, { SignatureImg } from '../esignature/SignaturePage'
import {
  FiCheck,
  FiCheckSquare,
  FiClock,
  FiDownload,
  FiFileText,
  FiPenTool,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiSend,
  FiTrash2,
  FiUserPlus,
  FiX,
} from 'react-icons/fi'
import {
  approveApprovalDoc,
  getApprovalAttachmentById,
  getApprovalAttachments,
  downloadApprovalPdf,
  createApprovalDoc,
  createMyApprovalLine,
  deleteApprovalSign,
  deleteMyApprovalLine,
  delegateApprovalDoc,
  getApprovalDoc,
  listApprovalSigns,
  getApprovalTemplates,
  getCompletedInbox,
  getCompletedOutbox,
  getRejectedInbox,
  getDraftOutbox,
  getMyApprovalLines,
  getPendingInbox,
  getRejectedOutbox,
  getProgressOutbox,
  rejectApprovalDoc,
  updateApprovalDoc,
  uploadApprovalAttachment,
  uploadApprovalAttachmentMulti,
  uploadApprovalSign,
} from '../../api/approvalApi'
import { getAllUsers } from '../../api/userApi'
import api from '../../api/axios'
import { unwrap } from '../../utils/responseUtils'

const FOLDER_META = {
  'esignature-waiting': { label: '결재대기', hint: '내가 결재해야 할 문서' },
  'esignature-completed': { label: '완료', hint: '처리 완료된 문서' },
  'esignature-rejected': { label: '반려', hint: '반려된 문서' },
  'esignature-my': { label: '내가 요청', hint: '내가 기안한 문서' },
}

const FOLDER_ORDER = ['esignature-waiting', 'esignature-completed', 'esignature-rejected', 'esignature-my']
const LINE_TYPES = ['APPROVAL', 'AGREEMENT', 'REFERENCE', 'RECEIVER']

const EMPTY_FORM = {
  docId: null,
  templateId: '',
  title: '',
  securityLevel: '일반문서',
  retentionPeriod: '영구',
  department: '',
  requester: '',
  purpose: '',
  summary: '',
  content: '',
  budget: '',
  targetDate: '',
  notes: '',
}

const prettyDate = (dateString) => {
  if (!dateString) return '-'
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

const prettyDateTime = (dateString) => {
  if (!dateString) return '-'
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

const normalizeText = (value) => String(value || '').toLowerCase()

const parseFormData = (formData) => {
  if (!formData) return {}
  if (typeof formData !== 'string') return formData
  try { return JSON.parse(formData) } catch { return { raw: formData } }
}

const PRIMARY = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || '#3a5cad'

const lineTypeLabel = {
  APPROVAL: '결재', AGREEMENT: '합의', REFERENCE: '참조', RECEIVER: '수신',
}

const buildDocumentHtml = (doc) => {
  const parsed = parseFormData(doc.formData)
  const lines = (doc.approvalLines || []).slice().sort((a, b) => (a.lineOrder ?? 0) - (b.lineOrder ?? 0))
  const commentLines = lines.filter((l) => l.comment)
  const attachmentName = doc.attachmentUrl ? doc.attachmentUrl.split('/').pop().split('?')[0] : null

  const approvalCols = lines.map((l) => `<th>${lineTypeLabel[l.lineType] || l.lineType || ''}</th>`).join('')
  const positionCols = lines.map((l) => `<td>${l.approverPosition || ''}</td>`).join('')
  const nameCols = lines.map((l) => `<td>${l.approverName || ''}</td>`).join('')
  const signCols = lines.map(() => `<td>-</td>`).join('')
  const dateCols = lines.map((l) => {
    if (!l.processedAt) return '<td>-</td>'
    const d = new Date(l.processedAt)
    return `<td>${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getDate().toString().padStart(2,'0')}</td>`
  }).join('')

  const opinionRows = commentLines.map((l) => {
    const date = l.processedAt ? new Date(l.processedAt).toLocaleString('ko-KR', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12:false }) : '-'
    return `<tr>
      <td class="opinion-role">${lineTypeLabel[l.lineType] || l.lineType}/${l.approverName || ''}</td>
      <td class="opinion-text">${l.comment || ''}</td>
      <td class="opinion-date">${date}</td>
    </tr>`
  }).join('')

  const drafterLabel = doc.drafterPosition
    ? `${doc.drafterName || ''} (${doc.drafterPosition})`
    : (doc.drafterName || '-')

  const createdDate = doc.createdAt ? new Date(doc.createdAt).toLocaleDateString('ko-KR', { year:'numeric', month:'2-digit', day:'2-digit' }) : '-'
  const completedDate = doc.completedAt ? new Date(doc.completedAt).toLocaleDateString('ko-KR', { year:'numeric', month:'2-digit', day:'2-digit' }) : '-'
  const completedDateTime = doc.completedAt ? new Date(doc.completedAt).toLocaleString('ko-KR', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12:false }) : null

  const content = parsed.content || parsed.raw || ''

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<style>
  * { font-family: 'Malgun Gothic', sans-serif; box-sizing: border-box; }
  body { margin: 40px; font-size: 12px; color: #000; background: #fff; }
  .doc-number-header { margin-bottom: 10px; overflow: hidden; }
  .doc-number { float: left; font-size: 11px; color: #333; font-weight: bold; }
  .approval-table { float: right; border-collapse: collapse; font-size: 11px; }
  .approval-table th, .approval-table td { border: 1px solid #333; padding: 4px 8px; text-align: center; min-width: 60px; }
  .approval-table th { background-color: #f0f0f0; }
  .row-label { background-color: #f0f0f0; font-weight: bold; white-space: nowrap; min-width: 36px; }
  h1.doc-title { text-align: center; font-size: 20px; margin: 20px 0 10px 0; }
  .doc-info { margin-bottom: 16px; border-bottom: 1px solid #ccc; padding-bottom: 8px; }
  .doc-info table { width: 100%; border-collapse: collapse; }
  .doc-info td { padding: 4px 8px; font-size: 12px; }
  .doc-info td:first-child { font-weight: bold; width: 80px; color: #555; }
  .form-content { border: 1px solid #ccc; padding: 16px; min-height: 300px; white-space: pre-wrap; line-height: 1.8; }
  .opinion-history { margin-top: 20px; padding-top: 12px; border-top: 2px solid #333; }
  .opinion-history .section-title { font-size: 13px; font-weight: bold; margin-bottom: 8px; }
  .opinion-table { width: 100%; border-collapse: collapse; font-size: 11px; }
  .opinion-table td { border: 1px solid #ccc; padding: 5px 8px; vertical-align: top; }
  .opinion-role { white-space: nowrap; font-weight: bold; width: 100px; color: #333; }
  .opinion-text { width: auto; }
  .opinion-date { white-space: nowrap; width: 120px; color: #555; text-align: right; }
  .footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #ddd; text-align: center; font-size: 10px; color: #666; line-height: 1.6; }
</style>
</head>
<body>
  <div class="doc-number-header">
    <div class="doc-number">
      <div>문서번호: APPR-${doc.id}</div>
      ${completedDateTime ? `<div>결재완료: ${completedDateTime}</div>` : ''}
    </div>
    ${lines.length > 0 ? `
    <table class="approval-table">
      <thead>
        <tr><th></th>${approvalCols}</tr>
        <tr><td class="row-label">직급</td>${positionCols}</tr>
        <tr><td class="row-label">성명</td>${nameCols}</tr>
        <tr><td class="row-label">서명</td>${signCols}</tr>
        <tr><td class="row-label">결재일</td>${dateCols}</tr>
      </thead>
    </table>` : ''}
  </div>

  <h1 class="doc-title">${doc.title || ''}</h1>

  <div class="doc-info">
    <table>
      <tr><td>기안자</td><td>${drafterLabel}</td></tr>
      <tr><td>기안일</td><td>${createdDate}</td></tr>
      <tr><td>완료일</td><td>${completedDate}</td></tr>
      ${doc.templateTitle ? `<tr><td>양식</td><td>${doc.templateTitle}</td></tr>` : ''}
      <tr><td>보안등급</td><td>${doc.securityLevel || '-'} <span style="padding-left:24px;font-weight:bold;color:#555;">보존연한</span> ${doc.retentionPeriod || '-'}</td></tr>
      ${attachmentName ? `<tr><td>첨부파일</td><td>${attachmentName}</td></tr>` : ''}
    </table>
  </div>

  <div class="form-content">${content}</div>

  ${opinionRows ? `
  <div class="opinion-history">
    <div class="section-title">결재 의견 이력</div>
    <table class="opinion-table">${opinionRows}</table>
  </div>` : ''}

  <div class="footer">
    이 문서는 전자결재 시스템에서 생성된 공식 결재 기록입니다.<br/>
    문서번호 <strong>APPR-${doc.id}</strong> 으로 시스템에서 원본을 확인할 수 있습니다.
  </div>
</body>
</html>`
}

const approvalStatusMeta = {
  DRAFT: { label: '임시저장', color: '#6B7280' },
  IN_PROGRESS: { label: '진행중', color: PRIMARY },
  APPROVED: { label: '승인완료', color: '#16a34a' },
  REJECTED: { label: '반려', color: '#dc2626' },
  CANCELLED: { label: '회수', color: '#d97706' },
  EXPIRED: { label: '만료', color: '#334155' },
}

const lineStatusMeta = {
  WAITING: { label: '대기', color: '#94A3B8' },
  ACTIVE: { label: '진행', color: PRIMARY },
  APPROVED: { label: '승인', color: '#16a34a' },
  REJECTED: { label: '반려', color: '#dc2626' },
  DELEGATED: { label: '대리결재', color: '#7c3aed' },
}

const dedupeDocs = (docs) => {
  const map = new Map()
  docs.filter(Boolean).forEach((doc) => { map.set(doc.id, doc) })
  return Array.from(map.values()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

export default function ESignature({ currentSubPage, me, onSubPageChange }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [activeListSearch, setActiveListSearch] = useState('')
  const [listPage, setListPage] = useState(1)
  const LIST_PAGE_SIZE = 10
  const [approvalBoxes, setApprovalBoxes] = useState({ waiting: [], completed: [], rejected: [], my: [] })
  const [templates, setTemplates] = useState([])
  const [myLines, setMyLines] = useState([])
  const [users, setUsers] = useState([])
  const [signatures, setSignatures] = useState([])
  const [signatureFile, setSignatureFile] = useState(null)
  const [signatureLabel, setSignatureLabel] = useState('')
  const [selectedApprovalId, setSelectedApprovalId] = useState(null)
  const [selectedApproval, setSelectedApproval] = useState(null)
  const [mode, setMode] = useState('view')
  const [form, setForm] = useState(EMPTY_FORM)
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [approvalLines, setApprovalLines] = useState([])
  const [attachmentFile, setAttachmentFile] = useState(null)
  const [attachmentFiles, setAttachmentFiles] = useState([])
  const [selectedAttachmentId, setSelectedAttachmentId] = useState(null)
  const [userSearch, setUserSearch] = useState('')
  const [saveState, setSaveState] = useState('idle')
  const [linePresetSaving, setLinePresetSaving] = useState(false)
  const [signSaving, setSignSaving] = useState(false)
  const [actionState, setActionState] = useState('')
  const [actionModal, setActionModal] = useState(null) // 'approve' | 'reject' | 'delegate' | null

  const currentFolder = FOLDER_META[currentSubPage] || FOLDER_META['esignature-waiting']
  const selectedTemplate = useMemo(
    () => templates.find((t) => String(t.id) === String(selectedTemplateId)) || null,
    [templates, selectedTemplateId]
  )
  const currentUserId = me?.id

  const activeDocuments = useMemo(() => {
    const key = currentSubPage === 'esignature-completed' ? 'completed'
      : currentSubPage === 'esignature-rejected' ? 'rejected'
      : currentSubPage === 'esignature-my' ? 'my' : 'waiting'
    const docs = approvalBoxes[key] || []
    const keyword = activeListSearch.trim().toLowerCase()
    if (!keyword) return docs
    return docs.filter((doc) =>
      normalizeText(doc.title).includes(keyword) ||
      normalizeText(doc.drafterName).includes(keyword) ||
      normalizeText(doc.id).includes(keyword)
    )
  }, [approvalBoxes, activeListSearch, currentSubPage])

  const listTotalPages = Math.max(1, Math.ceil(activeDocuments.length / LIST_PAGE_SIZE))
  const pagedDocuments = activeDocuments.slice((listPage - 1) * LIST_PAGE_SIZE, listPage * LIST_PAGE_SIZE)

  useEffect(() => { setListPage(1) }, [currentSubPage, activeListSearch])

  const usersFiltered = useMemo(() => {
    const keyword = userSearch.trim().toLowerCase()
    if (!keyword) return users.slice(0, 20)
    return users.filter((user) => {
      const deptText = (user.departments || []).map((d) => `${d.scopeName || ''} ${d.position || ''}`).join(' ').toLowerCase()
      return (
        normalizeText(user.name).includes(keyword) ||
        normalizeText(user.empNo).includes(keyword) ||
        normalizeText(user.position).includes(keyword) ||
        normalizeText(user.dept).includes(keyword) ||
        deptText.includes(keyword)
      )
    })
  }, [userSearch, users])

  const activeApprovalLine = useMemo(() => {
    if (!selectedApproval?.approvalLines) return null
    return selectedApproval.approvalLines.find((line) => {
      const isMe = line.approverId === currentUserId || line.delegateeId === currentUserId
      return line.status === 'ACTIVE' && isMe
    }) || null
  }, [currentUserId, selectedApproval])

  const canEditSelectedDraft = selectedApproval && selectedApproval.drafterId === currentUserId && selectedApproval.status === 'DRAFT'
  const canActOnSelected = selectedApproval && selectedApproval.status === 'IN_PROGRESS' && activeApprovalLine

  const refreshAll = async () => {
    setRefreshing(true)
    setError('')
    try {
      const [templatesRes, usersRes, myLinesRes, signRes, waitingRes, completedRes, rejectedInboxRes, rejectedOutboxRes, draftRes, progressRes, completedOutboxRes] =
        await Promise.allSettled([
          getApprovalTemplates(), getAllUsers(), getMyApprovalLines(), listApprovalSigns(),
          getPendingInbox({ page: 0, size: 30 }), getCompletedInbox({ page: 0, size: 30 }),
          getRejectedInbox({ page: 0, size: 30 }), getRejectedOutbox({ page: 0, size: 30 }),
          getDraftOutbox({ page: 0, size: 30 }), getProgressOutbox({ page: 0, size: 30 }),
          getCompletedOutbox({ page: 0, size: 30 }),
        ])

      const extractList = (s) => {
        if (s.status !== 'fulfilled') return []
        const data = unwrap(s.value, [])
        return Array.isArray(data) ? data : data?.content || []
      }
      const extractPage = (s) => {
        if (s.status !== 'fulfilled') return []
        const data = unwrap(s.value, null)
        return data?.content || []
      }

      setTemplates(extractList(templatesRes))
      setUsers(extractList(usersRes))
      setMyLines(extractList(myLinesRes))
      setSignatures(signRes.status === 'fulfilled' ? (unwrap(signRes.value, []) || []) : [])
      setApprovalBoxes({
        waiting: extractPage(waitingRes),
        completed: extractPage(completedRes),
        rejected: dedupeDocs([...extractPage(rejectedInboxRes), ...extractPage(rejectedOutboxRes)]),
        my: dedupeDocs([...extractPage(draftRes), ...extractPage(progressRes), ...extractPage(completedOutboxRes), ...extractPage(rejectedOutboxRes)]),
      })
    } catch (e) {
      console.error('전자결재 데이터 로드 실패:', e)
      setError('전자결재 데이터를 불러오지 못했습니다.')
    } finally {
      setRefreshing(false)
      setLoading(false)
    }
  }

  useEffect(() => {
    let alive = true
    ;(async () => {
      try { await refreshAll() } finally { if (alive) setLoading(false) }
    })()
    return () => { alive = false }
  }, [])

  const resetComposer = () => {
    setSelectedApproval(null)
    setSelectedApprovalId(null)
    setMode('compose')
    setForm({ ...EMPTY_FORM, department: me?.dept || me?.department || '', requester: `${me?.name || ''}${me?.position ? ` ${me.position}` : ''}`.trim() })
    setSelectedTemplateId('')
    setApprovalLines([])
    setAttachmentFile(null)
    setAttachmentFiles([])
    setActiveListSearch('')
    onSubPageChange?.('esignature-waiting')
  }

  const loadApprovalDetail = async (docId) => {
    const response = await getApprovalDoc(docId)
    return unwrap(response)
  }

  const openApproval = async (docId) => {
    setError('')
    try {
      const detail = await loadApprovalDetail(docId)
      setSelectedApproval(detail)
      setSelectedApprovalId(docId)
      setMode('view')
      // auto-select first attachment if available
      const firstAtt = (detail.attachments || [])[0]
      setSelectedAttachmentId(firstAtt ? firstAtt.id : null)
    } catch (e) {
      console.error(e)
      setError('문서 상세를 불러오지 못했습니다.')
    }
  }

  const handleChangeFolder = (folderId) => {
    setSelectedApproval(null)
    setSelectedApprovalId(null)
    if (folderId === 'esignature-signature') {
      setMode('signature')
    } else {
      setMode('view')
    }
    onSubPageChange?.(folderId)
  }

  const handleBackToList = () => {
    setSelectedApproval(null)
    setSelectedApprovalId(null)
    setMode('view')
  }

  const editSelectedDraft = async () => {
    if (!selectedApproval) return
    const detail = selectedApproval.id ? selectedApproval : await loadApprovalDetail(selectedApprovalId)
    const parsed = parseFormData(detail.formData)
    setForm({
      docId: detail.id,
      templateId: detail.templateId ? String(detail.templateId) : '',
      title: detail.title || '',
      securityLevel: detail.securityLevel || '일반문서',
      retentionPeriod: detail.retentionPeriod || '영구',
      department: parsed.department || me?.dept || me?.department || '',
      requester: parsed.requester || `${detail.drafterName || me?.name || ''}${detail.drafterPosition ? ` ${detail.drafterPosition}` : ''}`.trim(),
      purpose: parsed.purpose || '',
      summary: parsed.summary || detail.title || '',
      content: parsed.content || parsed.raw || '',
      budget: parsed.budget || '',
      targetDate: parsed.targetDate || '',
      notes: parsed.notes || '',
    })
    setSelectedTemplateId(detail.templateId ? String(detail.templateId) : '')
    setApprovalLines((detail.approvalLines || []).map((line) => ({
      approverId: line.approverId, approverName: line.approverName,
      approverPosition: line.approverPosition, lineOrder: line.lineOrder, lineType: line.lineType || 'APPROVAL',
    })))
    setAttachmentFile(null)
    setAttachmentFiles([])
    setMode('compose')
  }

  const saveMyLinePreset = async () => {
    if (approvalLines.length === 0) { alert('먼저 결재선을 추가해주세요.'); return }
    const presetName = window.prompt('즐겨찾기 결재선 이름을 입력해주세요.')
    if (!presetName) return
    setLinePresetSaving(true)
    try {
      await createMyApprovalLine({ name: presetName, items: approvalLines.map((line, i) => ({ approverId: line.approverId, lineOrder: i + 1, lineType: line.lineType })) })
      await refreshAll()
      alert('즐겨찾기 결재선이 저장되었습니다.')
    } catch (e) { console.error(e); alert('결재선 저장에 실패했습니다.') }
    finally { setLinePresetSaving(false) }
  }

  const applyMyLinePreset = (preset) => {
    setApprovalLines((preset.items || []).map((item, i) => ({
      approverId: item.approverId, approverName: item.approverName, approverPosition: item.approverPosition,
      lineOrder: item.lineOrder || i + 1, lineType: item.lineType || 'APPROVAL',
    })))
  }

  const removeMyLinePreset = async (presetId) => {
    if (!window.confirm('선택한 결재선을 삭제할까요?')) return
    try { await deleteMyApprovalLine(presetId); await refreshAll() }
    catch (e) { console.error(e); alert('결재선 삭제에 실패했습니다.') }
  }

  const addApprover = (user) => {
    if (approvalLines.some((line) => line.approverId === user.id)) return
    setApprovalLines((curr) => [...curr, { approverId: user.id, approverName: user.name, approverPosition: user.position || user.dept || '', lineOrder: curr.length + 1, lineType: 'APPROVAL' }])
  }

  const removeApprover = (approverId) => {
    setApprovalLines((curr) => curr.filter((l) => l.approverId !== approverId).map((l, i) => ({ ...l, lineOrder: i + 1 })))
  }

  const updateApproverLine = (approverId, patch) => {
    setApprovalLines((curr) => curr.map((l) => (l.approverId === approverId ? { ...l, ...patch } : l)))
  }

  const buildPayload = () => ({
    templateId: selectedTemplateId ? Number(selectedTemplateId) : null,
    title: form.title.trim(),
    formData: JSON.stringify({
      title: form.title.trim(), department: form.department, requester: form.requester,
      purpose: form.purpose, summary: form.summary, content: form.content,
      budget: form.budget, targetDate: form.targetDate, notes: form.notes,
      templateId: selectedTemplate?.id || null, templateTitle: selectedTemplate?.title || null,
      templateCategory: selectedTemplate?.category || null,
    }),
    attachmentUrl: null,
    submitNow: false,
    securityLevel: form.securityLevel,
    retentionPeriod: form.retentionPeriod,
    approvalLines: approvalLines.map((line, i) => ({ approverId: Number(line.approverId), lineOrder: i + 1, lineType: line.lineType })),
  })

  const persistApproval = async (submitNow) => {
    if (!form.title.trim()) { alert('제목을 입력해주세요.'); return }
    if (approvalLines.length === 0) { alert('결재선을 최소 1명 이상 지정해주세요.'); return }
    const payload = buildPayload()
    setSaveState(submitNow ? 'submitting' : 'saving')
    try {
      let docId = form.docId
      if (docId) { await updateApprovalDoc(docId, payload) }
      else { const created = await createApprovalDoc(payload); docId = unwrap(created)?.id }
      if (!docId) throw new Error('문서 ID를 확인할 수 없습니다.')
      for (const file of attachmentFiles) {
        await uploadApprovalAttachmentMulti(docId, file)
      }
      if (submitNow) await updateApprovalDoc(docId, { ...payload, submitNow: true })
      const detail = await loadApprovalDetail(docId)
      setSelectedApproval(detail)
      setSelectedApprovalId(docId)
      setMode('view')
      setForm((c) => ({ ...c, docId }))
      setAttachmentFile(null)
      setAttachmentFiles([])
      await refreshAll()
      alert(submitNow ? '결재가 상신되었습니다.' : '임시저장되었습니다.')
    } catch (e) {
      console.error(e)
      alert(e.response?.data?.message || '결재 문서 저장에 실패했습니다.')
    } finally { setSaveState('idle') }
  }

  const handleApprove = () => setActionModal('approve')
  const handleReject = () => setActionModal('reject')
  const handleDelegate = () => setActionModal('delegate')

  const handleActionConfirm = async ({ comment, reason, delegateeId, delegateeName }) => {
    if (!selectedApproval) return
    const type = actionModal
    setActionState(type)
    try {
      if (type === 'approve') {
        await approveApprovalDoc(selectedApproval.id, { comment })
      } else if (type === 'reject') {
        await rejectApprovalDoc(selectedApproval.id, { reason })
      } else if (type === 'delegate') {
        await delegateApprovalDoc(selectedApproval.id, { delegateeId, comment })
      }
      setSelectedApproval(await loadApprovalDetail(selectedApproval.id))
      await refreshAll()
      setActionModal(null)
    } catch (e) {
      console.error(e)
      alert(e.response?.data?.message || '처리에 실패했습니다.')
    } finally {
      setActionState('')
    }
  }

  const handleSignUpload = async () => {
    if (!signatureFile) { alert('업로드할 서명 이미지를 선택해주세요.'); return }
    setSignSaving(true)
    try {
      await uploadApprovalSign(signatureFile, signatureLabel.trim() || null)
      setSignatureFile(null)
      setSignatureLabel('')
      await refreshAll()
      alert('서명이 등록되었습니다.')
    }
    catch (e) { console.error(e); alert(e.response?.data?.message || '서명 업로드에 실패했습니다.') }
    finally { setSignSaving(false) }
  }

  const handleSignDelete = async (id) => {
    if (!window.confirm('이 서명을 삭제할까요?')) return
    try { await deleteApprovalSign(id); await refreshAll() }
    catch (e) { console.error(e); alert(e.response?.data?.message || '서명 삭제에 실패했습니다.') }
  }

  const openDraftToCompose = async () => {
    if (!selectedApproval || selectedApproval.status !== 'DRAFT') return
    await editSelectedDraft()
  }

  const statusMeta = approvalStatusMeta[selectedApproval?.status] || approvalStatusMeta.DRAFT

  const folderCountMap = {
    'esignature-waiting': approvalBoxes.waiting.length,
    'esignature-completed': approvalBoxes.completed.length,
    'esignature-rejected': approvalBoxes.rejected.length,
    'esignature-my': approvalBoxes.my.length,
    'esignature-signature': 0,
  }

  const guessFileType = (url) => {
    if (!url) return 'unknown'
    const lower = url.toLowerCase()
    if (lower.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/)) return 'image'
    if (lower.match(/\.pdf(\?|$)/)) return 'pdf'
    return 'other'
  }

  return (
    <div className="esig">
      {actionModal && (
        <ActionModal
          type={actionModal}
          users={users}
          signatures={signatures}
          onConfirm={handleActionConfirm}
          onClose={() => setActionModal(null)}
          onGoToSignature={() => handleChangeFolder('esignature-signature')}
        />
      )}
      {/* Left Rail */}
      <aside className="esig-rail">
        <div className="esig-rail-header">
          <span className="esig-rail-title">전자결재</span>
          <button className="esig-icon-btn" onClick={refreshAll} disabled={refreshing} title="새로고침">
            <FiRefreshCw size={14} />
          </button>
        </div>

        <button className="esig-new-btn" onClick={resetComposer}>
          <FiPlus size={15} />
          새 결재
        </button>

        <nav className="esig-nav">
          {FOLDER_ORDER.map((folderId) => {
            const count = folderCountMap[folderId] || 0
            const active = currentSubPage === folderId && mode !== 'compose'
            return (
              <button
                key={folderId}
                className={`esig-nav-item ${active ? 'active' : ''}`}
                onClick={() => handleChangeFolder(folderId)}
              >
                <FiCheckSquare size={14} />
                <span className="esig-nav-label">{FOLDER_META[folderId].label}</span>
                {count > 0 && <span className="esig-nav-badge">{count}</span>}
              </button>
            )
          })}

          <div className="esig-nav-divider" />

          <button
            className={`esig-nav-item ${mode === 'signature' ? 'active' : ''}`}
            onClick={() => handleChangeFolder('esignature-signature')}
          >
            <FiPenTool size={14} />
            <span className="esig-nav-label">서명 관리</span>
            {signatures.length > 0 && <span className="esig-nav-dot" />}
          </button>
        </nav>
      </aside>

      {/* Main Body */}
      <div className="esig-body">
        {error && <div className="esig-error">{error}</div>}

        {mode === 'signature' ? (
          <SignaturePage
            signatures={signatures}
            signatureFile={signatureFile}
            setSignatureFile={setSignatureFile}
            signatureLabel={signatureLabel}
            setSignatureLabel={setSignatureLabel}
            signSaving={signSaving}
            onUpload={handleSignUpload}
            onDelete={handleSignDelete}
          />
        ) : mode === 'compose' ? (
          <>
            <div className="esig-header">
              <div className="esig-header-left">
                <button className="esig-back-btn" onClick={() => setMode('view')}>← 결재함</button>
                <h1 className="esig-page-title">{form.docId ? '결재문서 수정' : '새 결재문서'}</h1>
              </div>
              <div className="esig-header-actions">
                <button className="esig-btn esig-btn-ghost" onClick={() => persistApproval(false)} disabled={saveState !== 'idle'}>
                  <FiClock size={14} />
                  {saveState === 'saving' ? '저장 중...' : '임시저장'}
                </button>
                <button className="esig-btn esig-btn-primary" onClick={() => persistApproval(true)} disabled={saveState !== 'idle'}>
                  <FiSend size={14} />
                  {saveState === 'submitting' ? '상신 중...' : '기안 상신'}
                </button>
              </div>
            </div>

            <div className="esig-compose">
              <div className="esig-compose-form">
                <section className="esig-section">
                  <h2 className="esig-section-title">기본 정보</h2>
                  <div className="esig-grid">
                    <div className="esig-field esig-field-full">
                      <label>템플릿</label>
                      <select value={selectedTemplateId} onChange={(e) => {
                        setSelectedTemplateId(e.target.value)
                        const tmpl = templates.find((t) => String(t.id) === String(e.target.value))
                        if (tmpl) setForm((c) => ({ ...c, title: c.docId ? c.title : tmpl.title, summary: c.summary || tmpl.title }))
                      }}>
                        <option value="">템플릿 선택</option>
                        {templates.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                      </select>
                    </div>
                    <div className="esig-field esig-field-full">
                      <label>제목 *</label>
                      <input value={form.title} onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))} placeholder="결재 제목을 입력하세요" />
                    </div>
                    <div className="esig-field">
                      <label>기안 부서</label>
                      <input value={form.department} onChange={(e) => setForm((c) => ({ ...c, department: e.target.value }))} />
                    </div>
                    <div className="esig-field">
                      <label>기안자</label>
                      <input value={form.requester} onChange={(e) => setForm((c) => ({ ...c, requester: e.target.value }))} />
                    </div>
                    <div className="esig-field">
                      <label>보안등급</label>
                      <select value={form.securityLevel} onChange={(e) => setForm((c) => ({ ...c, securityLevel: e.target.value }))}>
                        <option value="일반문서">일반문서</option>
                        <option value="대외비">대외비</option>
                        <option value="기밀">기밀</option>
                      </select>
                    </div>
                    <div className="esig-field">
                      <label>보존연한</label>
                      <select value={form.retentionPeriod} onChange={(e) => setForm((c) => ({ ...c, retentionPeriod: e.target.value }))}>
                        <option value="영구">영구</option>
                        <option value="10년">10년</option>
                        <option value="5년">5년</option>
                        <option value="1년">1년</option>
                      </select>
                    </div>
                    <div className="esig-field">
                      <label>예산</label>
                      <input value={form.budget} onChange={(e) => setForm((c) => ({ ...c, budget: e.target.value }))} placeholder="예: 1,200,000" />
                    </div>
                    <div className="esig-field">
                      <label>기안일</label>
                      <input type="date" value={form.targetDate} onChange={(e) => setForm((c) => ({ ...c, targetDate: e.target.value }))} />
                    </div>
                  </div>
                </section>

                <section className="esig-section">
                  <h2 className="esig-section-title">문서 내용</h2>
                  <div className="esig-field-stack">
                    <div className="esig-field">
                      <label>상세 내용</label>
                      <textarea className="esig-textarea-lg" value={form.content} onChange={(e) => setForm((c) => ({ ...c, content: e.target.value }))} placeholder="결재 문서 본문을 입력하세요" />
                    </div>
                    <div className="esig-field">
                      <label>첨부파일</label>
                      <label className="esig-file-add-btn">
                        <FiPlus size={13} /> 파일 추가
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.hwp,.hwpx,.txt,image/*"
                          multiple
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const files = Array.from(e.target.files || [])
                            setAttachmentFiles((prev) => {
                              const names = new Set(prev.map((f) => f.name))
                              return [...prev, ...files.filter((f) => !names.has(f.name))]
                            })
                            e.target.value = ''
                          }}
                        />
                      </label>
                      {attachmentFiles.length > 0 && (
                        <ul className="esig-file-list">
                          {attachmentFiles.map((file, idx) => (
                            <li key={idx} className="esig-file-list-item">
                              <FiFileText size={13} />
                              <span className="esig-file-list-name">{file.name}</span>
                              <button
                                className="esig-icon-btn"
                                type="button"
                                onClick={() => setAttachmentFiles((prev) => prev.filter((_, i) => i !== idx))}
                              >
                                <FiX size={12} />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </section>
              </div>

              <div className="esig-compose-panel">
                <section className="esig-section">
                  <h2 className="esig-section-title">결재자 지정</h2>
                  <div className="esig-search-bar">
                    <FiSearch size={14} />
                    <input
                      type="text"
                      placeholder="이름, 사번, 부서 검색"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                    />
                    {userSearch && <button onClick={() => setUserSearch('')}><FiX size={12} /></button>}
                  </div>
                  <div className="esig-user-list">
                    {usersFiltered.length === 0
                      ? <p className="esig-empty-hint">검색 결과가 없습니다.</p>
                      : usersFiltered.map((user) => {
                          const alreadyAdded = approvalLines.some((l) => l.approverId === user.id)
                          const deptName = (user.departments || []).map((d) => d.scopeName).filter(Boolean).join(' / ')
                          return (
                            <div key={user.id} className="esig-user-row">
                              <div className="esig-user-info">
                                <strong>{user.name} {user.position || ''}</strong>
                                <span>{user.empNo}{deptName ? ` · ${deptName}` : ''}</span>
                              </div>
                              <button className={`esig-add-btn ${alreadyAdded ? 'added' : ''}`} onClick={() => addApprover(user)} disabled={alreadyAdded}>
                                {alreadyAdded ? <FiCheck size={13} /> : <FiUserPlus size={13} />}
                              </button>
                            </div>
                          )
                        })}
                  </div>
                </section>

                <section className="esig-section">
                  <div className="esig-section-header">
                    <h2 className="esig-section-title">현재 결재선</h2>
                    <button className="esig-text-btn" onClick={saveMyLinePreset} disabled={linePresetSaving}>
                      {linePresetSaving ? '저장 중...' : '즐겨찾기 저장'}
                    </button>
                  </div>
                  {approvalLines.length === 0
                    ? <p className="esig-empty-hint">결재선을 추가해주세요.</p>
                    : (
                      <div className="esig-line-list">
                        {approvalLines.map((line) => (
                          <div key={line.approverId} className="esig-line-row">
                            <span className="esig-line-order">{line.lineOrder}</span>
                            <div className="esig-user-info">
                              <strong>{line.approverName}</strong>
                              <span>{line.approverPosition || '직책 없음'}</span>
                            </div>
                            <select value={line.lineType} onChange={(e) => updateApproverLine(line.approverId, { lineType: e.target.value })}>
                              {LINE_TYPES.map((type) => <option key={type} value={type}>{lineTypeLabel[type]}</option>)}
                            </select>
                            <button className="esig-icon-btn esig-icon-btn-danger" onClick={() => removeApprover(line.approverId)}><FiTrash2 size={13} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                </section>

                {myLines.length > 0 && (
                  <section className="esig-section">
                    <h2 className="esig-section-title">즐겨찾는 결재선</h2>
                    <div className="esig-preset-list">
                      {myLines.map((preset) => (
                        <div key={preset.id} className="esig-preset-row">
                          <div className="esig-user-info">
                            <strong>{preset.name}</strong>
                            <span>{preset.items?.length || 0}명</span>
                          </div>
                          <div className="esig-preset-actions">
                            <button className="esig-text-btn" onClick={() => applyMyLinePreset(preset)}>적용</button>
                            <button className="esig-icon-btn esig-icon-btn-danger" onClick={() => removeMyLinePreset(preset.id)}><FiTrash2 size={13} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

              </div>
            </div>
          </>
        ) : selectedApproval ? (
          <>
            <div className="esig-header">
              <div className="esig-header-left">
                <button className="esig-back-btn" onClick={handleBackToList}>← 목록</button>
                <div>
                  <div className="esig-detail-title-row">
                    <h1 className="esig-page-title">{selectedApproval.title}</h1>
                    <span className="esig-status-chip" style={{ background: statusMeta.color }}>{statusMeta.label}</span>
                  </div>
                  <p className="esig-detail-meta">
                    기안자: {selectedApproval.drafterName} {selectedApproval.drafterPosition}
                    &nbsp;·&nbsp;{prettyDateTime(selectedApproval.createdAt)}
                    &nbsp;·&nbsp;#{selectedApproval.id}
                  </p>
                </div>
              </div>
              <div className="esig-header-actions">
                {canActOnSelected && (
                  <>
                    <button className="esig-btn esig-btn-primary" onClick={handleApprove} disabled={actionState === 'approve'}>
                      <FiCheck size={14} /> 승인
                    </button>
                    <button className="esig-btn esig-btn-danger" onClick={handleReject} disabled={actionState === 'reject'}>
                      <FiX size={14} /> 반려
                    </button>
                    <button className="esig-btn esig-btn-ghost" onClick={handleDelegate} disabled={actionState === 'delegate'}>
                      <FiUserPlus size={14} /> 대리결재
                    </button>
                  </>
                )}
                {canEditSelectedDraft && (
                  <button className="esig-btn esig-btn-ghost" onClick={openDraftToCompose}>
                    <FiFileText size={14} /> 수정하기
                  </button>
                )}
                {selectedApproval.finalPdfUrl && (
                  <a className="esig-btn esig-btn-ghost" href={selectedApproval.finalPdfUrl} target="_blank" rel="noreferrer">PDF</a>
                )}
              </div>
            </div>

            <div className="esig-detail">
              <div className="esig-detail-main">
                {/* Status Banner */}
                <div className="esig-status-banner">
                  <div
                    className="esig-status-banner-icon"
                    style={{ background: `${statusMeta.color}18`, color: statusMeta.color }}
                  >
                    <FiFileText size={20} />
                  </div>
                  <div className="esig-status-banner-text">
                    <p className="esig-status-banner-title">{selectedApproval.title}</p>
                    <p className="esig-status-banner-sub">
                      기안자 {selectedApproval.drafterName}
                      {selectedApproval.drafterPosition ? ` · ${selectedApproval.drafterPosition}` : ''}
                      {' · '}작성일 {prettyDate(selectedApproval.createdAt)}
                    </p>
                  </div>
                  <span className="esig-status-chip" style={{ background: statusMeta.color }}>{statusMeta.label}</span>
                </div>

                {/* 결재선 */}
                <div className="esig-card">
                  <div className="esig-card-head">
                    <span className="esig-card-head-title"><FiCheckSquare size={13} /> 결재선 진행</span>
                  </div>
                  <div className="esig-card-body">
                    {(selectedApproval.approvalLines || []).length === 0
                      ? <p className="esig-empty-hint">결재선 정보가 없습니다.</p>
                      : (
                        <div className="esig-timeline">
                          {selectedApproval.approvalLines
                            .slice()
                            .sort((a, b) => a.lineOrder - b.lineOrder)
                            .map((line) => {
                              const lmeta = lineStatusMeta[line.status] || lineStatusMeta.WAITING
                              return (
                                <div key={line.id} className="esig-timeline-item">
                                  <div className="esig-timeline-track">
                                    <div className="esig-timeline-dot" style={{ color: lmeta.color, background: lmeta.color }} />
                                  </div>
                                  <div className="esig-timeline-content">
                                    <div className="esig-timeline-name">
                                      <span>{line.lineOrder}. {line.approverName}{line.delegateeName ? ` → ${line.delegateeName}` : ''}</span>
                                      <span className="esig-status-chip esig-status-chip-sm" style={{ background: lmeta.color }}>{lmeta.label}</span>
                                    </div>
                                    <p className="esig-timeline-detail">
                                      {lineTypeLabel[line.lineType] || line.lineType} · {line.approverPosition || '직책 없음'}
                                      {line.comment ? ` · "${line.comment}"` : ''}
                                    </p>
                                  </div>
                                </div>
                              )
                            })}
                        </div>
                      )}
                  </div>
                </div>

                {/* 문서 템플릿 */}
                <div className="esig-doc-sheet">
                  <div className="esig-doc-sheet-header">
                    <strong>{selectedApproval.templateTitle || '기안서'}</strong>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>보존 {selectedApproval.retentionPeriod} · {selectedApproval.securityLevel}</span>
                      {selectedApproval.finalPdfUrl && (
                        <button
                          className="esig-btn esig-btn-ghost"
                          style={{ padding: '4px 10px', fontSize: '12px' }}
                          onClick={async () => {
                            try {
                              const res = await downloadApprovalPdf(selectedApproval.id)
                              const blob = new Blob([res.data], { type: 'application/pdf' })
                              const url = URL.createObjectURL(blob)
                              const a = document.createElement('a')
                              a.href = url
                              a.download = `APPR-${selectedApproval.id}.pdf`
                              a.click()
                              URL.revokeObjectURL(url)
                            } catch {
                              alert('PDF 다운로드에 실패했습니다. 결재 완료 후 다운로드 가능합니다.')
                            }
                          }}
                        >
                          <FiDownload size={13} /> PDF
                        </button>
                      )}
                    </div>
                  </div>
                  <iframe
                    className="esig-doc-iframe"
                    srcDoc={buildDocumentHtml(selectedApproval)}
                    title="결재문서"
                    sandbox="allow-same-origin"
                    onLoad={(e) => {
                      const doc = e.target.contentDocument
                      if (doc) e.target.style.height = doc.documentElement.scrollHeight + 'px'
                    }}
                  />

                  {/* 첨부파일 목록 */}
                  {(selectedApproval.attachments || []).length > 0 && (
                    <div className="esig-attach-list">
                      <div className="esig-attach-list-title">
                        <FiFileText size={13} /> 첨부파일 ({selectedApproval.attachments.length})
                      </div>
                      <div className="esig-attach-items">
                        {selectedApproval.attachments.map((att) => (
                          <button
                            key={att.id}
                            className={`esig-attach-item ${selectedAttachmentId === att.id ? 'active' : ''}`}
                            onClick={() => setSelectedAttachmentId(att.id)}
                            title={att.fileName}
                          >
                            <FiFileText size={13} />
                            <span className="esig-attach-item-name">{att.fileName}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="esig-detail-side">
                {(() => {
                  const attachments = selectedApproval.attachments || []
                  const currentAtt = attachments.find((a) => a.id === selectedAttachmentId) || attachments[0] || null
                  return (
                    <>
                      <div className="esig-viewer-header">
                        <h2 className="esig-section-title">
                          {currentAtt ? currentAtt.fileName : '첨부파일'}
                        </h2>
                        {currentAtt && (
                          <button
                            className="esig-btn esig-btn-ghost"
                            style={{ padding: '6px 12px', fontSize: '12px' }}
                            onClick={async () => {
                              try {
                                const res = await getApprovalAttachmentById(selectedApproval.id, currentAtt.id)
                                const blob = new Blob([res.data], { type: res.headers['content-type'] || 'application/octet-stream' })
                                const url = URL.createObjectURL(blob)
                                const a = document.createElement('a')
                                a.href = url
                                a.download = currentAtt.fileName || '첨부파일'
                                a.click()
                                URL.revokeObjectURL(url)
                              } catch {
                                alert('파일 다운로드에 실패했습니다.')
                              }
                            }}
                          >
                            <FiDownload size={13} /> 다운로드
                          </button>
                        )}
                      </div>
                      <div className="esig-viewer-body">
                        <AttachmentViewer
                          docId={selectedApproval.id}
                          attachmentId={currentAtt?.id ?? null}
                          fileName={currentAtt?.fileName ?? null}
                          attachmentUrl={null}
                        />
                      </div>
                    </>
                  )
                })()}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="esig-header">
              <div className="esig-header-left">
                <h1 className="esig-page-title">{currentFolder.label}</h1>
                <p className="esig-page-hint">{currentFolder.hint}</p>
              </div>
              <div className="esig-header-actions">
                <div className="esig-search-bar">
                  <FiSearch size={14} />
                  <input
                    type="text"
                    placeholder="제목, 작성자 검색"
                    value={activeListSearch}
                    onChange={(e) => setActiveListSearch(e.target.value)}
                  />
                  {activeListSearch && <button onClick={() => setActiveListSearch('')}><FiX size={12} /></button>}
                </div>
                <span className="esig-count-badge">{activeDocuments.length}건</span>
                <div className="esig-pagination">
                  <button className="esig-page-btn" onClick={() => setListPage((p) => Math.max(1, p - 1))} disabled={listPage === 1}>‹</button>
                  <span className="esig-page-info">{listPage} / {listTotalPages}</span>
                  <button className="esig-page-btn" onClick={() => setListPage((p) => Math.min(listTotalPages, p + 1))} disabled={listPage === listTotalPages}>›</button>
                </div>
              </div>
            </div>

            <div className="esig-table-wrap">
              {loading ? (
                <table className="esig-table">
                  <thead><tr><th>상태</th><th>제목</th><th>작성자</th><th>기안번호</th><th>작성일</th></tr></thead>
                  <tbody>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="esig-skeleton-row">
                        <td><div className="esig-skeleton" style={{ width: 56, height: 22, borderRadius: 12 }} /></td>
                        <td><div className="esig-skeleton" style={{ width: '60%', height: 16 }} /></td>
                        <td><div className="esig-skeleton" style={{ width: 60, height: 16 }} /></td>
                        <td><div className="esig-skeleton" style={{ width: 40, height: 16 }} /></td>
                        <td><div className="esig-skeleton" style={{ width: 80, height: 16 }} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : activeDocuments.length === 0
                ? (
                  <div className="esig-empty">
                    <FiFileText size={40} />
                    <p>결재 문서가 없습니다.</p>
                  </div>
                ) : (
                  <>
                    <table className="esig-table">
                      <thead>
                        <tr>
                          <th>상태</th>
                          <th>제목</th>
                          <th>작성자</th>
                          <th>기안번호</th>
                          <th>작성일</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedDocuments.map((doc) => {
                          const meta = approvalStatusMeta[doc.status] || approvalStatusMeta.DRAFT
                          return (
                            <tr
                              key={doc.id}
                              onClick={() => openApproval(doc.id)}
                              className={selectedApprovalId === doc.id ? 'active' : ''}
                              role="button"
                              tabIndex={0}
                            >
                              <td>
                                <span className="esig-status-chip" style={{ background: meta.color }}>{meta.label}</span>
                              </td>
                              <td>
                                <div className="esig-table-title">
                                  <strong>{doc.title}</strong>
                                  {doc.templateTitle && <span>{doc.templateTitle}</span>}
                                </div>
                              </td>
                              <td>{doc.drafterName || '-'}</td>
                              <td className="esig-table-id">#{doc.id}</td>
                              <td>{prettyDate(doc.createdAt)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </>
                )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
