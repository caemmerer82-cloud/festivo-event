import api from './axios';
import type { TenantUser } from '../types';

export const getUsers = async (tenant: string) => {
  const res = await api.get(`/${tenant}/users`);
  return res.data.data as TenantUser[];
};

export const createUser = async (tenant: string, data: Partial<TenantUser> & { password: string }) => {
  const res = await api.post(`/${tenant}/users`, data);
  return res.data.data as TenantUser;
};

export const updateUser = async (tenant: string, id: number, data: Partial<TenantUser> & { password?: string }) => {
  const res = await api.put(`/${tenant}/users/${id}`, data);
  return res.data.data as TenantUser;
};

export const deleteUser = async (tenant: string, id: number) => {
  const res = await api.delete(`/${tenant}/users/${id}`);
  return res.data;
};

export async function changePassword(tenant: string, currentPassword: string, newPassword: string) {
  const res = await api.post(`/${tenant}/users/change-password`, {
    current_password: currentPassword,
    new_password: newPassword,
  });
  return res.data;
}

export async function updateTenantProfile(tenant: string, name: string) {
  const res = await api.put(`/${tenant}/tenant/profile`, { name });
  return res.data;
}
