import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import Modal from '../../components/Modal';
import ConfirmDialog from '../../components/ConfirmDialog';
import FormField from '../../components/FormField';
import { getUsers, createUser, updateUser, deleteUser } from '../../api/users';
import type { TenantUser } from '../../types';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { PlusIcon, PencilIcon, TrashIcon, UsersIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';

type UserForm = {
  username: string;
  email: string;
  password: string;
  is_admin: boolean;
  perm_create_users: boolean;
  perm_create_persons: boolean;
  perm_create_events: boolean;
  perm_set_status: boolean;
  perm_create_mails: boolean;
  perm_send_mails: boolean;
  perm_create_rsvp: boolean;
  perm_edit_rsvp: boolean;
};

const PERMISSIONS = [
  { key: 'perm_create_users', label: 'Benutzer verwalten' },
  { key: 'perm_create_persons', label: 'Personen verwalten' },
  { key: 'perm_create_events', label: 'Veranstaltungen verwalten' },
  { key: 'perm_set_status', label: 'Status setzen' },
  { key: 'perm_create_mails', label: 'E-Mail-Vorlagen erstellen' },
  { key: 'perm_send_mails', label: 'E-Mails senden' },
  { key: 'perm_create_rsvp', label: 'RSVP-Fragen erstellen' },
  { key: 'perm_edit_rsvp', label: 'RSVP-Fragen bearbeiten' },
] as const;

export default function UsersPage() {
  const { tenant } = useParams<{ tenant: string }>();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState<TenantUser | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const canManage = currentUser?.is_admin || currentUser?.permissions?.create_users;
  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<UserForm>();
  const isAdmin = watch('is_admin');

  const load = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      const data = await getUsers(tenant);
      setUsers(data);
    } finally {
      setLoading(false);
    }
  }, [tenant]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditUser(null);
    reset({ is_admin: false });
    setShowForm(true);
  };

  const openEdit = (u: TenantUser) => {
    setEditUser(u);
    reset({
      username: u.username,
      email: u.email,
      password: '',
      is_admin: u.is_admin,
      perm_create_users: u.perm_create_users,
      perm_create_persons: u.perm_create_persons,
      perm_create_events: u.perm_create_events,
      perm_set_status: u.perm_set_status,
      perm_create_mails: u.perm_create_mails,
      perm_send_mails: u.perm_send_mails,
      perm_create_rsvp: u.perm_create_rsvp,
      perm_edit_rsvp: u.perm_edit_rsvp,
    });
    setShowForm(true);
  };

  const onSubmit = async (data: UserForm) => {
    if (!tenant) return;
    try {
      if (editUser) {
        await updateUser(tenant, editUser.id, data);
        toast.success('Benutzer aktualisiert');
      } else {
        await createUser(tenant, data);
        toast.success('Benutzer erstellt');
      }
      setShowForm(false);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Fehler');
    }
  };

  const handleDelete = async () => {
    if (!tenant || !deletingId) return;
    try {
      await deleteUser(tenant, deletingId);
      toast.success('Benutzer gelöscht');
      setDeletingId(null);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Fehler');
    }
  };

  return (
    <Layout
      title="Benutzer"
      actions={canManage ? (
        <button onClick={openCreate} className="btn-primary">
          <PlusIcon className="h-4 w-4" />
          Neuer Benutzer
        </button>
      ) : undefined}
    >
      <div className="card p-0">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin h-8 w-8 border-b-2 border-primary-600 rounded-full" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12">
            <UsersIcon className="h-10 w-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500">Keine Benutzer vorhanden</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-6 py-3 text-left font-medium text-gray-500">Benutzer</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">Rolle</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">Berechtigungen</th>
                {canManage && <th className="w-20 px-6 py-3"></th>}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-6 py-3">
                    <p className="font-medium text-gray-900">{u.username}</p>
                    <p className="text-xs text-gray-500">{u.email}</p>
                  </td>
                  <td className="px-6 py-3">
                    <span className={`badge ${u.is_admin ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600'}`}>
                      {u.is_admin ? 'Administrator' : 'Benutzer'}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    {u.is_admin ? (
                      <span className="text-sm text-gray-500">Alle Berechtigungen</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {PERMISSIONS.filter(p => u[p.key]).map(p => (
                          <span key={p.key} className="badge bg-blue-50 text-blue-700 text-xs">{p.label}</span>
                        ))}
                        {!PERMISSIONS.some(p => u[p.key]) && (
                          <span className="text-sm text-gray-400">Keine</span>
                        )}
                      </div>
                    )}
                  </td>
                  {canManage && (
                    <td className="px-6 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(u)} className="p-1.5 rounded text-gray-400 hover:text-primary-600 hover:bg-primary-50">
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        {u.id !== currentUser?.sub && (
                          <button onClick={() => setDeletingId(u.id)} className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50">
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Form Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editUser ? 'Benutzer bearbeiten' : 'Neuer Benutzer'}
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Benutzername" required error={errors.username?.message}>
              <input
                {...register('username', { required: editUser ? false : 'Pflichtfeld' })}
                className="input"
                disabled={!!editUser}
              />
            </FormField>
            <FormField label="E-Mail" required error={errors.email?.message}>
              <input {...register('email', { required: 'Pflichtfeld' })} type="email" className="input" />
            </FormField>
          </div>
          <FormField label={editUser ? 'Neues Passwort (leer lassen = unverändert)' : 'Passwort'} required={!editUser} error={errors.password?.message}>
            <input
              {...register('password', { required: editUser ? false : 'Pflichtfeld', minLength: { value: 8, message: '8 Zeichen min.' } })}
              type="password"
              className="input"
            />
          </FormField>
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input {...register('is_admin')} type="checkbox" className="rounded border-gray-300 text-primary-600" />
              <span className="text-sm font-medium text-gray-700">Administrator (alle Berechtigungen)</span>
            </label>
          </div>
          {!isAdmin && (
            <div>
              <p className="label mb-2">Berechtigungen</p>
              <div className="grid grid-cols-2 gap-2">
                {PERMISSIONS.map(p => (
                  <label key={p.key} className="flex items-center gap-2 cursor-pointer">
                    <input {...register(p.key)} type="checkbox" className="rounded border-gray-300 text-primary-600" />
                    <span className="text-sm text-gray-700">{p.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Abbrechen</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary">
              {isSubmitting ? 'Wird gespeichert...' : editUser ? 'Aktualisieren' : 'Erstellen'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        title="Benutzer löschen"
        message="Diesen Benutzer unwiderruflich löschen?"
      />
    </Layout>
  );
}
