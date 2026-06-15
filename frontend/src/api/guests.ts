import api from './axios';
import type { EventGuest, GuestStats, GuestStatus } from '../types';

export const getGuests = async (tenant: string, eventId: number, params?: { search?: string; status?: string }) => {
  const res = await api.get(`/${tenant}/events/${eventId}/guests`, { params });
  return res.data.data as EventGuest[];
};

export const addGuests = async (tenant: string, eventId: number, personIds: number[]) => {
  const res = await api.post(`/${tenant}/events/${eventId}/guests`, { person_ids: personIds });
  return res.data.data as { added: number; skipped: number };
};

export const removeGuest = async (tenant: string, eventId: number, guestId: number) => {
  const res = await api.delete(`/${tenant}/events/${eventId}/guests/${guestId}`);
  return res.data;
};

export const updateGuestStatus = async (tenant: string, eventId: number, guestId: number, status: GuestStatus) => {
  const res = await api.put(`/${tenant}/events/${eventId}/guests/${guestId}/status`, { status });
  return res.data;
};

export const generateTokens = async (tenant: string, eventId: number, guestIds: number[]) => {
  const res = await api.post(`/${tenant}/events/${eventId}/guests/generate-tokens`, { guest_ids: guestIds });
  return res.data.data as { updated: number };
};

export const getGuestStats = async (tenant: string, eventId: number) => {
  const res = await api.get(`/${tenant}/events/${eventId}/guests/stats`);
  return res.data.data as GuestStats;
};

export const getGuestAnswers = async (tenant: string, eventId: number, guestId: number) => {
  const res = await api.get(`/${tenant}/events/${eventId}/guests/${guestId}/answers`);
  return res.data.data as any[];
};
