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

export const markChatRoomAsRead = async roomId => {
  const response = await api.post(`/chat/rooms/${roomId}/read`)
  return unwrap(response)
}

export const leaveChatRoom = async roomId => {
  const response = await api.post(`/chat/rooms/${roomId}/leave`)
  return unwrap(response)
}

export const inviteChatMembers = async (roomId, empNos) => {
  const response = await api.post(`/chat/rooms/${roomId}/invite`, { empNos })
  return unwrap(response)
}

export const getChatMemberCandidates = async () => {
  const endpoints = [
    '/mail/recipients',
    '/mail/users',
    '/organization/members',
    '/users',
    '/organization/users',
    '/admin/users',
  ]

  for (const endpoint of endpoints) {
    try {
      const response = await api.get(endpoint)
      const data = unwrap(response)
      if (Array.isArray(data)) return data
      if (Array.isArray(data?.content)) return data.content
      if (Array.isArray(data?.users)) return data.users
    } catch (error) {
      if (error.response?.status !== 404) {
        console.warn(`채팅 인원 목록 조회 실패: ${endpoint}`, error)
      }
    }
  }

  return []
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
