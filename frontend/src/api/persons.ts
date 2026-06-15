import api from './axios';
import type { Person } from '../types';

export const getPersons = async (tenant: string, params?: { page?: number; limit?: number; search?: string }) => {
  const res = await api.get(`/${tenant}/persons`, { params });
  return res.data.data as { data: Person[]; total: number; page: number; pages: number };
};

export const getPerson = async (tenant: string, id: number) => {
  const res = await api.get(`/${tenant}/persons/${id}`);
  return res.data.data as Person;
};

export const createPerson = async (tenant: string, data: Partial<Person>) => {
  const res = await api.post(`/${tenant}/persons`, data);
  return res.data.data as Person;
};

export const updatePerson = async (tenant: string, id: number, data: Partial<Person>) => {
  const res = await api.put(`/${tenant}/persons/${id}`, data);
  return res.data.data as Person;
};

export const deletePerson = async (tenant: string, id: number) => {
  const res = await api.delete(`/${tenant}/persons/${id}`);
  return res.data;
};

export const importPersons = async (tenant: string, persons: Partial<Person>[]) => {
  const res = await api.post(`/${tenant}/persons/import`, { persons });
  return res.data.data as { imported: number; skipped: number; errors: string[] };
};
