import api from './axios';

export const sendMail = (mailData) => api.post('/mail', mailData);

export const saveMailDraft = (mailData) => api.post('/mail/draft', mailData);

export const getInboxMails = () => api.get('/mail/inbox');

export const getSentMails = () => api.get('/mail/sent');

export const getDraftMails = () => api.get('/mail/draft');

export const getMailDetail = (mailId) => api.get(`/mail/${mailId}`);

export const deleteInboxMail = (mailId) => api.delete(`/mail/${mailId}/inbox`);

export const deleteSentMail = (mailId) => api.delete(`/mail/${mailId}/sent`);

export const cancelMail = (mailId) => api.post(`/mail/${mailId}/cancel`);

export const getMailReadStatus = (mailId) => api.get(`/mail/${mailId}/read-status`);
