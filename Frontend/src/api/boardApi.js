import api from './axios'

export const getBoardPosts = (type) =>
  api.get('/board', { params: type ? { type } : {} })

export const createBoardPost = (data) =>
  api.post('/board', data)

export const updateBoardPost = (id, data) =>
  api.put(`/board/${id}`, data)

export const deleteBoardPost = (id) =>
  api.delete(`/board/${id}`)

export const incrementBoardViews = (id) =>
  api.post(`/board/${id}/views`)

export const uploadBoardAttachment = (postId, file) => {
  const form = new FormData()
  form.append('file', file)
  return api.post(`/board/${postId}/attachments`, form)
}

export const downloadBoardAttachment = (attachmentId) =>
  api.get(`/board/attachments/${attachmentId}/download`, { responseType: 'blob' })

export const deleteBoardAttachment = (attachmentId) =>
  api.delete(`/board/attachments/${attachmentId}`)
