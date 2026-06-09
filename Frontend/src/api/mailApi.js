import api from './axios';

export const sendMail = (payload) => {
  const formData = new FormData();
  formData.append(
    'data',
    new Blob([JSON.stringify(payload)], { type: 'application/json' })
  );

  return api.post('/mail', formData, {
    headers: { 'Content-Type': undefined },
  });
};

export const saveMailDraft = (payload) => api.post('/mail/draft', payload);

export const updateMailDraft = (mailId, payload) => api.put(`/mail/${mailId}/draft`, payload);

export const sendMailDraft = (mailId) => api.post(`/mail/${mailId}/send`);

export const uploadMailFile = (mailId, file) => {
  const formData = new FormData();
  formData.append('mailId', mailId);
  formData.append('file', file);

  return api.post('/mail/files', formData, {
    headers: { 'Content-Type': undefined },
  });
};

export const downloadMailFile = (attachmentId) => api.get(`/mail/files/${attachmentId}`, {
  responseType: 'blob',
});

const pageParams = (page = 0, size = 15) => ({ params: { page, size } });

export const getInboxMails = (page, size) => api.get('/mail/inbox', pageParams(page, size));

export const getSentMails = (page, size) => api.get('/mail/sent', pageParams(page, size));

export const getDraftMails = (page, size) => api.get('/mail/draft', pageParams(page, size));

export const getMailDetail = (mailId) => api.get(`/mail/${mailId}`);

export const deleteInboxMail = (mailId) => api.delete(`/mail/${mailId}/inbox`);

export const deleteSentMail = (mailId) => api.delete(`/mail/${mailId}/sent`);

export const deleteDraftMail = (mailId) => api.delete(`/mail/${mailId}/draft`);

export const cancelMail = (mailId) => api.post(`/mail/${mailId}/cancel`);

export const getMailReadStatus = (mailId) => api.get(`/mail/${mailId}/read-status`);

export const toggleInboxFavorite = (mailId) => api.post(`/mail/${mailId}/favorite/inbox`);

export const toggleSentFavorite = (mailId) => api.post(`/mail/${mailId}/favorite/sent`);

export const getFavoriteMails = (page, size) => api.get('/mail/favorites', pageParams(page, size));

export const getInboxTrashMails = (page, size) => api.get('/mail/trash/inbox', pageParams(page, size));

export const getSentTrashMails = (page, size) => api.get('/mail/trash/sent', pageParams(page, size));

export const restoreInboxMail = (mailId) => api.post(`/mail/${mailId}/restore/inbox`);

export const restoreSentMail = (mailId) => api.post(`/mail/${mailId}/restore/sent`);

export const permanentDeleteInboxTrashMail = (mailId) => api.delete(`/mail/trash/inbox/${mailId}`);

export const permanentDeleteSentTrashMail = (mailId) => api.delete(`/mail/trash/sent/${mailId}`);
