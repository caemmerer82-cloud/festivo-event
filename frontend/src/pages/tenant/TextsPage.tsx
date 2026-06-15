import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { getTexts, saveTexts } from '../../api/texts';
import toast from 'react-hot-toast';
import { DocumentTextIcon } from '@heroicons/react/24/outline';

interface TextSlot {
  key: string;
  label: string;
  description: string;
  default: string;
  multiline?: boolean;
  html?: boolean;
  placeholders?: string[];
}

const ALL_PLACEHOLDERS = [
  '{{first_name}}', '{{last_name}}',
  '{{salutation_formal}}', '{{salutation_friendly}}',
  '{{event_name}}', '{{event_date}}', '{{event_location}}',
];

const HTML_TAGS = ['<h1>', '<h2>', '<h3>', '<h4>', '<p>', '<strong>', '<em>', '<br />'];

const TEXT_SLOTS: { group: string; slots: TextSlot[] }[] = [
  {
    group: 'Rückmeldeseite – Einladung',
    slots: [
      {
        key: 'rsvp_label',
        label: 'Label über dem Eventnamen',
        description: 'Kleine Beschriftung ganz oben (z.B. "Einladung" oder "Sie sind eingeladen").',
        default: 'Einladung',
      },
      {
        key: 'rsvp_greeting',
        label: 'Begrüßungsbereich',
        description: 'Vollständiger Begrüßungsbereich der Rückmeldeseite. Unterstützt HTML (H1–H4, p, strong, em, br).',
        default: '<h1>{{event_name}}</h1>\n<p>{{salutation_friendly}},</p>\n<p>Sie sind herzlich eingeladen! Bitte teilen Sie uns mit, ob Sie teilnehmen können.</p>',
        multiline: true,
        html: true,
        placeholders: ALL_PLACEHOLDERS,
      },
    ],
  },
  {
    group: 'Rückmeldeseite – Anmeldeformular',
    slots: [
      {
        key: 'rsvp_form_title',
        label: 'Formular-Titel',
        description: 'Überschrift des Fragebogens bei der Zusage.',
        default: 'Ihre Angaben',
        placeholders: ALL_PLACEHOLDERS,
      },
      {
        key: 'rsvp_form_subtitle',
        label: 'Formular-Untertitel',
        description: 'Erklärungstext unterhalb des Formular-Titels.',
        default: 'Bitte füllen Sie das Formular aus, um Ihre Zusage zu bestätigen.',
        multiline: true,
        placeholders: ALL_PLACEHOLDERS,
      },
    ],
  },
  {
    group: 'Rückmeldeseite – Bestätigungsseiten',
    slots: [
      {
        key: 'rsvp_confirm_title',
        label: 'Zusage: Titel',
        description: 'Überschrift nach erfolgreicher Zusage.',
        default: 'Vielen Dank!',
        placeholders: ALL_PLACEHOLDERS,
      },
      {
        key: 'rsvp_confirm_text',
        label: 'Zusage: Text',
        description: 'Text nach erfolgreicher Zusage.',
        default: 'Ihre Zusage wurde erfolgreich gespeichert.',
        multiline: true,
        placeholders: ALL_PLACEHOLDERS,
      },
      {
        key: 'rsvp_decline_title',
        label: 'Absage: Titel',
        description: 'Überschrift nach einer Absage.',
        default: 'Schade!',
        placeholders: ALL_PLACEHOLDERS,
      },
      {
        key: 'rsvp_decline_text',
        label: 'Absage: Text',
        description: 'Text nach einer Absage.',
        default: 'Ihre Absage wurde gespeichert. Wir hoffen, Sie beim nächsten Mal begrüßen zu dürfen.',
        multiline: true,
        placeholders: ALL_PLACEHOLDERS,
      },
    ],
  },
];

