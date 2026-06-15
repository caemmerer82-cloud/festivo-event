import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import Modal from '../../components/Modal';
import ConfirmDialog from '../../components/ConfirmDialog';
import FormField from '../../components/FormField';
import MailEditor from '../../components/MailEditor';
import StatusBadge from '../../components/StatusBadge';
import { getTemplates, createTemplate, updateTemplate, deleteTemplate, getMailLog, sendMails } from '../../api/mails';
import { getEvents } from '../../api/events';
import { getGuests } from '../../api/guests';
import type { MailTemplate, MailLogEntry, Event, EventGuest } from '../../types';
import toast from 'react-hot-toast';
import { PlusIcon, PencilIcon, TrashIcon, EnvelopeIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

const DEFAULT_TEMPLATE = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:20px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">
        <!-- Banner -->
        <tr>
          <td style="background:#4f46e5;padding:0;height:8px;"></td>
        </tr>
        <!-- Header -->
        <tr>
          <td style="padding:32px 40px 24px;border-bottom:1px solid #eee;">
            <h1 style="margin:0;font-size:22px;color:#111827;">{{event_name}}</h1>
            <p style="margin:8px 0 0;color:#6b7280;font-size:14px;">📅 {{event_date}} &nbsp;|&nbsp; 📍 {{event_location}}</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px 40px;">
            <p style="margin:0 0 16px;color:#374151;">Sehr geehrte(r) {{first_name}} {{last_name}},</p>
            <p style="margin:0 0 24px;color:#374151;">wir möchten Sie herzlich zu unserer Veranstaltung einladen. Bitte teilen Sie uns mit, ob Sie teilnehmen können:</p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:8px 0 32px;">
                  <a href="{{rsvp_link}}" style="display:inline-block;background:#4f46e5;color:#ffffff;padding:14px 32px;text-decoration:none;border-radius:8px;font-size:16px;font-weight:600;">
                    Jetzt antworten →
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:0;color:#6b7280;font-size:13px;border-top:1px solid #eee;padding-top:20px;">
              Alternativ können Sie diesen Link verwenden:<br>
              <a href="{{rsvp_link}}" style="color:#4f46e5;">{{rsvp_link}}</a>
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #eee;">
            <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
              Diese Einladung wurde personalisiert für {{first_name}} {{last_name}} ({{email}})
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

export default function MailsPage() {
  const { tenant } = useParams<{ tenant: string }>();
  const { user } = useAuth();
  const [templates, setTemplates] = useState<MailTemplate[]>([]);
  const [mailLog, setMailLog] = useState<MailLogEntry[]>([]);
  const [logTotal, setLogTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'templates' | 'log' | 'send'>('templates');
  const [showForm, setShowForm] = useState(false);
  const [editTemplate, setEditTemplate] = useState<MailTemplate | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState(DEFAULT_TEMPLATE);
  const [includeAttachment, setIncludeAttachment] = useState(false);
  const [saving, setSaving] = useState(false);

  // Send tab state
  const [sendEvents, setSendEvents] = useState<Event[]>([]);
  const [sendEventId, setSendEventId] = useState<number | null>(null);
  const [sendTemplateId, setSendTemplateId] = useState<number | null>(null);
  const [availableGuests, setAvailableGuests] = useState<EventGuest[]>([]);
  const [sendGuestIds, setSendGuestIds] = useState<number[]>([]);
  const [loadingGuests, setLoadingGuests] = useState(false);
  const [sendingMails, setSendingMails] = useState(false);

  const canCreate = user?.is_admin || user?.permissions?.create_mails;
  const canSend = user?.is_admin || user?.permissions?.send_mails;

  const load = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      const [tmpl, log] = await Promise.all([
        getTemplates(tenant),
        getMailLog(tenant),
      ]);
      setTemplates(tmpl);
      setMailLog(log.data);
      setLogTotal(log.total);
    } finally {
      setLoading(false);
    }
  }, [tenant]);

  useEffect(() => { load(); }, [load]);

  // Load events for send tab
  useEffect(() => {
    if (tab !== 'send' || !tenant) return;
    getEvents(tenant, 1, 100).then(res => setSendEvents(res.data));
  }, [tab, tenant]);

  // Load guests when event changes in send tab
  useEffect(() => {
    if (!sendEventId || !tenant) {
      setAvailableGuests([]);
      setSendGuestIds([]);
      return;
    }
    setLoadingGuests(true);
    getGuests(tenant, sendEventId)
      .then(guests => {
        setAvailableGuests(guests);
        // Pre-select angelegt + eingeladen
        setSendGuestIds(guests.filter(g => g.status === 'angelegt' || g.status === 'eingeladen').map(g => g.id));
      })
      .finally(() => setLoadingGuests(false));
  }, [sendEventId, tenant]);

  const openCreate = () => {
    setEditTemplate(null);
    setName(''); setSubject(''); setBodyHtml(DEFAULT_TEMPLATE); setIncludeAttachment(false);
    setShowForm(true);
  };

  const openEdit = (t: MailTemplate) => {
    setEditTemplate(t);
    setName(t.name); setSubject(t.subject); setBodyHtml(t.body_html); setIncludeAttachment(t.include_attachment);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!tenant || !name || !subject || !bodyHtml) return;
    setSaving(true);
    try {
      const data = { name, subject, body_html: bodyHtml, include_attachment: includeAttachment };
      if (editTemplate) {
        await updateTemplate(tenant, editTemplate.id, data);
        toast.success('Vorlage aktualisiert');
      } else {
        await createTemplate(tenant, data);
        toast.success('Vorlage erstellt');
      }
      setShowForm(false);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Fehler');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!tenant || !deletingId) return;
    try {
      await deleteTemplate(tenant, deletingId);
      toast.success('Vorlage gelöscht');
      setDeletingId(null);
      load();
    } catch {
      toast.error('Fehler');
    }
  };

  const handleSendMails = async () => {
    if (!tenant || !sendTemplateId || !sendEventId || sendGuestIds.length === 0) return;
    setSendingMails(true);
    try {
      const res = await sendMails(tenant, sendTemplateId, sendGuestIds, sendEventId);
      toast.success(`${res.sent} E-Mails gesendet`);
      if (res.failed > 0) toast.error(`${res.failed} fehlgeschlagen`);
      setSendGuestIds([]);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Fehler');
    } finally {
      setSendingMails(false);
    }
  };

  const toggleGuest = (guestId: number, checked: boolean) => {
    setSendGuestIds(prev => checked ? [...prev, guestId] : prev.filter(x => x !== guestId));
  };

  return (
    <Layout
      title="E-Mail-Vorlagen"
      actions={canCreate ? (
        <button onClick={openCreate} className="btn-primary">
          <PlusIcon className="h-4 w-4" />
          Neue Vorlage
        </button>
      ) : undefined}
    >
      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-6">
          <button
            onClick={() => setTab('templates')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              tab === 'templates' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Vorlagen ({templates.length})
          </button>
          <button
            onClick={() => setTab('log')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              tab === 'log' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Verlauf ({logTotal})
          </button>
          {canSend && (
            <button
              onClick={() => setTab('send')}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                tab === 'send' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Senden
            </button>
          )}
        </nav>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin h-8 w-8 border-b-2 border-primary-600 rounded-full" />
        </div>
      ) : tab === 'templates' ? (
        templates.length === 0 ? (
          <div className="text-center py-16">
            <EnvelopeIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Keine Vorlagen vorhanden</p>
            {canCreate && (
              <button onClick={openCreate} className="btn-primary mt-4">
                <PlusIcon className="h-4 w-4" />
                Erste Vorlage erstellen
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            {templates.map((t) => (
              <div key={t.id} className="card flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900">{t.name}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">Betreff: {t.subject}</p>
                  <div className="flex gap-2 mt-2">
                    {t.include_attachment && (
                      <span className="badge bg-blue-100 text-blue-700">Mit Anhang</span>
                    )}
                    <span className="text-xs text-gray-400">
                      Erstellt: {format(new Date(t.created_at), 'dd.MM.yyyy', { locale: de })}
                    </span>
                  </div>
                </div>
                {canCreate && (
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => openEdit(t)} className="p-2 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50">
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button onClick={() => setDeletingId(t.id)} className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50">
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      ) : tab === 'log' ? (
        /* Mail log */
        <div className="card p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-6 py-3 text-left font-medium text-gray-500">Empfänger</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">Betreff</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">Veranstaltung</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">Datum</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody>
              {mailLog.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-gray-400">Kein Verlauf vorhanden</td>
                </tr>
              ) : mailLog.map((entry) => (
                <tr key={entry.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-6 py-3">
                    <p className="font-medium text-gray-900">
                      {entry.first_name} {entry.last_name}
                    </p>
                    <p className="text-xs text-gray-500">{entry.recipient_email}</p>
                  </td>
                  <td className="px-6 py-3 text-gray-600 max-w-xs truncate">{entry.subject}</td>
                  <td className="px-6 py-3 text-gray-500">{entry.event_name ?? '–'}</td>
                  <td className="px-6 py-3 text-gray-500">
                    {format(new Date(entry.sent_at), 'dd.MM.yyyy HH:mm', { locale: de })}
                  </td>
                  <td className="px-6 py-3">
                    <span className={`badge ${entry.status === 'sent' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {entry.status === 'sent' ? 'Gesendet' : 'Fehler'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Send tab */
        <div className="space-y-6 max-w-2xl">
          <div className="card space-y-4">
            <h2 className="font-semibold text-gray-900">E-Mails versenden</h2>

            {/* Event select */}
            <FormField label="Veranstaltung" required>
              <select
                className="input"
                value={sendEventId ?? ''}
                onChange={(e) => setSendEventId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Veranstaltung wählen...</option>
                {sendEvents.map(ev => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name} – {format(new Date(ev.event_date), 'dd.MM.yyyy', { locale: de })}
                  </option>
                ))}
              </select>
            </FormField>

            {/* Template select */}
            <FormField label="E-Mail-Vorlage" required>
              <select
                className="input"
                value={sendTemplateId ?? ''}
                onChange={(e) => setSendTemplateId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Vorlage wählen...</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </FormField>
          </div>

          {/* Guest list */}
          {sendEventId && (
            <div className="card p-0">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-wrap gap-2">
                <h3 className="font-medium text-gray-900 text-sm">Empfänger auswählen</h3>
                <div className="flex gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setSendGuestIds(availableGuests.map(g => g.id))}
                    className="btn-secondary btn-sm text-xs"
                  >
                    Alle auswählen
                  </button>
                  <button
                    type="button"
                    onClick={() => setSendGuestIds(availableGuests.filter(g => g.status === 'angelegt').map(g => g.id))}
                    className="btn-secondary btn-sm text-xs"
                  >
                    Nur Angelegt
                  </button>
                  <button
                    type="button"
                    onClick={() => setSendGuestIds(availableGuests.filter(g => g.status === 'eingeladen').map(g => g.id))}
                    className="btn-secondary btn-sm text-xs"
                  >
                    Nur Eingeladen
                  </button>
                  <button
                    type="button"
                    onClick={() => setSendGuestIds([])}
                    className="btn-secondary btn-sm text-xs"
                  >
                    Keine
                  </button>
                </div>
              </div>
              {loadingGuests ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin h-6 w-6 border-b-2 border-primary-600 rounded-full" />
                </div>
              ) : availableGuests.length === 0 ? (
                <p className="text-center text-gray-400 py-8 text-sm">Keine Gäste für diese Veranstaltung</p>
              ) : (
                <div className="max-h-80 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="w-10 px-4 py-2">
                          <input
                            type="checkbox"
                            checked={sendGuestIds.length === availableGuests.length && availableGuests.length > 0}
                            onChange={(e) => setSendGuestIds(e.target.checked ? availableGuests.map(g => g.id) : [])}
                            className="rounded border-gray-300 text-primary-600"
                          />
                        </th>
                        <th className="px-4 py-2 text-left font-medium text-gray-500">Name</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-500">E-Mail</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-500">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {availableGuests.map(guest => (
                        <tr key={guest.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-4 py-2">
                            <input
                              type="checkbox"
                              checked={sendGuestIds.includes(guest.id)}
                              onChange={(e) => toggleGuest(guest.id, e.target.checked)}
                              className="rounded border-gray-300 text-primary-600"
                            />
                          </td>
                          <td className="px-4 py-2 text-gray-900 font-medium">{guest.first_name} {guest.last_name}</td>
                          <td className="px-4 py-2 text-gray-500">{guest.email}</td>
                          <td className="px-4 py-2"><StatusBadge status={guest.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
                <span className="text-sm text-gray-500">{sendGuestIds.length} von {availableGuests.length} ausgewählt</span>
                <button
                  onClick={handleSendMails}
                  disabled={sendingMails || !sendTemplateId || sendGuestIds.length === 0}
                  className="btn-primary"
                >
                  <PaperAirplaneIcon className="h-4 w-4" />
                  {sendingMails ? 'Wird gesendet...' : `E-Mails senden (${sendGuestIds.length})`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Template Form Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editTemplate ? 'Vorlage bearbeiten' : 'Neue Vorlage'}
        size="xl"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Name" required>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="z.B. Einladung zur Jahresfeier" />
            </FormField>
            <FormField label="Betreff" required>
              <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="z.B. Sie sind eingeladen: {{event_name}}" />
            </FormField>
          </div>
          <FormField label="Inhalt (HTML)">
            <MailEditor value={bodyHtml} onChange={setBodyHtml} />
          </FormField>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeAttachment}
              onChange={(e) => setIncludeAttachment(e.target.checked)}
              className="rounded border-gray-300 text-primary-600"
            />
            <span className="text-sm text-gray-700">Veranstaltungsanhang beifügen (falls vorhanden)</span>
          </label>
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowForm(false)} className="btn-secondary">Abbrechen</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? 'Wird gespeichert...' : 'Speichern'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        title="Vorlage löschen"
        message="Diese E-Mail-Vorlage unwiderruflich löschen?"
      />
    </Layout>
  );
}
