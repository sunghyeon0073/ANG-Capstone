import api from './axios'

export const getApprovalTemplates = (category) =>
  api.get('/approvals/templates', { params: category ? { category } : {} })

export const getApprovalTemplate = (id) => api.get(`/approvals/templates/${id}`)

export const getPendingInbox = (params = {}) => api.get('/approvals/inbox/pending', { params })

export const getCompletedInbox = (params = {}) => api.get('/approvals/inbox/completed', { params })

export const getRejectedInbox = (params = {}) => api.get('/approvals/inbox/rejected', { params })

export const getProgressOutbox = (params = {}) => api.get('/approvals/outbox/progress', { params })

export const getCompletedOutbox = (params = {}) => api.get('/approvals/outbox/completed', { params })

export const getDraftOutbox = (params = {}) => api.get('/approvals/outbox/draft', { params })

export const getRejectedOutbox = (params = {}) => api.get('/approvals/outbox/rejected', { params })

export const getReceivedInbox = (params = {}) => api.get('/approvals/inbox/received', { params })

export const searchApprovals = (params = {}) => api.get('/approvals/search', { params })

export const createApprovalDoc = (payload) => api.post('/approvals/documents', payload)

export const getApprovalDoc = (id) => api.get(`/approvals/documents/${id}`)

export const updateApprovalDoc = (id, payload) => api.put(`/approvals/documents/${id}`, payload)

export const cancelApprovalDoc = (id) => api.delete(`/approvals/documents/${id}`)

export const getApprovalAttachment = (id) =>
  api.get(`/approvals/documents/${id}/attachment`, { responseType: 'arraybuffer' })

export const downloadApprovalPdf = (id) =>
  api.get(`/approvals/documents/${id}/pdf/download`, { responseType: 'arraybuffer' })

export const uploadApprovalAttachment = (id, file) => {
  const formData = new FormData()
  formData.append('file', file)
  return api.post(`/approvals/documents/${id}/attachment`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export const approveApprovalDoc = (id, payload = {}) => api.post(`/approvals/documents/${id}/approve`, payload)

export const rejectApprovalDoc = (id, payload) => api.post(`/approvals/documents/${id}/reject`, payload)

export const delegateApprovalDoc = (id, payload) => api.post(`/approvals/documents/${id}/delegate`, payload)

export const getApprovalSign = () => api.get('/approvals/sign')

export const getApprovalSignImage = () =>
  api.get('/approvals/sign/image', { responseType: 'arraybuffer' })

export const uploadApprovalSign = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return api.post('/approvals/sign', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export const deleteApprovalSign = () => api.delete('/approvals/sign')

export const getMyApprovalLines = () => api.get('/approvals/my-lines')

export const createMyApprovalLine = (payload) => api.post('/approvals/my-lines', payload)

export const deleteMyApprovalLine = (id) => api.delete(`/approvals/my-lines/${id}`)
