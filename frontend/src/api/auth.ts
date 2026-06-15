import api from './axios';

export const loginTenant = async (tenantSlug: string, username: string, password: string) => {
  const res = await api.post(`/${tenantSlug}/auth/login`, { username, password });
  return res.data;
};

export const loginSystem = async (username: string, password: string) => {
  const res = await api.post('/auth/system-login', { username, password });
  return res.data;
};

export const logout = async (tenantSlug?: string) => {
  if (tenantSlug) {
    await api.post(`/${tenantSlug}/auth/logout`);
  }
};
