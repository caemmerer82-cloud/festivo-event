import api from './axios';
import type { Tenant } from '../types';

export const getTenants = async () => {
  const res = await api.get('/system/tenants');
  return res.data.data as Tenant[];
};

export const getTenant = async (id: number) => {
  const res = await api.get(`/system/tenants/${id}`);
  return res.data.data as Tenant;
};

export const createTenant = async (data: {
  name: string;
  slug: string;
  admin_username: string;
  admin_email: string;
  admin_password: string;
}) => {
  const res = await api.post('/system/tenants', data);
  return res.data.data as Tenant;
};

export const updateTenant = async (id: number, data: { name?: string; is_active?: boolean }) => {
  const res = await api.put(`/system/tenants/${id}`, data);
  return res.data.data as Tenant;
};

export const deleteTenant = async (id: number) => {
  const res = await api.delete(`/system/tenants/${id}`);
  return res.data;
};

export const resetTenantAdminPassword = async (id: number, newPassword: string) => {
  const res = await api.post(`/system/tenants/${id}/reset-password`, { new_password: newPassword });
  return res.data;
};
