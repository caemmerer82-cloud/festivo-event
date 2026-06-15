import api from './axios';
import type { SmtpConfig } from '../types';

export const getSmtpConfig = async (tenant: string) => {
  const res = await api.get(`/${tenant}/smtp`);
  return res.data.data as SmtpConfig | null;
};

export const saveSmtpConfig = async (tenant: string, data: SmtpConfig & { password?: string }) => {
  const res = await api.post(`/${tenant}/smtp`, data);
  return res.data.data as SmtpConfig;
};

export const testSmtpConfig = async (tenant: string, testEmail: string) => {
  const res = await api.post(`/${tenant}/smtp/test`, { test_email: testEmail });
  return res.data;
};

export const deleteSmtpConfig = async (tenant: string) => {
  const res = await api.delete(`/${tenant}/smtp`);
  return res.data;
};
