import { useState, useEffect, memo } from 'react';
import { useParams } from 'react-router-dom';
import { getInvitation, submitRsvp } from '../../api/rsvp';
import type { RsvpInvitation, Question } from '../../types';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  CalendarIcon, MapPinIcon, PaperClipIcon,
  CheckCircleIcon, XCircleIcon, ChevronRightIcon,
} from '@heroicons/react/24/outline';
import toast, { Toaster } from 'react-hot-toast';

type Step = 'loading' | 'error' | 'expired' | 'invitation' | 'form' | 'confirmed' | 'declined';

const t = (texts: Record<string, string>, key: string, fallback: string) =>
  texts[key] !== undefined && texts[key] !== '' ? texts[key] : fallback;

const Wrapper = ({ ev, children }: { ev?: RsvpInvitation['event']; children: React.ReactNode }) => (
  <div className="min-h-screen bg-gray-50">
    <Toaster position="top-center" />
    {ev?.banner_url && (
      <div className="w-full bg-gray-100 flex justify-center">
        <img
          src={ev.banner_url}
          alt={ev.name}
          className="max-w-xl w-full object-contain"
        />
      </div>
    )}
    <div className="max-w-xl mx-auto px-4 py-8">
      {children}
    </div>
  </div>
);

export default function RsvpPage() {
  const { token } = useParams<{ token: string }>();
  const [step, setStep] = useState<Step>('loading');
  const [invitation, setInvitation] = useState<RsvpInvitation | null>(null);
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [answers, setAnswers] = useState<Record<number, string | string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) return;
    getInvitation(token)
      .then((data) => {
        setInvitation(data);
        if (data.texts) setTexts(data.texts);
        if (data.existing_answers && Object.keys(data.existing_answers).length > 0) {
          const processed: Record<number, string | string[]> = {};
          for (const [qId, answer] of Object.entries(data.existing_answers)) {
            const question = data.questions.find(q => q.id === Number(qId));
            processed[Number(qId)] = question?.question_type === 'checkbox' && typeof answer === 'string'
              ? answer.split(', ').filter(Boolean)
              : answer;
          }
          setAnswers(processed);
        }
        setStep('invitation');
      })
      .catch((err) => {
        const status = err?.response?.status;
        if (status === 410) setStep('expired');
        else { setErrorMsg(err?.response?.data?.message ?? 'Unbekannter Fehler'); setStep('error'); }
      });
  }, [token]);

  const handleDecline = async () => {
    if (!token) return;
    setSubmitting(true);
    try {
      await submitRsvp(token, false, {});
      setStep('declined');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Fehler beim Absenden');
    } finally { setSubmitting(false); }
  };

  const handleAccept = () => {
    if (!invitation) return;
    if (invitation.questions.length === 0) {
      submitAccept({});
    } else {
      setStep('form');
    }
  };

  const submitAccept = async (ans: Record<number, string | string[]>) => {
    if (!token) return;
    setSubmitting(true);
    try {
      await submitRsvp(token, true, ans);
      setStep('confirmed');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Fehler beim Absenden');
    } finally { setSubmitting(false); }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (invitation) {
      for (const q of invitation.questions) {
        if (q.is_required) {
          const ans = answers[q.id];
          if (!ans || (Array.isArray(ans) && ans.length === 0) || ans === '') {
            toast.error(`Bitte beantworten Sie: "${q.question_text}"`);
            return;
          }
        }
      }
    }
    submitAccept(answers);
  };

  const updateAnswer = (id: number, val: string | string[]) => {
    setAnswers(prev => ({ ...prev, [id]: val }));
  };

  const toArray = (val: string | string[] | undefined): string[] => {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string' && val) return val.split(', ').filter(Boolean);
    return [];
  };

  const toggleCheckbox = (id: number, option: string) => {
    const current = toArray(answers[id]);
    const updated = current.includes(option)
      ? current.filter(v => v !== option)
      : [...current, option];
    updateAnswer(id, updated);
  };

  const ev = invitation?.event;

  if (step === 'loading') return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin h-10 w-10 border-b-2 border-indigo-600 rounded-full" />
    </div>
  );

  if (step === 'error') return (
    <Wrapper ev={ev}>
      <div className="card text-center py-12">
        <XCircleIcon className="h-14 w-14 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Fehler</h2>
        <p className="text-gray-500">{errorMsg || 'Die Einladung konnte nicht geladen werden.'}</p>
      </div>
    </Wrapper>
  );

  if (step === 'expired') return (
    <Wrapper ev={ev}>
      <div className="card text-center py-12">
        <XCircleIcon className="h-14 w-14 text-amber-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Link abgelaufen</h2>
        <p className="text-gray-500">Dieser Einladungslink ist nicht mehr gültig. Bitte wenden Sie sich an den Veranstalter.</p>
      </div>
    </Wrapper>
  );

  if (step === 'confirmed') return (
    <Wrapper ev={ev}>
      <div className="card text-center py-12">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircleIcon className="h-10 w-10 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {t(texts, 'rsvp_confirm_title', 'Vielen Dank!')}
        </h2>
        <p className="text-gray-600 mb-1 whitespace-pre-line">
          {t(texts, 'rsvp_confirm_text', 'Ihre Zusage wurde erfolgreich gespeichert.')}
        </p>
      </div>
    </Wrapper>
  );

  if (step === 'declined') return (
    <Wrapper ev={ev}>
      <div className="card text-center py-12">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <XCircleIcon className="h-10 w-10 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {t(texts, 'rsvp_decline_title', 'Schade!')}
        </h2>
        <p className="text-gray-600 whitespace-pre-line">
          {t(texts, 'rsvp_decline_text', 'Ihre Absage wurde gespeichert. Wir hoffen, Sie beim nächsten Mal begrüßen zu dürfen.')}
        </p>
      </div>
    </Wrapper>
  );

  if (!invitation || !ev) return null;

  if (step === 'form') return (
    <Wrapper ev={ev}>
      <div className="mb-4">
        <button onClick={() => setStep('invitation')} className="text-sm text-indigo-600 hover:underline flex items-center gap-1">
          ← Zurück
        </button>
      </div>
      <div className="card">
        <h2 className="text-lg font-bold text-gray-900 mb-1">
          {t(texts, 'rsvp_form_title', 'Ihre Angaben')}
        </h2>
        <p className="text-sm text-gray-500 mb-5">
          {t(texts, 'rsvp_form_subtitle', 'Bitte füllen Sie das Formular aus, um Ihre Zusage zu bestätigen.')}
        </p>
        <form onSubmit={handleFormSubmit} className="space-y-5">
          {invitation.questions.map((q) => (
            <QuestionField
              key={q.id}
              question={q}
              value={answers[q.id]}
              onChange={(val) => updateAnswer(q.id, val)}
              onToggleCheckbox={(opt) => toggleCheckbox(q.id, opt)}
            />
          ))}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setStep('invitation')} className="btn-secondary flex-1">Zurück</button>
            <button type="submit" disabled={submitting} className="btn-primary flex-1">
              {submitting ? 'Wird gesendet...' : 'Zusagen & absenden'}
            </button>
          </div>
        </form>
      </div>
    </Wrapper>
  );

  // Main invitation view
  return (
    <Wrapper ev={ev}>
      {/* Greeting */}
      <div
        className="mb-5 prose prose-sm max-w-none [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-gray-900 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-gray-800 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-gray-800 [&_h4]:text-base [&_h4]:font-semibold [&_h4]:text-gray-700 [&_p]:text-gray-600 [&_p]:text-sm"
        dangerouslySetInnerHTML={{
          __html: t(
            texts,
            'rsvp_greeting',
            `<h1>${ev.name}</h1><p>Hallo ${invitation.guest.first_name} ${invitation.guest.last_name},</p><p>Sie sind herzlich eingeladen! Bitte teilen Sie uns mit, ob Sie teilnehmen können.</p>`
          ),
        }}
      />

      {/* Event details card */}
      <div className="card mb-5">
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-3 text-gray-700">
            <CalendarIcon className="h-5 w-5 text-indigo-500 flex-shrink-0" />
            <span>{format(new Date(ev.event_date), "EEEE, dd. MMMM yyyy 'um' HH:mm 'Uhr'", { locale: de })}</span>
          </div>
          {ev.location && (
            <div className="flex items-center gap-3 text-gray-700">
              <MapPinIcon className="h-5 w-5 text-indigo-500 flex-shrink-0" />
              <span>{ev.location}</span>
            </div>
          )}
          {ev.has_attachment && token && (
            <div className="flex items-center gap-3">
              <PaperClipIcon className="h-5 w-5 text-indigo-500 flex-shrink-0" />
              <a href={`/api/rsvp/${token}/attachment`} className="text-indigo-600 hover:underline text-sm" target="_blank" rel="noreferrer">
                {ev.attachment_filename ?? 'Anhang herunterladen'}
              </a>
            </div>
          )}
        </div>
        {ev.description && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-600 whitespace-pre-line">{ev.description}</p>
          </div>
        )}
      </div>

      {/* Already responded notice */}
      {(invitation.guest.status === 'zugesagt' || invitation.guest.status === 'abgesagt') && (
        <div className={`flex items-start gap-3 px-4 py-3 rounded-xl text-sm ${
          invitation.guest.status === 'zugesagt'
            ? 'bg-green-50 border border-green-200 text-green-800'
            : 'bg-gray-50 border border-gray-200 text-gray-600'
        }`}>
          {invitation.guest.status === 'zugesagt'
            ? <CheckCircleIcon className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
            : <XCircleIcon className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
          }
          <span>
            Sie haben bereits <strong>{invitation.guest.status === 'zugesagt' ? 'zugesagt' : 'abgesagt'}</strong>.
            Sie können Ihre Antwort jederzeit ändern.
          </span>
        </div>
      )}

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={handleDecline}
          disabled={submitting}
          className="btn-secondary py-3 justify-center flex items-center gap-2"
        >
          <XCircleIcon className="h-5 w-5 text-gray-400" />
          Absagen
        </button>
        <button
          onClick={handleAccept}
          disabled={submitting}
          className="btn-primary py-3 justify-center flex items-center gap-2"
        >
          <CheckCircleIcon className="h-5 w-5" />
          Zusagen
          {invitation.questions.length > 0 && <ChevronRightIcon className="h-4 w-4 ml-1" />}
        </button>
      </div>
    </Wrapper>
  );
}

