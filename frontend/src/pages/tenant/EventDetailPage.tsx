import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import GuestTable from '../../components/GuestTable';
import QuestionEditor from '../../components/QuestionEditor';
import StatusBadge from '../../components/StatusBadge';
import Modal from '../../components/Modal';
import ConfirmDialog from '../../components/ConfirmDialog';
import { getEvent, updateEvent } from '../../api/events';
import { getGuests, addGuests, removeGuest, updateGuestStatus, generateTokens, getGuestAnswers } from '../../api/guests';
import { getPersons } from '../../api/persons';
import { getQuestions, createQuestion, updateQuestion, deleteQuestion, reorderQuestions } from '../../api/questions';
import { getTemplates, sendMails } from '../../api/mails';
import type { Event, EventGuest, Question, GuestStatus, Person, MailTemplate } from '../../types';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { useAuth } from '../../contexts/AuthContext';
import {
  CalendarIcon, MapPinIcon, PaperClipIcon, UserPlusIcon,
  PaperAirplaneIcon, ChevronLeftIcon, MagnifyingGlassIcon, ArrowDownTrayIcon, PencilIcon, DocumentTextIcon,
} from '@heroicons/react/24/outline';
import FileUpload from '../../components/FileUpload';
import FormField from '../../components/FormField';

type Tab = 'guests' | 'questions';