// ── Extracted component so useRef/useState are called at top level ──────────
function SlotField({
  slot,
  value,
  isCustom,
  onChange,
  onReset,
}: {
  slot: TextSlot;
  value: string;
  isCustom: boolean;
  onChange: (v: string) => void;
  onReset: () => void;
}) {
  const [showPreview, setShowPreview] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const insert = (text: string) => {
    const el = taRef.current;
    if (!el) { onChange(value + text); return; }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    onChange(value.slice(0, start) + text + value.slice(end));
    setTimeout(() => {
      el.selectionStart = el.selectionEnd = start + text.length;
      el.focus();
    }, 0);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-1">
        <div className="flex-1 min-w-0">
          <label className="block text-sm font-medium text-gray-700">
            {slot.label}
            {isCustom && (
              <span className="ml-2 text-xs font-normal text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded">
                angepasst
              </span>
            )}
            {slot.html && (
              <span className="ml-2 text-xs font-normal text-gray-400">HTML</span>
            )}
          </label>
          <p className="text-xs text-gray-500 mt-0.5">{slot.description}</p>
        </div>
        <div className="flex items-center gap-2 ml-4 mt-0.5 flex-shrink-0">
          {slot.html && (
            <button
              type="button"
              onClick={() => setShowPreview(p => !p)}
              className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                showPreview
                  ? 'border-primary-400 text-primary-600 bg-primary-50'
                  : 'border-gray-200 text-gray-400 hover:text-gray-600'
              }`}
            >
              Vorschau
            </button>
          )}
          <button
            type="button"
            onClick={onReset}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Zurücksetzen
          </button>
        </div>
      </div>

      {/* Placeholder / tag buttons */}
      {(slot.placeholders || slot.html) && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {slot.placeholders?.map(p => (
            <button
              key={p}
              type="button"
              onClick={() => insert(p)}
              className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded font-mono transition-colors"
            >
              {p}
            </button>
          ))}
          {slot.html && HTML_TAGS.map(tag => (
            <button
              key={tag}
              type="button"
              onClick={() => insert(tag)}
              className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded font-mono transition-colors"
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Editor / preview */}
      {showPreview ? (
        <div
          className="border border-gray-200 rounded-lg p-4 bg-white min-h-[80px] prose prose-sm max-w-none [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:text-lg [&_h3]:font-semibold [&_h4]:text-base [&_h4]:font-semibold"
          dangerouslySetInnerHTML={{ __html: value }}
        />
      ) : slot.multiline ? (
        <textarea
          ref={taRef}
          className={`input text-sm ${slot.html ? 'font-mono' : ''}`}
          rows={slot.html ? 8 : 3}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={slot.default}
          spellCheck={!slot.html}
        />
      ) : (
        <input
          type="text"
          className="input text-sm"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={slot.default}
        />
      )}
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function TextsPage() {
  const { tenant, eventId } = useParams<{ tenant: string; eventId: string }>();
  const navigate = useNavigate();
  const eventIdNum = Number(eventId);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!tenant || !eventIdNum) return;
    getTexts(tenant, eventIdNum)
      .then(setValues)
      .finally(() => setLoading(false));
  }, [tenant, eventIdNum]);

  const getValue = (key: string, defaultValue: string) =>
    values[key] !== undefined ? values[key] : defaultValue;

  const setValue = (key: string, value: string) =>
    setValues(prev => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    if (!tenant || !eventIdNum) return;
    setSaving(true);
    try {
      await saveTexts(tenant, eventIdNum, values);
      toast.success('Texte gespeichert');
    } catch {
      toast.error('Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout title="Texte">
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-b-2 border-primary-600 rounded-full" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      title="Texte"
      actions={
        <div className="flex gap-2">
          <button onClick={() => navigate(`/${tenant}/events/${eventId}`)} className="btn-secondary">
            ← Zurück zum Event
          </button>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? 'Wird gespeichert...' : 'Speichern'}
          </button>
        </div>
      }
    >
      <div className="space-y-8">
        <p className="text-sm text-gray-500">
          Passen Sie die Texte auf der Rückmeldeseite an. Lassen Sie ein Feld leer oder klicken Sie
          auf „Zurücksetzen", um den Standardtext zu verwenden.
        </p>

        {TEXT_SLOTS.map(({ group, slots }) => (
          <div key={group} className="card">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4 flex items-center gap-2">
              <DocumentTextIcon className="h-4 w-4 text-primary-500" />
              {group}
            </h2>
            <div className="space-y-5">
              {slots.map(slot => (
                <SlotField
                  key={slot.key}
                  slot={slot}
                  value={getValue(slot.key, slot.default)}
                  isCustom={values[slot.key] !== undefined && values[slot.key] !== slot.default}
                  onChange={v => setValue(slot.key, v)}
                  onReset={() => setValues(prev => ({ ...prev, [slot.key]: slot.default }))}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
