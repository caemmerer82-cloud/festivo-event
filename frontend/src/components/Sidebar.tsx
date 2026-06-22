import { NavLink, useParams } from 'react-router-dom';
import {
  HomeIcon,
  CalendarIcon,
  UsersIcon,
  EnvelopeIcon,
  UserGroupIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../contexts/AuthContext';

export default function Sidebar() {
  const { tenant } = useParams<{ tenant: string }>();
  const { user, logout } = useAuth();

  const navItems = [
    { to: `/${tenant}/dashboard`, icon: HomeIcon, label: 'Dashboard', always: true },
    {
      to: `/${tenant}/events`,
      icon: CalendarIcon,
      label: 'Veranstaltungen',
      show: user?.is_admin || user?.permissions?.create_events,
    },
    {
      to: `/${tenant}/persons`,
      icon: UserGroupIcon,
      label: 'Personen',
      show: user?.is_admin || user?.permissions?.create_persons,
    },
    {
      to: `/${tenant}/mails`,
      icon: EnvelopeIcon,
      label: 'E-Mails',
      show: user?.is_admin || user?.permissions?.create_mails || user?.permissions?.send_mails,
    },
    {
      to: `/${tenant}/users`,
      icon: UsersIcon,
      label: 'Benutzer',
      show: user?.is_admin || user?.permissions?.create_users,
    },
    {
      to: `/${tenant}/settings`,
      icon: Cog6ToothIcon,
      label: 'Einstellungen',
      show: user?.is_admin,
    },
  ];

  const visibleItems = navItems.filter(item => item.always || item.show);

  return (
    <aside className="flex flex-col w-64 bg-primary-950 min-h-screen">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-primary-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary-400 rounded-lg flex items-center justify-center">
            <CalendarIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-none">Festivo-Event</p>
            <p className="text-primary-400 text-xs mt-0.5 truncate max-w-[140px]">{user?.tenant_name}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {visibleItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary-700 text-white'
                  : 'text-primary-200 hover:bg-primary-800 hover:text-white'
              }`
            }
          >
            <Icon className="h-5 w-5 flex-shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-primary-800">
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <div className="w-8 h-8 rounded-full bg-primary-700 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-sm font-medium">
              {user?.username?.[0]?.toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-medium truncate">{user?.username}</p>
            <p className="text-primary-400 text-xs">{user?.is_admin ? 'Administrator' : 'Benutzer'}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm font-medium text-primary-200 hover:bg-primary-800 hover:text-white transition-colors"
        >
          <ArrowRightOnRectangleIcon className="h-5 w-5" />
          Abmelden
        </button>
      </div>
    </aside>
  );
}
