import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getTenants, createTenant, updateTenant, deleteTenant, resetTenantAdminPassword } from '../../api/system';
import type { Tenant } from '../../types';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import Modal from '../../components/Modal';
import ConfirmDialog from '../../components/ConfirmDialog';
import FormField from '../../components/FormField';
import {
  PlusIcon, PencilIcon, TrashIcon, KeyIcon, CalendarIcon,
  UsersIcon, ArrowRightOnRectangleIcon, BuildingOfficeIcon,
} from '@heroicons/react/24/outline';

interface CreateTenantForm {
  name: string;
  slug: string;
  admin_username: string;
  admin_email: string;
  admin_password: string;
}

interface ResetPasswordForm {
  new_password: string;
  confirm_password: string;
}

export default function SystemDashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editTenant, setEditTenant] = useState<Tenant | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [resetPasswordTenant, setResetPasswordTenant] = useState<Tenant | null>(null);

  const createForm = useForm<CreateTenantForm>();
  const resetForm = useForm<ResetPasswordForm>();

  const load = async () => {
    try {
      const data = await getTenants();
      setTenants(data);
    } catch {
      toast.error('Fehler beim Laden der Mandanten');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (data: CreateTenantForm) => {
    try {
      await createTenant(data);
      toast.success('Mandant erstellt');
      setShowCreate(false);
      createForm.reset();
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Fehler');
    }
  };

  const handleToggleActive = async (tenant: Tenant) => {
    try {
      await updateTenant(tenant.id, { is_active: !tenant.is_active });
      toast.success(tenant.is_active ? 'Mandant deaktiviert' : 'Mandant aktiviert');
      load();
    } catch {
      toast.error('Fehler beim Aktualisieren');
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteTenant(deletingId);
      toast.success('Mandant gelöscht');
      setDeletingId(null);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Fehler');
    }
  };

  const handleResetPassword = async (data: ResetPasswordForm) => {
    if (!resetPasswordTenant) return;
    if (data.new_password !== data.confirm_password) {
      resetForm.setError('confirm_password', { message: 'Passwörter stimmen nicht überein' });
      return;
    }
    try {
      await resetTenantAdminPassword(resetPasswordTenant.id, data.new_password);
      toast.success('Passwort zurückgesetzt');
      setResetPasswordTenant(null);
      resetForm.reset();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Fehler');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-primary-950 text-white px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary-400 rounded-lg flex items-center justify-center">
            <CalendarIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="font-semibold">Event Manager</h1>
            <p className="text-primary-300 text-xs">Systemadministration</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-primary-300 text-sm">{user?.username}</span>
          <button
            onClick={logout}
            className="flex items-center gap-2 text-primary-200 hover:text-white text-sm transition-colors"
          >
            <ArrowRightOnRectangleIcon className="h-5 w-5" />
            Abmelden
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="p-8 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Mandanten</h2>
            <p className="text-sm text-gray-500 mt-0.5">{tenants.length} Mandant(en) vorhanden</p>
          </div>
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            <PlusIcon className="h-4 w-4" />
            Neuer Mandant
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin h-8 w-8 border-b-2 border-primary-600 rounded-full" />
          </div>
        ) : (
          <div className="grid gap-4">
            {tenants.length === 0 && (
              <div className="card text-center py-12">
                <BuildingOfficeIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Noch keine Mandanten vorhanden</p>
              </div>
            )}
            {tenants.map((tenant) => (
              <div key={tenant.id} className="card flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-primary-700 font-semibold text-sm">
                    {tenant.name[0].toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{tenant.name}</h3>
                    <span className={`badge ${tenant.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {tenant.is_active ? 'Aktiv' : 'Inaktiv'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-0.5 text-sm text-gray-500">
                    <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{tenant.slug}</span>
                    <span className="flex items-center gap-1">
                      <UsersIcon className="h-3.5 w-3.5" />
                      {tenant.user_count ?? 0} Benutzer
                    </span>
                    <span className="flex items-center gap-1">
                      <CalendarIcon className="h-3.5 w-3.5" />
                      {tenant.event_count ?? 0} Events
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleToggleActive(tenant)}
                    className={`btn-secondary btn-sm ${tenant.is_active ? 'text-orange-600' : 'text-green-600'}`}
                  >
                    {tenant.is_active ? 'Deaktivieren' : 'Aktivieren'}
                  </button>
                  <button
                    onClick={() => setResetPasswordTenant(tenant)}
                    className="p-2 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50"
                    title="Passwort zurücksetzen"
                  >
                    <KeyIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setDeletingId(tenant.id)}
                    className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"
                    title="Löschen"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create Tenant Modal */}
      <Modal isOpen={showCreate} onClose={() => { setShowCreate(false); createForm.reset(); }} title="Neuen Mandanten erstellen" size="lg">
        <form onSubmit={createForm.handleSubmit(handleCreate)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Name" required error={createForm.formState.errors.name?.message}>
              <input
                {...createForm.register('name', { required: 'Pflichtfeld' })}
                className="input"
                placeholder="Meine Organisation"
              />
            </FormField>
            <FormField label="URL-Slug" required error={createForm.formState.errors.slug?.message} hint="Nur a-z, 0-9 und -">
              <input
                {...createForm.register('slug', {
                  required: 'Pflichtfeld',
                  pattern: { value: /^[a-z0-9-]+$/, message: 'Nur Kleinbuchstaben, Zahlen, Bindestriche' },
                })}
                className="input font-mono"
                placeholder="meine-org"
              />
            </FormField>
          </div>
          <hr />
          <p className="text-sm font-medium text-gray-700">Admin-Konto</p>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Benutzername" required error={createForm.formState.errors.admin_username?.message}>
              <input
                {...createForm.register('admin_username', { required: 'Pflichtfeld' })}
                className="input"
              />
            </FormField>
            <FormField label="E-Mail" required error={createForm.formState.errors.admin_email?.message}>
              <input
                {...createForm.register('admin_email', { required: 'Pflichtfeld' })}
                type="email"
                className="input"
              />
            </FormField>
          </div>
          <FormField label="Passwort" required error={createForm.formState.errors.admin_password?.message}>
            <input
              {...createForm.register('admin_password', { required: 'Pflichtfeld', minLength: { value: 8, message: 'Mindestens 8 Zeichen' } })}
              type="password"
              className="input"
            />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => { setShowCreate(false); createForm.reset(); }} className="btn-secondary">
              Abbrechen
            </button>
            <button type="submit" disabled={createForm.formState.isSubmitting} className="btn-primary">
              {createForm.formState.isSubmitting ? 'Wird erstellt...' : 'Mandant erstellen'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        isOpen={!!resetPasswordTenant}
        onClose={() => { setResetPasswordTenant(null); resetForm.reset(); }}
        title={`Passwort zurücksetzen – ${resetPasswordTenant?.name}`}
        size="sm"
      >
        <form onSubmit={resetForm.handleSubmit(handleResetPassword)} className="space-y-4">
          <FormField label="Neues Passwort" required error={resetForm.formState.errors.new_password?.message}>
            <input
              {...resetForm.register('new_password', { required: 'Pflichtfeld', minLength: { value: 8, message: 'Mindestens 8 Zeichen' } })}
              type="password"
              className="input"
            />
          </FormField>
          <FormField label="Passwort bestätigen" required error={resetForm.formState.errors.confirm_password?.message}>
            <input
              {...resetForm.register('confirm_password', { required: 'Pflichtfeld' })}
              type="password"
              className="input"
            />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => { setResetPasswordTenant(null); resetForm.reset(); }} className="btn-secondary">
              Abbrechen
            </button>
            <button type="submit" disabled={resetForm.formState.isSubmitting} className="btn-primary">
              Zurücksetzen
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        title="Mandant löschen"
        message="Dieser Mandant und alle zugehörigen Daten werden unwiderruflich gelöscht. Fortfahren?"
      />
    </div>
  );
}