const QuestionField = memo(function QuestionField({
  question, value, onChange, onToggleCheckbox
}: {
  question: Question;
  value: string | string[] | undefined;
  onChange: (val: string | string[]) => void;
  onToggleCheckbox: (option: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {question.question_text}
        {question.is_required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {question.question_type === 'text' && (
        <textarea
          className="input"
          rows={3}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          required={question.is_required}
        />
      )}
      {question.question_type === 'dropdown' && (
        <select
          className="input"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          required={question.is_required}
        >
          <option value="">Bitte wählen...</option>
          {question.options?.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )}
      {question.question_type === 'radio' && (
        <div className="space-y-2">
          {question.options?.map((opt) => (
            <label key={opt} className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="radio"
                name={`q_${question.id}`}
                value={opt}
                checked={(value as string) === opt}
                onChange={(e) => onChange(e.target.value)}
                className="text-indigo-600"
                required={question.is_required}
              />
              <span className="text-sm text-gray-700">{opt}</span>
            </label>
          ))}
        </div>
      )}
      {question.question_type === 'checkbox' && (
        <div className="space-y-2">
          {question.options?.map((opt) => (
            <label key={opt} className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={
                  Array.isArray(value)
                    ? value.includes(opt)
                    : typeof value === 'string'
                      ? value.split(', ').includes(opt)
                      : false
                }
                onChange={() => onToggleCheckbox(opt)}
                className="rounded text-indigo-600"
              />
              <span className="text-sm text-gray-700">{opt}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
});
