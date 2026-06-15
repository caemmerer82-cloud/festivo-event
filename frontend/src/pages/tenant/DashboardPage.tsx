import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import { CalendarIcon, UserGroupIcon, EnvelopeIcon, CheckCircleIcon, ClockIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../api/axios';

interface DashboardStats {
  events: number;
  persons: number;
  total_invitations: number;
  total_confirmed: number;
  total_declined: number;
  total_invited: number;
  upcoming_events: Array<{
    id: number; name: string; event_date: string; location?: string;
    guest_count: number; confirmed_count: number; invited_count: number;
  }>;
  recent_events: Array<{
    id: number; name: string; event_date: string; location?: string;
    guest_count: number; confirmed_count: number;
  }>;
}

export default function DashboardPage() {
  const { tenant } = useParams<{ tenant: string }>();
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenant) return;
    api.get(`/${tenant}/stats`)
      .then(res => setStats(res.data.data))
      .finally(() => setLoading(false));
  }, [tenant]);

  const statCards = stats ? [
    { label: 'Veranstaltungen', value: stats.events, icon: CalendarIcon, color: 'bg-indigo-100 text-indigo-700', link: `/${tenant}/events` },
    { label: 'Personen', value: stats.persons, icon: UserGroupIcon, color: 'bg-emerald-100 text-emerald-700', link: `/${tenant}/persons` },
    { label: 'Einladungen', value: stats.total_invitations, icon: EnvelopeIcon, color: 'bg-amber-100 text-amber-700', link: null },
    { label: 'Zusagen', value: stats.total_confirmed, icon: CheckCircleIcon, color: 'bg-green-100 text-green-700', link: null },
  ] : [];

  return (
    <Layout title={`Willkommen, ${user?.username}!`}>
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin h-8 w-8 border-b-2 border-indigo-600 rounded-full" />
        </div>
      ) : stats ? (
        <div className="space-y-8">
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map(({ label, value, icon: Icon, color, link }) => {
              const content = (
                <div className={`card hover:shadow-md transition-shadow ${link ? 'cursor-pointer' : ''}`}>
                  <div className={`inline-flex p-2.5 rounded-xl ${color} mb-3`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{value}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{label}</p>
                </div>
              );
              return link ? (
                <Link key={label} to={link}>{content}</Link>
              ) : (
                <div key={label}>{content}</div>
              );
            })}
          </div>

          {/* Upcoming events */}
          {stats.upcoming_events.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <ClockIcon className="h-5 w-5 text-indigo-500" />
                  Bevorstehende Veranstaltungen
                </h2>
                <Link to={`/${tenant}/events`} className="text-sm text-indigo-600 hover:underline">Alle anzeigen</Link>
              </div>
              <div className="card p-0 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-5 py-3 text-left font-medium text-gray-500">Veranstaltung</th>
                      <th className="px-5 py-3 text-left font-medium text-gray-500">Datum</th>
                      <th className="px-5 py-3 text-right font-medium text-gray-500">Gäste</th>
                      <th className="px-5 py-3 text-right font-medium text-gray-500">Ausstehend</th>
                      <th className="px-5 py-3 text-right font-medium text-gray-500">Zugesagt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.upcoming_events.map(ev => (
                      <tr key={ev.id} className="border-b border-gray-100 hover:bg-gray-50 last:border-0">
                        <td className="px-5 py-3">
                          <Link to={`/${tenant}/events/${ev.id}`} className="font-medium text-indigo-600 hover:underline">{ev.name}</Link>
                          {ev.location && <p className="text-xs text-gray-400 mt-0.5">{ev.location}</p>}
                        </td>
                        <td className="px-5 py-3 text-gray-600 whitespace-nowrap">
                          {format(new Date(ev.event_date), 'dd.MM.yyyy HH:mm', { locale: de })}
                        </td>
                        <td className="px-5 py-3 text-gray-600 text-right">{ev.guest_count}</td>
                        <td className="px-5 py-3 text-amber-600 text-right font-medium">{ev.invited_count}</td>
                        <td className="px-5 py-3 text-green-600 text-right font-medium">{ev.confirmed_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Recent events */}
          {stats.recent_events.length > 0 && (
            <div>
              <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-gray-400" />
                Vergangene Veranstaltungen
              </h2>
              <div className="card p-0 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-5 py-3 text-left font-medium text-gray-500">Veranstaltung</th>
                      <th className="px-5 py-3 text-left font-medium text-gray-500">Datum</th>
                      <th className="px-5 py-3 text-right font-medium text-gray-500">Gäste</th>
                      <th className="px-5 py-3 text-right font-medium text-gray-500">Zugesagt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recent_events.map(ev => (
                      <tr key={ev.id} className="border-b border-gray-100 hover:bg-gray-50 last:border-0">
                        <td className="px-5 py-3">
                          <Link to={`/${tenant}/events/${ev.id}`} className="font-medium text-indigo-600 hover:underline">{ev.name}</Link>
                          {ev.location && <p className="text-xs text-gray-400 mt-0.5">{ev.location}</p>}
                        </td>
                        <td className="px-5 py-3 text-gray-600 whitespace-nowrap">
                          {format(new Date(ev.event_date), 'dd.MM.yyyy', { locale: de })}
                        </td>
                        <td className="px-5 py-3 text-gray-600 text-right">{ev.guest_count}</td>
                        <td className="px-5 py-3 text-green-600 text-right font-medium">{ev.confirmed_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {stats.events === 0 && (
            <div className="card text-center py-16">
              <CalendarIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-lg font-medium text-gray-500">Noch keine Veranstaltungen</p>
              <Link to={`/${tenant}/events`} className="btn-primary mt-4 inline-flex">
                Erste Veranstaltung erstellen
              </Link>
            </div>
          )}
        </div>
      ) : null}
    </Layout>
  );
}
