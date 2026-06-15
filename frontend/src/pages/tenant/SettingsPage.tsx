import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import FormField from '../../components/FormField';
import { getSmtpConfig, saveSmtpConfig, testSmtpConfig, deleteSmtpConfig } from '../../api/smtp';
import { changePassword, updateTenantProfile } from '../../api/users';
import type { SmtpConfig } from '../../types';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Cog6ToothIcon, CheckCircleIcon, KeyIcon, BuildingOfficeIcon } from '@heroicons/react/24/outline';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useAuth } from '../../contexts/AuthContext';

type SmtpForm = SmtpConfig & { password?: string };

type PasswordForm = {
  current_password: string;
  new_password: string;
  confirm_password: string;
};

export default function SettingsPage() {
  const { tenant } = useParams<{ tenant: string }>();
  const { user } = useAuth();
  const [hasConfig, setHasConfig] = useState(false);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Tenant profile state
  const [tenantName, setTenantName] = useState('');
  const [savingTenant, setSavingTenant] = useState(false);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<SmtpForm>({
    defaultValues: { port: 587, encryption: 'tls' },
  });

  const {
    register: registerPwd,
    handleSubmit: handleSubmitPwd,
    reset: resetPwd,
    formState: { errors: errorsPwd, isSubmitting: isSubmittingPwd },
  } = useForm<PasswordForm>();

  useEffect(() => {
    if (!tenant) return;
    getSmtpConfig(tenant).then((config) => {
      if (config) {
        setHasConfig(true);
        reset({ ...config, password: '' });
      }
    }).finally(() => setLoading(false));
  }, [tenant]);

  useEffect(() => {
    if (user?.tenant_name) {
      setTenantName(user.tenant_name);
    }
  }, [user]);

  const onSubmit = async (data: SmtpForm) => {
    if (!tenant) return;
    try {
      await saveSmtpConfig(tenant, data);
      toast.success('SMTP-Konfiguration gespeichert');
      setHasConfig(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Fehler beim Speichern');
    }
  };

  const handleTest = async () => {
    if (!tenant || !testEmail) return;
    setTesting(true);
    try {
      await testSmtpConfig(tenant, testEmail);
      toast.success('Test-E-Mail erfolgreich gesendet!');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Test fehlgeschlagen');
    } finally {
      setTesting(false);
    }
  };

  const onSubmitPassword = async (data: PasswordForm) => {
    if (!tenant) return;
    if (data.new_password !== data.confirm_password) {
      toast.error('Neue Passwörter stimmen nicht überein');
      return;
    }
    try {
      await changePassword(tenant, data.current_password, data.new_password);
      toast.success('Passwort erfolgreich geändert');
      resetPwd();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Fehler beim Ändern des Passworts');
    }
  };

  const handleDelete = async () => {
    if (!tenant) return;
    try {
      await deleteSmtpConfig(tenant);
      toast.success('SMTP-Konfiguration gelöscht');
      setHasConfig(false);
      reset({ port: 587, encryption: 'tls' });
      setShowDeleteConfirm(false);
    } catch {
      toast.error('Fehler');
    }
  };

  const handleSaveTenantProfile = async () => {
    if (!tenant || !tenantName.trim()) return;
    setSavingTenant(true);
    try {
      await updateTenantProfile(tenant, tenantName.trim());
      toast.success('Mandantenprofil gespeichert');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Fehler beim Speichern');
    } finally {
      setSavingTenant(false);
    }
  };

  return (
    <Layout title="Einstellungen">
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin h-8 w-8 border-b-2 border-primary-600 rounded-full" />
        </div>
      ) : (
        <div className="max-w-2xl space-y-6">
          {/* SMTP Config */}
          <div className="card">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-primary-100 rounded-xl">
                <Cog6ToothIcon className="h-5 w-5 text-primary-700" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">SMTP-Konfiguration</h2>
                <p className="text-sm text-gray-500">E-Mail-Server für das Senden von Einladungen</p>
              </div>
              {hasConfig && (
                <div className="ml-auto">
                  <span className="flex items-center gap-1.5 text-green-600 text-sm">
                    <CheckCircleIcon className="h-4 w-4" />
                    Konfiguriert
                  </span>
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <FormField label="SMTP-Host" required error={errors.host?.message}>
                    <input
                      {...register('host', { required: 'Pflichtfeld' })}
                      className="input"
                      placeholder="smtp.example.com"
                    />
                  </FormField>
                </div>
                <FormField label="Port" required error={errors.port?.message}>
                  <input
                    {...register('port', { required: 'Pflichtfeld', valueAsNumber: true })}
                    type="number"
                    className="input"
                    placeholder="587"
                  />
                </FormField>
              </div>

              <FormField label="Verschlüsselung" required>
                <select {...register('encryption')} className="input">
                  <option value="tls">STARTTLS (Port 587)</option>
                  <option value="ssl">SSL/TLS (Port 465)</option>
                  <option value="none">Keine</option>
                </select>
              </FormField>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Benutzername" required error={errors.username?.message}>
                  <input
                    {...register('username', { required: 'Pflichtfeld' })}
                    className="input"
                    autoComplete="off"
                  />
                </FormField>
                <FormField label={hasConfig ? 'Passwort (leer = unverändert)' : 'Passwort'} required={!hasConfig} error={errors.password?.message}>
                  <input
                    {...register('password', { required: !hasConfig ? 'Pflichtfeld' : false })}
                    type="password"
                    className="input"
                    autoComplete="new-password"
                    placeholder={hasConfig ? '(unverändert)' : ''}
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Absender-E-Mail" required error={errors.from_email?.message}>
                  <input
                    {...register('from_email', { required: 'Pflichtfeld' })}
                    type="email"
                    className="input"
                    placeholder="noreply@example.com"
                  />
                </FormField>
                <FormField label="Absendername" required error={errors.from_name?.message}>
                  <input
                    {...register('from_name', { required: 'Pflichtfeld' })}
                    className="input"
                    placeholder="Meine Organisation"
                  />
                </FormField>
              </div>

              <div className="flex gap-3">
                <button type="submit" disabled={isSubmitting} className="btn-primary">
                  {isSubmitting ? 'Wird gespeichert...' : 'Speichern'}
                </button>
                {hasConfig && (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="btn-danger"
                  >
                    Konfiguration löschen
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Change Password */}
          <div className="card">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-primary-100 rounded-xl">
                <KeyIcon className="h-5 w-5 text-primary-700" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">Passwort ändern</h2>
                <p className="text-sm text-gray-500">Ihr Anmelde-Passwort aktualisieren</p>
              </div>
            </div>

            <form onSubmit={handleSubmitPwd(onSubmitPassword)} className="space-y-4">
              <FormField label="Aktuelles Passwort" required error={errorsPwd.current_password?.message}>
                <input
                  {...registerPwd('current_password', { required: 'Pflichtfeld' })}
                  type="password"
                  className="input"
                  autoComplete="current-password"
                />
              </FormField>
              <FormField label="Neues Passwort" required error={errorsPwd.new_password?.message}>
                <input
                  {...registerPwd('new_password', { required: 'Pflichtfeld', minLength: { value: 8, message: 'Mindestens 8 Zeichen' } })}
                  type="password"
                  className="input"
                  autoComplete="new-password"
                />
              </FormField>
              <FormField label="Neues Passwort bestätigen" required error={errorsPwd.confirm_password?.message}>
                <input
                  {...registerPwd('confirm_password', { required: 'Pflichtfeld' })}
                  type="password"
                  className="input"
                  autoComplete="new-password"
                />
              </FormField>
              <div className="flex gap-3">
                <button type="submit" disabled={isSubmittingPwd} className="btn-primary">
                  {isSubmittingPwd ? 'Wird gespeichert...' : 'Passwort ändern'}
                </button>
              </div>
            </form>
          </div>

          {/* Mandant */}
          {user?.is_admin && (
            <div className="card">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-primary-100 rounded-xl">
                  <BuildingOfficeIcon className="h-5 w-5 text-primary-700" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900">Mandant</h2>
                  <p className="text-sm text-gray-500">Name und Kennung des Mandanten</p>
                </div>
              </div>

              <div className="space-y-4">
                <FormField label="Kennung (Slug)">
                  <input
                    type="text"
                    value={user?.tenant_slug ?? ''}
                    readOnly
                    className="input bg-gray-50 text-gray-500 cursor-not-allowed"
                  />
                </FormField>
                <FormField label="Name">
                  <input
                    type="text"
                    value={tenantName}
                    onChange={(e) => setTenantName(e.target.value)}
                    className="input"
                    placeholder="Name des Mandanten"
                  />
                </FormField>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleSaveTenantProfile}
                    disabled={savingTenant || !tenantName.trim()}
                    className="btn-primary"
                  >
                    {savingTenant ? 'Wird gespeichert...' : 'Speichern'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Test SMTP */}
          {hasConfig && (
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-4">SMTP-Verbindung testen</h3>
              <div className="flex gap-3">
                <input
                  type="email"
                  className="input flex-1"
                  placeholder="Test-E-Mail-Adresse"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                />
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={testing || !testEmail}
                  className="btn-secondary"
                >
                  {testing ? 'Wird gesendet...' : 'Test senden'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="SMTP-Konfiguration löschen"
        message="Die SMTP-Konfiguration unwiderruflich löschen? E-Mails können danach nicht mehr gesendet werden."
        confirmLabel="Löschen"
      />
    </Layout>
  );
}
