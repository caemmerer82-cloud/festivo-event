import { useState } from 'react';
import { TrashIcon, ChevronDownIcon, EyeIcon, LinkIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import StatusBadge from './StatusBadge';
import type { EventGuest, GuestStatus } from '../types';

const STATUSES: GuestStatus[] = ['angelegt', 'eingeladen', 'zugesagt', 'abgesagt'];
const statusLabels: Record<GuestStatus, string> = {
  angelegt: 'Angelegt',
  eingeladen: 'Eingeladen',
  zugesagt: 'Zugesagt',
  abgesagt: 'Abgesagt',
};

interface GuestTableProps {
  guests: EventGuest[];
  selectedIds: number[];
  onSelect: (id: number, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  onStatusChange: (guestId: number, status: GuestStatus) => void;
  onRemove: (guestId: number) => void;
  canSetStatus: boolean;
  canRemove: boolean;
  onViewAnswers?: (guest: EventGuest) => void;
  onCopyLink?: (guest: EventGuest) => void;
}

export default function GuestTable({
  guests, selectedIds, onSelect, onSelectAll, onStatusChange, onRemove, canSetStatus, canRemove, onViewAnswers, onCopyLink,
}: GuestTableProps) {
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);

  const allSelected = guests.length > 0 && selectedIds.length === guests.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < guests.length;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="w-10 px-4 py-3 text-left">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => { if (el) el.indeterminate = someSelected; }}
                onChange={(e) => onSelectAll(e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
            </th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">E-Mail</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Eingeladen</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Geantwortet</th>
            <th className="w-16 px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {guests.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                Keine Gäste vorhanden
              </td>
            </tr>
          )}
          {guests.map((guest) => (
            <tr key={guest.id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(guest.id)}
                  onChange={(e) => onSelect(guest.id, e.target.checked)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
              </td>
              <td className="px-4 py-3 font-medium text-gray-900">
                {guest.first_name} {guest.last_name}
              </td>
              <td className="px-4 py-3 text-gray-600">{guest.email}</td>
              <td className="px-4 py-3">
                {canSetStatus ? (
                  <div className="relative">
                    <button
                      onClick={() => setOpenDropdown(openDropdown === guest.id ? null : guest.id)}
                      className="flex items-center gap-1"
                    >
                      <StatusBadge status={guest.status} />
                      <ChevronDownIcon className="h-3.5 w-3.5 text-gray-400" />
                    </button>
                    {openDropdown === guest.id && (
                      <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 z-10 min-w-[140px]">
                        {STATUSES.map((s) => (
                          <button
                            key={s}
                            className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                            onClick={() => {
                              onStatusChange(guest.id, s);
                              setOpenDropdown(null);
                            }}
                          >
                            {statusLabels[s]}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <StatusBadge status={guest.status} />
                )}
              </td>
              <td className="px-4 py-3 text-gray-500">
                {guest.invited_at ? new Date(guest.invited_at).toLocaleDateString('de-DE') : '–'}
              </td>
              <td className="px-4 py-3 text-gray-500">
                {guest.responded_at ? new Date(guest.responded_at).toLocaleDateString('de-DE') : '–'}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1">
                  {['eingeladen', 'zugesagt', 'abgesagt'].includes(guest.status) && guest.invitation_token && (
                    <>
                      {onCopyLink && (
                        <button
                          onClick={() => onCopyLink(guest)}
                          title="RSVP-Link kopieren"
                          className="p-1.5 rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                        >
                          <LinkIcon className="h-4 w-4" />
                        </button>
                      )}
                      <a
                        href={`/rsvp/${guest.invitation_token}`}
                        target="_blank"
                        rel="noreferrer"
                        title="Rückmeldeseite öffnen"
                        className="p-1.5 rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                      >
                        <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                      </a>
                    </>
                  )}
                  {onViewAnswers && guest.status === 'zugesagt' && (
                    <button
                      onClick={() => onViewAnswers(guest)}
                      title="Antworten anzeigen"
                      className="p-1.5 rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                    >
                      <EyeIcon className="h-4 w-4" />
                    </button>
                  )}
                  {canRemove && (
                    <button
                      onClick={() => onRemove(guest.id)}
                      className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
