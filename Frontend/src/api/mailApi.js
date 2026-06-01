import api from './axios';

export const sendMail = (payload) => api.post('/mail', payload);

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

export const getInboxMails = () => api.get('/mail/inbox');

export const getSentMails = () => api.get('/mail/sent');

export const getDraftMails = () => api.get('/mail/draft');

export const getMailDetail = (mailId) => api.get(`/mail/${mailId}`);

export const deleteInboxMail = (mailId) => api.delete(`/mail/${mailId}/inbox`);

export const deleteSentMail = (mailId) => api.delete(`/mail/${mailId}/sent`);

export const deleteDraftMail = (mailId) => api.delete(`/mail/${mailId}/draft`);

export const cancelMail = (mailId) => api.post(`/mail/${mailId}/cancel`);

export const getMailReadStatus = (mailId) => api.get(`/mail/${mailId}/read-status`);

export const toggleInboxFavorite = (mailId) => api.post(`/mail/${mailId}/favorite/inbox`);

export const toggleSentFavorite = (mailId) => api.post(`/mail/${mailId}/favorite/sent`);

export const getFavoriteMails = () => api.get('/mail/favorites');

export const getInboxTrashMails = () => api.get('/mail/trash/inbox');

export const getSentTrashMails = () => api.get('/mail/trash/sent');

export const restoreInboxMail = (mailId) => api.post(`/mail/${mailId}/restore/inbox`);

export const restoreSentMail = (mailId) => api.post(`/mail/${mailId}/restore/sent`);

export const permanentDeleteInboxTrashMail = (mailId) => api.delete(`/mail/trash/inbox/${mailId}`);

export const permanentDeleteSentTrashMail = (mailId) => api.delete(`/mail/trash/sent/${mailId}`);
