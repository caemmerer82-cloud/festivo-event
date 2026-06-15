import api from './axios';
import type { RsvpInvitation } from '../types';

export const getInvitation = async (token: string) => {
  const res = await api.get(`/rsvp/${token}`);
  return res.data.data as RsvpInvitation;
};

export const submitRsvp = async (token: string, attending: boolean, answers: Record<number, string | string[]>) => {
  const res = await api.post(`/rsvp/${token}`, { attending, answers });
  return res.data as { success: boolean; message: string; data: { status: string } };
};

export const getAttachmentUrl = (token: string) => `/api/rsvp/${token}/attachment`;
