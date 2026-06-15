import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import EventCard from '../../components/EventCard';
import Modal from '../../components/Modal';
import ConfirmDialog from '../../components/ConfirmDialog';
import FormField from '../../components/FormField';
import FileUpload from '../../components/FileUpload';
import Pagination from '../../components/Pagination';
import { getEvents, createEvent, updateEvent, deleteEvent } from '../../api/events';
import type { Event } from '../../types';
import toast from 'react-hot-toast';
import { PlusIcon, CalendarIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';

export default function EventsPage() {
  const { tenant } = useParams<{ tenant: string }>();
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editEvent, setEditEvent] = useState<Event | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [banner, setBanner] = useState<File | null>(null);
  const [attachment, setAttachment] = useState<File | null>(null);

  const canCreate = user?.is_admin || user?.permissions?.create_events;

  const load = async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      const res = await getEvents(tenant, page);
      setEvents(res.data);
      setTotal(res.total);
      setPages(res.pages);
    } catch {
      toast.error('Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [tenant, page]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant || !name || !eventDate) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('name', name);
      fd.append('description', description);
      fd.append('location', location);
      fd.append('event_date', eventDate);
      if (banner) fd.append('banner', banner);
      if (attachment) fd.append('attachment', attachment);

      await createEvent(tenant, fd);
      toast.success('Veranstaltung erstellt');
      setShowCreate(false);
      resetForm();
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Fehler');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant || !editEvent || !name || !eventDate) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('name', name);
      fd.append('description', description);
      fd.append('location', location);
      fd.append('event_date', eventDate);
      if (banner) fd.append('banner', banner);
      if (attachment) fd.append('attachment', attachment);

      await updateEvent(tenant, editEvent.id, fd);
      toast.success('Veranstaltung aktualisiert');
      setEditEvent(null);
      resetForm();
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Fehler');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (event: Event) => {
    setEditEvent(event);
    setName(event.name);
    setDescription(event.description ?? '');
    setLocation(event.location ?? '');
    // Convert event_date to datetime-local format
    const d = new Date(event.event_date);
    const pad = (n: number) => String(n).padStart(2, '0');
    setEventDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
    setBanner(null);
    setAttachment(null);
  };

  const handleDelete = async () => {
    if (!tenant || !deletingId) return;
    try {
      await deleteEvent(tenant, deletingId);
      toast.success('Veranstaltung gelöscht');
      setDeletingId(null);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Fehler');
    }
  };

  const resetForm = () => {
    setName(''); setDescription(''); setLocation(''); setEventDate('');
    setBanner(null); setAttachment(null);
  };

  const eventFormFields = (
    <div className="grid grid-cols-2 gap-4">
      <div className="col-span-2">
        <FormField label="Name" required>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="z.B. Jahreshauptversammlung 2024"
            required
          />
        </FormField>
      </div>
      <FormField label="Datum und Uhrzeit" required>
        <input
          type="datetime-local"
          className="input"
          value={eventDate}
          onChange={(e) => setEventDate(e.target.value)}
          required
        />
      </FormField>
      <FormField label="Ort">
        <input
          className="input"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="z.B. Berlin, Hauptsaal"
        />
      </FormField>
      <div className="col-span-2">
        <FormField label="Beschreibung">
          <textarea
            className="input"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Beschreibung der Veranstaltung..."
          />
        </FormField>
      </div>
      <FileUpload
        label="Banner-Bild"
        accept="image/*"
        onChange={setBanner}
        currentUrl={editEvent?.banner_path ? `/api/public/files/${editEvent.banner_path}` : undefined}
        hint="JPG, PNG, WebP (max. 10 MB)"
      />
      <FileUpload
        label="Anhang (PDF)"
        accept=".pdf,.doc,.docx"
        onChange={setAttachment}
        currentFilename={editEvent?.attachment_filename ?? undefined}
        hint="PDF oder Word-Dokument (max. 10 MB)"
      />
    </div>
  );

  return (
    <Layout
      title="Veranstaltungen"
      actions={canCreate ? (
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <PlusIcon className="h-4 w-4" />
          Neue Veranstaltung
        </button>
      ) : undefined}
    >
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin h-8 w-8 border-b-2 border-primary-600 rounded-full" />
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-16">
          <CalendarIcon className="h-14 w-14 text-gray-300 mx-auto mb-3" />
          <p className="text-lg font-medium text-gray-500">Keine Veranstaltungen vorhanden</p>
          {canCreate && (
            <button onClick={() => setShowCreate(true)} className="btn-primary mt-4">
              <PlusIcon className="h-4 w-4" />
              Erste Veranstaltung erstellen
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onDelete={canCreate ? setDeletingId : undefined}
                onEdit={canCreate ? openEdit : undefined}
              />
            ))}
          </div>
          <div className="mt-6">
            <Pagination page={page} pages={pages} total={total} limit={20} onPage={setPage} />
          </div>
        </>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => { setShowCreate(false); resetForm(); }}
        title="Neue Veranstaltung"
        size="lg"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          {eventFormFields}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => { setShowCreate(false); resetForm(); }} className="btn-secondary">
              Abbrechen
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Wird erstellt...' : 'Erstellen'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editEvent}
        onClose={() => { setEditEvent(null); resetForm(); }}
        title="Veranstaltung bearbeiten"
        size="lg"
      >
        <form onSubmit={handleEdit} className="space-y-4">
          {eventFormFields}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => { setEditEvent(null); resetForm(); }} className="btn-secondary">
              Abbrechen
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Wird gespeichert...' : 'Speichern'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        title="Veranstaltung löschen"
        message="Diese Veranstaltung und alle Gästelisten werden unwiderruflich gelöscht."
      />
    </Layout>
  );
}
