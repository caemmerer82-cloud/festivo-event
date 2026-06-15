import { useState } from 'react';
import { PlusIcon, TrashIcon, Bars3Icon } from '@heroicons/react/24/outline';
import type { Question, QuestionType } from '../types';
import FormField from './FormField';

const typeLabels: Record<QuestionType, string> = {
  text: 'Freitext',
  dropdown: 'Dropdown',
  radio: 'Einfachauswahl (Radio)',
  checkbox: 'Mehrfachauswahl (Checkbox)',
};

interface QuestionEditorProps {
  questions: Question[];
  onAdd: (q: Partial<Question>) => Promise<void>;
  onUpdate: (id: number, q: Partial<Question>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onReorder: (order: { id: number; sort_order: number }[]) => Promise<void>;
}

interface QuestionFormState {
  question_text: string;
  question_type: QuestionType;
  options: string[];
  is_required: boolean;
}

const defaultForm: QuestionFormState = {
  question_text: '',
  question_type: 'text',
  options: [''],
  is_required: false,
};

export default function QuestionEditor({ questions, onAdd, onUpdate, onDelete, onReorder }: QuestionEditorProps) {
  const [form, setForm] = useState<QuestionFormState>(defaultForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const needsOptions = (type: QuestionType) => ['dropdown', 'radio', 'checkbox'].includes(type);

  const handleSubmit = async () => {
    if (!form.question_text.trim()) return;
    setSaving(true);
    try {
      const payload: Partial<Question> = {
        question_text: form.question_text,
        question_type: form.question_type,
        is_required: form.is_required,
        options: needsOptions(form.question_type) ? form.options.filter(o => o.trim()) : undefined,
        sort_order: editingId ? undefined : questions.length,
      };

      if (editingId) {
        await onUpdate(editingId, payload);
        setEditingId(null);
      } else {
        await onAdd(payload);
      }
      setForm(defaultForm);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (q: Question) => {
    setEditingId(q.id);
    setForm({
      question_text: q.question_text,
      question_type: q.question_type,
      options: q.options ?? [''],
      is_required: q.is_required,
    });
  };

  const handleDragStart = (index: number) => setDragIndex(index);
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    const newOrder = [...questions];
    const [moved] = newOrder.splice(dragIndex, 1);
    newOrder.splice(index, 0, moved);
    onReorder(newOrder.map((q, i) => ({ id: q.id, sort_order: i })));
    setDragIndex(index);
  };

  return (
    <div className="space-y-4">
      {/* Existing questions */}
      <div className="space-y-2">
        {questions.map((q, idx) => (
          <div
            key={q.id}
            draggable
            onDragStart={() => handleDragStart(idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 cursor-move group"
          >
            <Bars3Icon className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm text-gray-900">{q.question_text}</span>
                {q.is_required && (
                  <span className="text-xs text-red-500 font-medium">Pflicht</span>
                )}
                <span className="text-xs text-gray-400 bg-white border border-gray-200 rounded px-1.5 py-0.5">
                  {typeLabels[q.question_type]}
                </span>
              </div>
              {q.options && q.options.length > 0 && (
                <p className="text-xs text-gray-500 mt-1">{q.options.join(', ')}</p>
              )}
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => startEdit(q)}
                className="btn-secondary btn-sm"
              >
                Bearbeiten
              </button>
              <button
                onClick={() => onDelete(q.id)}
                className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
        {questions.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-6">Noch keine Fragen angelegt</p>
        )}
      </div>

      {/* Add/Edit form */}
      <div className="border border-primary-200 rounded-lg p-4 bg-primary-50">
        <h4 className="text-sm font-semibold text-primary-800 mb-3">
          {editingId ? 'Frage bearbeiten' : 'Neue Frage'}
        </h4>
        <div className="space-y-3">
          <FormField label="Fragetext" required>
            <input
              className="input"
              placeholder="z.B. Haben Sie besondere Ernährungswünsche?"
              value={form.question_text}
              onChange={(e) => setForm({ ...form, question_text: e.target.value })}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Fragetyp">
              <select
                className="input"
                value={form.question_type}
                onChange={(e) => setForm({ ...form, question_type: e.target.value as QuestionType })}
              >
                {(Object.keys(typeLabels) as QuestionType[]).map(t => (
                  <option key={t} value={t}>{typeLabels[t]}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Pflichtfrage">
              <label className="flex items-center gap-2 mt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_required}
                  onChange={(e) => setForm({ ...form, is_required: e.target.checked })}
                  className="rounded border-gray-300 text-primary-600"
                />
                <span className="text-sm text-gray-700">Ja, Pflichtfeld</span>
              </label>
            </FormField>
          </div>

          {needsOptions(form.question_type) && (
            <FormField label="Antwortoptionen" required>
              <div className="space-y-2">
                {form.options.map((opt, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      className="input flex-1"
                      placeholder={`Option ${i + 1}`}
                      value={opt}
                      onChange={(e) => {
                        const opts = [...form.options];
                        opts[i] = e.target.value;
                        setForm({ ...form, options: opts });
                      }}
                    />
                    {form.options.length > 1 && (
                      <button
                        onClick={() => setForm({ ...form, options: form.options.filter((_, j) => j !== i) })}
                        className="p-2 text-gray-400 hover:text-red-500"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => setForm({ ...form, options: [...form.options, ''] })}
                  className="btn-secondary btn-sm"
                >
                  <PlusIcon className="h-4 w-4" />
                  Option hinzufügen
                </button>
              </div>
            </FormField>
          )}

          <div className="flex gap-2 pt-2">
            <button onClick={handleSubmit} disabled={saving} className="btn-primary btn-sm">
              {saving ? 'Wird gespeichert...' : editingId ? 'Aktualisieren' : 'Hinzufügen'}
            </button>
            {editingId && (
              <button
                onClick={() => { setEditingId(null); setForm(defaultForm); }}
                className="btn-secondary btn-sm"
              >
                Abbrechen
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
