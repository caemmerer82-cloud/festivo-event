import api from './axios';
import type { Event } from '../types';

export const getEvents = async (tenant: string, page = 1, limit = 20) => {
  const res = await api.get(`/${tenant}/events`, { params: { page, limit } });
  return res.data.data as { data: Event[]; total: number; page: number; pages: number };
};

export const getEvent = async (tenant: string, id: number) => {
  const res = await api.get(`/${tenant}/events/${id}`);
  return res.data.data as Event;
};

export const createEvent = async (tenant: string, formData: FormData) => {
  const res = await api.post(`/${tenant}/events`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.data as Event;
};

export const updateEvent = async (tenant: string, id: number, formData: FormData) => {
  // PUT requests don't populate $_FILES in PHP — send POST with _method=PUT override
  formData.append('_method', 'PUT');
  const res = await api.post(`/${tenant}/events/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.data as Event;
};

export const deleteEvent = async (tenant: string, id: number) => {
  const res = await api.delete(`/${tenant}/events/${id}`);
  return res.data;
};
