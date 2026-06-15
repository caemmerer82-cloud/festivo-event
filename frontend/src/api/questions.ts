import api from './axios';
import type { Question } from '../types';

export const getQuestions = async (tenant: string, eventId: number) => {
  const res = await api.get(`/${tenant}/events/${eventId}/questions`);
  return res.data.data as Question[];
};

export const createQuestion = async (tenant: string, eventId: number, data: Partial<Question>) => {
  const res = await api.post(`/${tenant}/events/${eventId}/questions`, data);
  return res.data.data as Question;
};

export const updateQuestion = async (tenant: string, eventId: number, id: number, data: Partial<Question>) => {
  const res = await api.put(`/${tenant}/events/${eventId}/questions/${id}`, data);
  return res.data.data as Question;
};

export const deleteQuestion = async (tenant: string, eventId: number, id: number) => {
  const res = await api.delete(`/${tenant}/events/${eventId}/questions/${id}`);
  return res.data;
};

export const reorderQuestions = async (tenant: string, eventId: number, order: { id: number; sort_order: number }[]) => {
  const res = await api.post(`/${tenant}/events/${eventId}/questions/reorder`, { order });
  return res.data;
};
