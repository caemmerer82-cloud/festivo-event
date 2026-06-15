import api from './axios';
import type { MailTemplate, MailLogEntry } from '../types';

export const getTemplates = async (tenant: string) => {
  const res = await api.get(`/${tenant}/mail-templates`);
  return res.data.data as MailTemplate[];
};

export const getTemplate = async (tenant: string, id: number) => {
  const res = await api.get(`/${tenant}/mail-templates/${id}`);
  return res.data.data as MailTemplate;
};

export const createTemplate = async (tenant: string, data: Partial<MailTemplate>) => {
  const res = await api.post(`/${tenant}/mail-templates`, data);
  return res.data.data as MailTemplate;
};

export const updateTemplate = async (tenant: string, id: number, data: Partial<MailTemplate>) => {
  const res = await api.put(`/${tenant}/mail-templates/${id}`, data);
  return res.data.data as MailTemplate;
};

export const deleteTemplate = async (tenant: string, id: number) => {
  const res = await api.delete(`/${tenant}/mail-templates/${id}`);
  return res.data;
};

export const sendMails = async (
  tenant: string,
  templateId: number,
  guestIds: number[],
  eventId?: number
) => {
  const res = await api.post(`/${tenant}/mails/send`, {
    template_id: templateId,
    guest_ids: guestIds,
    event_id: eventId,
  });
  return res.data.data as { sent: number; failed: number; errors: string[] };
};

export const getMailLog = async (tenant: string, params?: { page?: number; limit?: number }) => {
  const res = await api.get(`/${tenant}/mail-log`, { params });
  return res.data.data as { data: MailLogEntry[]; total: number; page: number };
};
