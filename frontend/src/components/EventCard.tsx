import { Link, useParams } from 'react-router-dom';
import { CalendarIcon, MapPinIcon, UsersIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import type { Event } from '../types';

interface EventCardProps {
  event: Event;
  onDelete?: (id: number) => void;
  onEdit?: (event: Event) => void;
}

export default function EventCard({ event, onDelete, onEdit }: EventCardProps) {
  const { tenant } = useParams<{ tenant: string }>();

  return (
    <div className="card hover:shadow-md transition-shadow group">
      {event.banner_path && (
        <div className="h-36 -mx-6 -mt-6 mb-4 rounded-t-xl overflow-hidden bg-gray-100">
          <img
            src={`/api/public/files/${event.banner_path}`}
            alt={event.name}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <Link to={`/${tenant}/events/${event.id}`} className="block group-hover:text-primary-600">
        <h3 className="font-semibold text-gray-900 mb-3 line-clamp-1">{event.name}</h3>
      </Link>

      <div className="space-y-1.5 text-sm text-gray-500">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 flex-shrink-0" />
          <span>{format(new Date(event.event_date), 'dd. MMMM yyyy, HH:mm', { locale: de })} Uhr</span>
        </div>
        {event.location && (
          <div className="flex items-center gap-2">
            <MapPinIcon className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{event.location}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <UsersIcon className="h-4 w-4 flex-shrink-0" />
          <span>
            {event.guest_count ?? 0} Gäste
            {(event.confirmed_count ?? 0) > 0 && (
              <span className="text-green-600 ml-1">· {event.confirmed_count} zugesagt</span>
            )}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
        <Link to={`/${tenant}/events/${event.id}`} className="btn-primary btn-sm">
          Details
        </Link>
        <div className="flex gap-2">
          {onEdit && (
            <button
              onClick={() => onEdit(event)}
              className="btn-secondary btn-sm"
            >
              Bearbeiten
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(event.id)}
              className="btn-secondary btn-sm text-red-600 hover:bg-red-50 border-red-200"
            >
              Löschen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
