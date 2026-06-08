import api from './axios'

const unwrap = response => response.data?.data ?? response.data

const unwrapList = response => {
  const data = unwrap(response)
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.content)) return data.content
  if (Array.isArray(data?.items)) return data.items
  if (Array.isArray(data?.list)) return data.list
  if (Array.isArray(data?.data)) return data.data
  return []
}

export const getChatRooms = async () => {
  const response = await api.get('/chat/rooms')
  return unwrapList(response)
}

export const createPrivateChatRoom = async recipientEmpNo => {
  const response = await api.post('/chat/rooms/private', { recipientEmpNo })
  return unwrap(response)
}

export const createGroupChatRoom = async ({ name, memberEmpNos }) => {
  const response = await api.post('/chat/rooms/group', { name, memberEmpNos })
  return unwrap(response)
}

export const getChatMessages = async (roomId, page = 0, size = 30) => {
  const response = await api.get(`/chat/rooms/${roomId}/messages`, {
    params: { page, size },
  })
  return unwrapList(response)
}

export const getChatRoomMembers = async roomId => {
  const response = await api.get(`/chat/rooms/${roomId}/members`)
  return unwrapList(response)
}

export const markChatRoomAsRead = async roomId => {
  const response = await api.post(`/chat/rooms/${roomId}/read`)
  return unwrap(response)
}

export const leaveChatRoom = async roomId => {
  const response = await api.post(`/chat/rooms/${roomId}/leave`)
  return unwrap(response)
}

export const inviteChatMembers = async (roomId, empNos, name = '') => {
  const response = await api.post(`/chat/rooms/${roomId}/invite`, {
    empNos,
    name: name.trim() || null,
  })
  return unwrap(response)
}

export const updateChatRoomName = async (roomId, name) => {
  const response = await api.patch(`/chat/rooms/${roomId}/name`, {
    name: name?.trim() || null,
  })
  return unwrap(response)
}

export const getChatMemberCandidates = async () => {
  const response = await api.get('/users')
  return unwrapList(response)
}

export const uploadChatFile = async (roomId, file) => {
  const formData = new FormData()
  formData.append('roomId', roomId)
  formData.append('file', file)

  const response = await api.post('/chat/files', formData)
  return unwrap(response)
}

export const downloadChatFile = async key => {
  const response = await api.get('/chat/files', {
    params: { key },
    responseType: 'blob',
  })
  return response
}
