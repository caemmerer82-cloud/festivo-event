import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import Modal from '../../components/Modal';
import ConfirmDialog from '../../components/ConfirmDialog';
import FormField from '../../components/FormField';
import Pagination from '../../components/Pagination';
import { getPersons, createPerson, updatePerson, deletePerson, importPersons } from '../../api/persons';
import type { Person } from '../../types';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { PlusIcon, PencilIcon, TrashIcon, MagnifyingGlassIcon, UserGroupIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';

type PersonForm = Omit<Person, 'id' | 'tenant_id' | 'created_at'>;

const GENDER_LABELS: Record<string, string> = { m: 'Männlich', f: 'Weiblich', d: 'Divers' };

const parseCsv = (text: string): Record<string, string>[] => {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  // Detect delimiter
  const delim = lines[0].includes(';') ? ';' : ',';
  const parseRow = (line: string) => line.split(delim).map(v => v.trim().replace(/^"|"$/g, ''));

  const headers = parseRow(lines[0]).map(h => h.toLowerCase().trim());

  // Map headers to field names (flexible German/English headers)
  const fieldMap: Record<string, string> = {};
  headers.forEach((h, i) => {
    if (['vorname', 'first_name', 'firstname'].includes(h)) fieldMap.first_name = String(i);
    else if (['nachname', 'last_name', 'lastname', 'name'].includes(h)) fieldMap.last_name = String(i);
    else if (['email', 'e-mail', 'mail'].includes(h)) fieldMap.email = String(i);
    else if (['telefon', 'phone', 'tel'].includes(h)) fieldMap.phone = String(i);
    else if (['notizen', 'notes', 'anmerkungen'].includes(h)) fieldMap.notes = String(i);
    else if (['geschlecht', 'gender', 'anrede'].includes(h)) fieldMap.gender = String(i);
  });

  return lines.slice(1).map(line => {
    const cols = parseRow(line);
    const row: Record<string, string> = {};
    Object.entries(fieldMap).forEach(([field, idx]) => {
      row[field] = cols[Number(idx)] ?? '';
    });
    return row;
  }).filter(row => row.email); // skip rows without email
};

const downloadCsvTemplate = () => {
  const content = 'Vorname;Nachname;Geschlecht;E-Mail;Telefon;Notizen\nMax;Mustermann;m;max@example.com;+49123456789;Beispiel\nMaria;Musterfrau;f;maria@example.com;;';
  const blob = new Blob(['\xEF\xBB\xBF' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'personen_vorlage.csv';
  a.click();
  URL.revokeObjectURL(url);
};

export default function PersonsPage() {
  const { tenant } = useParams<{ tenant: string }>();
  const { user } = useAuth();
  const [persons, setPersons] = useState<Person[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editPerson, setEditPerson] = useState<Person | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // CSV import state
  const [showImport, setShowImport] = useState(false);
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canManage = user?.is_admin || user?.permissions?.create_persons;
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<PersonForm>();

  const load = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      const res = await getPersons(tenant, { page, limit: 50, search });
      setPersons(res.data);
      setTotal(res.total);
      setPages(res.pages);
    } finally {
      setLoading(false);
    }
  }, [tenant, page, search]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditPerson(null);
    reset({});
    setShowForm(true);
  };

  const openEdit = (person: Person) => {
    setEditPerson(person);
    reset({
      first_name: person.first_name,
      last_name: person.last_name,
      gender: person.gender ?? null,
      email: person.email,
      phone: person.phone ?? '',
      notes: person.notes ?? '',
    });
    setShowForm(true);
  };

  const onSubmit = async (data: PersonForm) => {
    if (!tenant) return;
    try {
      if (editPerson) {
        await updatePerson(tenant, editPerson.id, data);
        toast.success('Person aktualisiert');
      } else {
        await createPerson(tenant, data);
        toast.success('Person erstellt');
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
      await deletePerson(tenant, deletingId);
      toast.success('Person gelöscht');
      setDeletingId(null);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Fehler');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCsv(text);
      setCsvRows(rows);
      setImportResult(null);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleImport = async () => {
    if (!tenant || csvRows.length === 0) return;
    setImporting(true);
    try {
      const result = await importPersons(tenant, csvRows);
      setImportResult({ imported: result.imported, skipped: result.skipped });
      toast.success(`${result.imported} Personen importiert`);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Fehler beim Import');
    } finally {
      setImporting(false);
    }
  };

  const closeImport = () => {
    setShowImport(false);
    setCsvRows([]);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <Layout
      title="Personen"
      actions={canManage ? (
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)} className="btn-secondary">
            <ArrowUpTrayIcon className="h-4 w-4" />
            CSV importieren
          </button>
          <button onClick={openCreate} className="btn-primary">
            <PlusIcon className="h-4 w-4" />
            Neue Person
          </button>
        </div>
      ) : undefined}
    >
      {/* Search */}
      <div className="mb-4 relative max-w-sm">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          className="input pl-9"
          placeholder="Suchen nach Name, E-Mail..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      {/* Table */}
      <div className="card p-0">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin h-8 w-8 border-b-2 border-primary-600 rounded-full" />
          </div>
        ) : persons.length === 0 ? (
          <div className="text-center py-12">
            <UserGroupIcon className="h-10 w-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500">Keine Personen gefunden</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-6 py-3 text-left font-medium text-gray-500">Name</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">Geschlecht</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">E-Mail</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">Telefon</th>
                <th className="px-6 py-3 text-left font-medium text-gray-500">Notizen</th>
                {canManage && <th className="w-24 px-6 py-3"></th>}
              </tr>
            </thead>
            <tbody>
              {persons.map((person) => (
                <tr key={person.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-6 py-3 font-medium text-gray-900">
                    {person.first_name} {person.last_name}
                  </td>
                  <td className="px-6 py-3 text-gray-500">
                    {person.gender ? GENDER_LABELS[person.gender] : '–'}
                  </td>
                  <td className="px-6 py-3 text-gray-600">{person.email}</td>
                  <td className="px-6 py-3 text-gray-500">{person.phone ?? '–'}</td>
                  <td className="px-6 py-3 text-gray-500 max-w-xs truncate">{person.notes ?? '–'}</td>
                  {canManage && (
                    <td className="px-6 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(person)} className="p-1.5 rounded text-gray-400 hover:text-primary-600 hover:bg-primary-50">
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button onClick={() => setDeletingId(person.id)} className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50">
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pagination page={page} pages={pages} total={total} limit={50} onPage={setPage} />
      </div>

      {/* Form Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editPerson ? 'Person bearbeiten' : 'Neue Person'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Vorname" required error={errors.first_name?.message}>
              <input {...register('first_name', { required: 'Pflichtfeld' })} className="input" />
            </FormField>
            <FormField label="Nachname" required error={errors.last_name?.message}>
              <input {...register('last_name', { required: 'Pflichtfeld' })} className="input" />
            </FormField>
          </div>
          <FormField label="Geschlecht">
            <select {...register('gender')} className="input">
              <option value="">– keine Angabe –</option>
              <option value="m">Männlich</option>
              <option value="f">Weiblich</option>
              <option value="d">Divers</option>
            </select>
          </FormField>
          <FormField label="E-Mail" required error={errors.email?.message}>
            <input {...register('email', { required: 'Pflichtfeld' })} type="email" className="input" />
          </FormField>
          <FormField label="Telefon">
            <input {...register('phone')} className="input" />
          </FormField>
          <FormField label="Notizen">
            <textarea {...register('notes')} className="input" rows={3} />
          </FormField>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Abbrechen</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary">
              {isSubmitting ? 'Wird gespeichert...' : editPerson ? 'Aktualisieren' : 'Erstellen'}
            </button>
          </div>
        </form>
      </Modal>

      {/* CSV Import Modal */}
      <Modal
        isOpen={showImport}
        onClose={closeImport}
        title="CSV importieren"
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            CSV-Datei mit Spalten: Vorname, Nachname, E-Mail, Telefon (optional), Notizen (optional). Erste Zeile als Überschrift wird übersprungen.
          </p>
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
            />
            <button
              type="button"
              onClick={downloadCsvTemplate}
              className="btn-secondary btn-sm whitespace-nowrap"
            >
              Vorlage herunterladen
            </button>
          </div>

          {csvRows.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">
                Vorschau ({csvRows.length} Zeilen erkannt, erste 5 angezeigt):
              </p>
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Vorname</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Nachname</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Geschlecht</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">E-Mail</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Telefon</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Notizen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csvRows.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="px-3 py-2 text-gray-700">{row.first_name ?? '–'}</td>
                        <td className="px-3 py-2 text-gray-700">{row.last_name ?? '–'}</td>
                        <td className="px-3 py-2 text-gray-500">{row.gender ? (GENDER_LABELS[row.gender] ?? row.gender) : '–'}</td>
                        <td className="px-3 py-2 text-gray-700">{row.email ?? '–'}</td>
                        <td className="px-3 py-2 text-gray-500">{row.phone ?? '–'}</td>
                        <td className="px-3 py-2 text-gray-500 max-w-xs truncate">{row.notes ?? '–'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {importResult && (
            <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
              {importResult.imported} Personen importiert, {importResult.skipped} übersprungen
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button type="button" onClick={closeImport} className="btn-secondary">Schließen</button>
            {csvRows.length > 0 && !importResult && (
              <button
                type="button"
                onClick={handleImport}
                disabled={importing}
                className="btn-primary"
              >
                {importing ? 'Wird importiert...' : `${csvRows.length} Personen importieren`}
              </button>
            )}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        title="Person löschen"
        message="Diese Person und alle zugehörigen Einladungen werden gelöscht."
      />
    </Layout>
  );
}
