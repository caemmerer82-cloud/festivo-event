import api from './axios';

export const getTexts = async (tenant: string, eventId: number): Promise<Record<string, string>> => {
  const res = await api.get(`/${tenant}/events/${eventId}/texts`);
  return res.data.data as Record<string, string>;
};

export const saveTexts = async (tenant: string, eventId: number, texts: Record<string, string>): Promise<void> => {
  await api.post(`/${tenant}/events/${eventId}/texts`, texts);
};