export default function EventDetailPage() {
  const { tenant, eventId } = useParams<{ tenant: string; eventId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [event, setEvent] = useState<Event | null>(null);
  const [guests, setGuests] = useState<EventGuest[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('guests');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [guestSearch, setGuestSearch] = useState('');
  const [guestStatusFilter, setGuestStatusFilter] = useState('');

  // Add guests modal
  const [showAddGuests, setShowAddGuests] = useState(false);
  const [persons, setPersons] = useState<Person[]>([]);
  const [personSearch, setPersonSearch] = useState('');
  const [selectedPersonIds, setSelectedPersonIds] = useState<number[]>([]);
  const [loadingPersons, setLoadingPersons] = useState(false);

  // Send mail modal
  const [showSendMail, setShowSendMail] = useState(false);
  const [templates, setTemplates] = useState<MailTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [sending, setSending] = useState(false);

  // Remove guest confirm
  const [removingGuestId, setRemovingGuestId] = useState<number | null>(null);

  // Edit event modal
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editBanner, setEditBanner] = useState<File | null>(null);
  const [editAttachment, setEditAttachment] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  // Guest answers modal
  const [answersGuest, setAnswersGuest] = useState<EventGuest | null>(null);
  const [guestAnswers, setGuestAnswers] = useState<any[]>([]);
  const [loadingAnswers, setLoadingAnswers] = useState(false);

  const id = Number(eventId);
  const canManageGuests = user?.is_admin || user?.permissions?.create_events;
  const canSetStatus = user?.is_admin || user?.permissions?.set_status;
  const canSendMail = user?.is_admin || user?.permissions?.send_mails;
  const canEditRsvp = user?.is_admin || user?.permissions?.create_rsvp || user?.permissions?.edit_rsvp;

  const loadEvent = useCallback(async () => {
    if (!tenant) return;
    try {
      const [eventData, guestsData, questionsData] = await Promise.all([
        getEvent(tenant, id),
        getGuests(tenant, id),
        getQuestions(tenant, id),
      ]);
      setEvent(eventData);
      setGuests(guestsData);
      setQuestions(questionsData);
    } catch {
      toast.error('Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, [tenant, id]);

  useEffect(() => { loadEvent(); }, [loadEvent]);

  const loadPersons = async (search = '') => {
    if (!tenant) return;
    setLoadingPersons(true);
    try {
      const res = await getPersons(tenant, { search, limit: 100 });
      setPersons(res.data);
    } finally {
      setLoadingPersons(false);
    }
  };

  useEffect(() => {
    if (showAddGuests) loadPersons(personSearch);
  }, [showAddGuests, personSearch]);

  const filteredGuests = guests.filter(g => {
    const matchSearch = !guestSearch ||
      `${g.first_name} ${g.last_name} ${g.email}`.toLowerCase().includes(guestSearch.toLowerCase());
    const matchStatus = !guestStatusFilter || g.status === guestStatusFilter;
    return matchSearch && matchStatus;
  });

  const handleAddGuests = async () => {
    if (!tenant || selectedPersonIds.length === 0) return;
    try {
      const res = await addGuests(tenant, id, selectedPersonIds);
      toast.success(`${res.added} Gäste hinzugefügt`);
      setShowAddGuests(false);
      setSelectedPersonIds([]);
      loadEvent();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Fehler');
    }
  };

  const handleRemoveGuest = async () => {
    if (!tenant || !removingGuestId) return;
    try {
      await removeGuest(tenant, id, removingGuestId);
      toast.success('Gast entfernt');
      setRemovingGuestId(null);
      loadEvent();
    } catch {
      toast.error('Fehler');
    }
  };

  const handleStatusChange = async (guestId: number, status: GuestStatus) => {
    if (!tenant) return;
    try {
      await updateGuestStatus(tenant, id, guestId, status);
      setGuests(prev => prev.map(g => g.id === guestId ? { ...g, status } : g));
      toast.success('Status aktualisiert');
    } catch {
      toast.error('Fehler');
    }
  };

  const handleSendMails = async () => {
    if (!tenant || !selectedTemplateId || selectedIds.length === 0) return;
    setSending(true);
    try {
      const res = await sendMails(tenant, selectedTemplateId, selectedIds, id);
      toast.success(`${res.sent} E-Mails gesendet`);
      if (res.failed > 0) toast.error(`${res.failed} fehlgeschlagen`);
      setShowSendMail(false);
      setSelectedIds([]);
      loadEvent();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Fehler');
    } finally {
      setSending(false);
    }
  };

  const handleGenerateTokens = async () => {
    if (!tenant || selectedIds.length === 0) return;
    try {
      const res = await generateTokens(tenant, id, selectedIds);
      toast.success(`${res.updated} Token(s) generiert`);
      loadEvent();
    } catch {
      toast.error('Fehler');
    }
  };

  const openSendMail = async () => {
    if (!tenant) return;
    const tmpl = await getTemplates(tenant);
    setTemplates(tmpl);
    setSelectedTemplateId(tmpl[0]?.id ?? null);
    setShowSendMail(true);
  };

  const openSendMailWithPreselect = async () => {
    if (!tenant) return;
    // Pre-select guests with status "angelegt" or "eingeladen"
    const preselected = guests
      .filter(g => g.status === 'angelegt' || g.status === 'eingeladen')
      .map(g => g.id);
    setSelectedIds(preselected);
    const tmpl = await getTemplates(tenant);
    setTemplates(tmpl);
    setSelectedTemplateId(tmpl[0]?.id ?? null);
    setShowSendMail(true);
  };

  const handleCopyRsvpLink = (guest: EventGuest) => {
    if (!guest.invitation_token) return;
    const url = `${window.location.origin}/rsvp/${guest.invitation_token}`;
    navigator.clipboard.writeText(url).then(() => {
      toast.success('Link in Zwischenablage kopiert');
    }).catch(() => {
      // Fallback
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      toast.success('Link kopiert');
    });
  };

  const handleExportCSV = () => {
    if (!tenant) return;
    const token = localStorage.getItem('auth_token');
    const url = `/api/${tenant}/events/${id}/guests/export`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `gaesteliste_${event?.name ?? 'export'}_${new Date().toISOString().slice(0,10)}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch(() => toast.error('Export fehlgeschlagen'));
  };

  const handleViewAnswers = async (guest: EventGuest) => {
    if (!tenant) return;
    setAnswersGuest(guest);
    setLoadingAnswers(true);
    try {
      const answers = await getGuestAnswers(tenant, id, guest.id);
      setGuestAnswers(answers);
    } catch {
      toast.error('Fehler beim Laden der Antworten');
    } finally {
      setLoadingAnswers(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center py-20">
          <div className="animate-spin h-8 w-8 border-b-2 border-primary-600 rounded-full" />
        </div>
      </Layout>
    );
  }

  if (!event) return <Layout><p className="text-gray-500">Veranstaltung nicht gefunden</p></Layout>;

  const stats = [
    { label: 'Gesamt', value: guests.length, color: 'text-gray-700' },
    { label: 'Eingeladen', value: guests.filter(g => g.status === 'eingeladen').length, color: 'text-blue-600' },
    { label: 'Zugesagt', value: guests.filter(g => g.status === 'zugesagt').length, color: 'text-green-600' },
    { label: 'Abgesagt', value: guests.filter(g => g.status === 'abgesagt').length, color: 'text-red-600' },
  ];

  const openEdit = () => {
    if (!event) return;
    setEditName(event.name);
    setEditDate(event.event_date.replace(' ', 'T').slice(0, 16));
    setEditLocation(event.location ?? '');
    setEditDescription(event.description ?? '');
    setEditBanner(null);
    setEditAttachment(null);
    setShowEdit(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant || !event) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('name', editName);
      fd.append('event_date', editDate);
      fd.append('location', editLocation);
      fd.append('description', editDescription);
      if (editBanner) fd.append('banner', editBanner);
      if (editAttachment) fd.append('attachment', editAttachment);
      const updated = await updateEvent(tenant, event.id, fd);
      setEvent(updated);
      setShowEdit(false);
      toast.success('Veranstaltung gespeichert');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout
      title={event.name}
      actions={
        <div className="flex gap-2">
          {canManageGuests && (
            <>
              <button onClick={() => navigate(`/${tenant}/events/${eventId}/texts`)} className="btn-secondary btn-sm">
                <DocumentTextIcon className="h-4 w-4" />
                Texte
              </button>
              <button onClick={openEdit} className="btn-secondary btn-sm">
                <PencilIcon className="h-4 w-4" />
                Bearbeiten
              </button>
            </>
          )}
          <button onClick={() => navigate(`/${tenant}/events`)} className="btn-secondary btn-sm">
            <ChevronLeftIcon className="h-4 w-4" />
            Zurück
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Event info */}
        <div className="card">
          <div className="flex gap-6">
            {event.banner_path && (
              <div className="h-28 w-48 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                <img
                  src={`/api/public/files/${event.banner_path}`}
                  alt={event.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <span className="flex items-center gap-1.5">
                  <CalendarIcon className="h-4 w-4" />
                  {format(new Date(event.event_date), 'dd. MMMM yyyy, HH:mm', { locale: de })} Uhr
                </span>
                {event.location && (
                  <span className="flex items-center gap-1.5">
                    <MapPinIcon className="h-4 w-4" />
                    {event.location}
                  </span>
                )}
                {event.attachment_filename && (
                  <span className="flex items-center gap-1.5">
                    <PaperClipIcon className="h-4 w-4" />
                    {event.attachment_filename}
                  </span>
                )}
              </div>
              {event.description && (
                <p className="text-sm text-gray-600">{event.description}</p>
              )}
              {/* Stats */}
              <div className="flex gap-6 pt-2">
                {stats.map(({ label, value, color }) => (
                  <div key={label}>
                    <span className={`text-xl font-bold ${color}`}>{value}</span>
                    <p className="text-xs text-gray-500">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex gap-6">
            {(['guests', 'questions'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                  tab === t
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t === 'guests' ? `Gäste (${guests.length})` : `RSVP-Fragen (${questions.length})`}
              </button>
            ))}
          </nav>
        </div>

        {/* Guests tab */}
        {tab === 'guests' && (
          <div className="card p-0">
            {/* Toolbar */}
            <div className="flex items-center gap-3 p-4 border-b border-gray-200 flex-wrap">
              <div className="relative flex-1 min-w-48">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  className="input pl-9"
                  placeholder="Suchen..."
                  value={guestSearch}
                  onChange={(e) => setGuestSearch(e.target.value)}
                />
              </div>
              <select
                className="input w-40"
                value={guestStatusFilter}
                onChange={(e) => setGuestStatusFilter(e.target.value)}
              >
                <option value="">Alle Status</option>
                <option value="angelegt">Angelegt</option>
                <option value="eingeladen">Eingeladen</option>
                <option value="zugesagt">Zugesagt</option>
                <option value="abgesagt">Abgesagt</option>
              </select>
              {selectedIds.length > 0 && (
                <span className="text-sm text-gray-600">{selectedIds.length} ausgewählt</span>
              )}
              {canSendMail && selectedIds.length > 0 && (
                <>
                  <button onClick={openSendMail} className="btn-primary btn-sm">
                    <PaperAirplaneIcon className="h-4 w-4" />
                    E-Mail senden
                  </button>
                  <button onClick={handleGenerateTokens} className="btn-secondary btn-sm">
                    Tokens generieren
                  </button>
                </>
              )}
              {canSendMail && (
                <button onClick={openSendMailWithPreselect} className="btn-secondary btn-sm">
                  <PaperAirplaneIcon className="h-4 w-4" />
                  Einladungen versenden
                </button>
              )}
              {canManageGuests && (
                <button onClick={() => setShowAddGuests(true)} className="btn-secondary btn-sm ml-auto">
                  <UserPlusIcon className="h-4 w-4" />
                  Gäste hinzufügen
                </button>
              )}
              <button onClick={handleExportCSV} className="btn-secondary btn-sm">
                <ArrowDownTrayIcon className="h-4 w-4" />
                Exportieren
              </button>
            </div>
            <GuestTable
              guests={filteredGuests}
              selectedIds={selectedIds}
              onSelect={(id, checked) => setSelectedIds(prev =>
                checked ? [...prev, id] : prev.filter(x => x !== id)
              )}
              onSelectAll={(checked) => setSelectedIds(checked ? filteredGuests.map(g => g.id) : [])}
              onStatusChange={handleStatusChange}
              onRemove={setRemovingGuestId}
              canSetStatus={!!canSetStatus}
              canRemove={!!canManageGuests}
              onViewAnswers={handleViewAnswers}
              onCopyLink={handleCopyRsvpLink}
            />
          </div>
        )}

        {/* Questions tab */}
        {tab === 'questions' && canEditRsvp && (
          <div className="card">
            <QuestionEditor
              questions={questions}
              onAdd={async (q) => {
                if (!tenant) return;
                const created = await createQuestion(tenant, id, q);
                setQuestions(prev => [...prev, created]);
              }}
              onUpdate={async (qId, q) => {
                if (!tenant) return;
                const updated = await updateQuestion(tenant, id, qId, q);
                setQuestions(prev => prev.map(x => x.id === qId ? updated : x));
              }}
              onDelete={async (qId) => {
                if (!tenant) return;
                await deleteQuestion(tenant, id, qId);
                setQuestions(prev => prev.filter(x => x.id !== qId));
              }}
              onReorder={async (order) => {
                if (!tenant) return;
                await reorderQuestions(tenant, id, order);
                loadEvent();
              }}
            />
          </div>
        )}
        {tab === 'questions' && !canEditRsvp && (
          <div className="card">
            <p className="text-gray-500 text-sm">Keine Berechtigung zum Bearbeiten von Fragen.</p>
          </div>
        )}
      </div>

      {/* Add Guests Modal */}
      <Modal isOpen={showAddGuests} onClose={() => { setShowAddGuests(false); setSelectedPersonIds([]); }} title="Gäste hinzufügen" size="lg">
        <div className="space-y-3">
          <div>
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                className="input pl-9"
                placeholder="Personen suchen..."
                value={personSearch}
                onChange={(e) => setPersonSearch(e.target.value)}
              />
            </div>
            {!loadingPersons && (
              <p className="text-xs text-gray-400 mt-1">{persons.length} Personen geladen</p>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto border border-gray-200 rounded-lg">
            {loadingPersons ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin h-5 w-5 border-b-2 border-primary-600 rounded-full" />
              </div>
            ) : persons.length === 0 ? (
              <p className="text-center text-gray-400 py-8 text-sm">Keine Personen gefunden</p>
            ) : (
              persons.map((person) => {
                const alreadyAdded = guests.some(g => g.person_id === person.id);
                return (
                  <label
                    key={person.id}
                    className={`flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer ${alreadyAdded ? 'opacity-50' : ''}`}
                  >
                    <input
                      type="checkbox"
                      disabled={alreadyAdded}
                      checked={selectedPersonIds.includes(person.id)}
                      onChange={(e) => setSelectedPersonIds(prev =>
                        e.target.checked ? [...prev, person.id] : prev.filter(x => x !== person.id)
                      )}
                      className="rounded border-gray-300 text-primary-600"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{person.first_name} {person.last_name}</p>
                      <p className="text-xs text-gray-500">{person.email}</p>
                    </div>
                    {alreadyAdded && <span className="text-xs text-gray-400">Bereits eingeladen</span>}
                  </label>
                );
              })
            )}
          </div>
          <p className="text-xs text-gray-500">{selectedPersonIds.length} ausgewählt</p>
          <div className="flex justify-end gap-3">
            <button onClick={() => { setShowAddGuests(false); setSelectedPersonIds([]); }} className="btn-secondary">
              Abbrechen
            </button>
            <button onClick={handleAddGuests} disabled={selectedPersonIds.length === 0} className="btn-primary">
              Hinzufügen
            </button>
          </div>
        </div>
      </Modal>

      {/* Send Mail Modal */}
      <Modal isOpen={showSendMail} onClose={() => setShowSendMail(false)} title="E-Mail senden" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            E-Mail an <strong>{selectedIds.length}</strong> ausgewählte Gäste senden.
          </p>
          {/* Quick-select buttons */}
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setSelectedIds(guests.filter(g => g.status === 'angelegt').map(g => g.id))}
              className="btn-secondary btn-sm text-xs"
            >
              Alle Angelegt ({guests.filter(g => g.status === 'angelegt').length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(guests.filter(g => g.status === 'eingeladen').map(g => g.id))}
              className="btn-secondary btn-sm text-xs"
            >
              Alle Eingeladen ({guests.filter(g => g.status === 'eingeladen').length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(guests.filter(g => g.status === 'angelegt' || g.status === 'eingeladen').map(g => g.id))}
              className="btn-secondary btn-sm text-xs"
            >
              Angelegt + Eingeladen
            </button>
          </div>
          <div>
            <label className="label">Vorlage auswählen</label>
            {templates.length === 0 ? (
              <p className="text-sm text-amber-600">Keine Vorlagen vorhanden. Bitte zuerst eine Vorlage erstellen.</p>
            ) : (
              <select
                className="input"
                value={selectedTemplateId ?? ''}
                onChange={(e) => setSelectedTemplateId(Number(e.target.value))}
              >
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            )}
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowSendMail(false)} className="btn-secondary">Abbrechen</button>
            <button
              onClick={handleSendMails}
              disabled={!selectedTemplateId || sending || selectedIds.length === 0}
              className="btn-primary"
            >
              {sending ? 'Wird gesendet...' : `Senden (${selectedIds.length})`}
            </button>
          </div>
        </div>
      </Modal>

      {/* Guest Answers Modal */}
      <Modal
        isOpen={!!answersGuest}
        onClose={() => { setAnswersGuest(null); setGuestAnswers([]); }}
        title={answersGuest ? `Antworten: ${answersGuest.first_name} ${answersGuest.last_name}` : 'Antworten'}
        size="md"
      >
        {loadingAnswers ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin h-6 w-6 border-b-2 border-primary-600 rounded-full" />
          </div>
        ) : guestAnswers.length === 0 ? (
          <p className="text-gray-500 text-sm py-4 text-center">Keine Antworten vorhanden.</p>
        ) : (
          <div className="space-y-4">
            {guestAnswers.map((answer, i) => (
              <div key={i} className="border border-gray-100 rounded-lg p-3 bg-gray-50">
                <p className="text-xs font-medium text-gray-500 mb-1">{answer.question_text}</p>
                <p className="text-sm text-gray-900">{answer.answer ?? '–'}</p>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!removingGuestId}
        onClose={() => setRemovingGuestId(null)}
        onConfirm={handleRemoveGuest}
        title="Gast entfernen"
        message="Diesen Gast von der Veranstaltung entfernen?"
        confirmLabel="Entfernen"
      />

      {/* Edit event modal */}
      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title="Veranstaltung bearbeiten" size="lg">
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <FormField label="Name" required>
                <input className="input" value={editName} onChange={e => setEditName(e.target.value)} required />
              </FormField>
            </div>
            <FormField label="Datum und Uhrzeit" required>
              <input type="datetime-local" className="input" value={editDate} onChange={e => setEditDate(e.target.value)} required />
            </FormField>
            <FormField label="Ort">
              <input className="input" value={editLocation} onChange={e => setEditLocation(e.target.value)} placeholder="z.B. Berlin, Hauptsaal" />
            </FormField>
            <div className="col-span-2">
              <FormField label="Beschreibung">
                <textarea className="input" rows={3} value={editDescription} onChange={e => setEditDescription(e.target.value)} />
              </FormField>
            </div>
            <FileUpload
              label="Banner-Bild"
              accept="image/*"
              onChange={setEditBanner}
              currentUrl={event?.banner_path ? `/api/public/files/${event.banner_path}` : undefined}
              hint="JPG, PNG, WebP (max. 10 MB)"
            />
            <FileUpload
              label="Anhang (PDF)"
              accept=".pdf,.doc,.docx"
              onChange={setEditAttachment}
              currentFilename={event?.attachment_filename ?? undefined}
              hint="PDF oder Word-Dokument (max. 10 MB)"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowEdit(false)} className="btn-secondary">Abbrechen</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Wird gespeichert...' : 'Speichern'}
            </button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
