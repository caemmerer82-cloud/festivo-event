import { NavLink, useParams, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  HomeIcon,
  CalendarIcon,
  UsersIcon,
  EnvelopeIcon,
  UserGroupIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  ArrowRightOnRectangleIcon,
  BugAntIcon,
  Bars3Icon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../contexts/AuthContext';

export default function Sidebar() {
  const { tenant } = useParams<{ tenant: string }>();
  const { user, logout } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => { setOpen(false); }, [location.pathname]);

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
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed inset-x-0 top-0 z-30 flex items-center justify-between bg-primary-950 px-4 h-14">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-primary-400 rounded-lg flex items-center justify-center">
            <CalendarIcon className="h-4 w-4 text-white" />
          </div>
          <p className="text-white font-semibold text-sm">Festivo-Event</p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="p-2 text-primary-200 hover:text-white"
          aria-label="Menü öffnen"
        >
          <Bars3Icon className="h-6 w-6" />
        </button>
      </div>

      {/* Mobile overlay */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar / drawer */}
      <aside
        className={`flex flex-col w-64 bg-primary-950 min-h-screen fixed inset-y-0 left-0 z-50 transform transition-transform duration-200
          ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:z-auto`}
      >
        {/* Logo */}
        <div className="px-6 py-5 border-b border-primary-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary-400 rounded-lg flex items-center justify-center">
              <CalendarIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm leading-none">Festivo-Event</p>
              <p className="text-primary-400 text-xs mt-0.5 truncate max-w-[140px]">{user?.tenant_name}</p>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="lg:hidden p-1 text-primary-300 hover:text-white"
            aria-label="Menü schließen"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
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
          <a
            href="mailto:bcaemmerer@gmx.de?subject=Festivo-Event%20Bugreport"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-primary-200 hover:bg-primary-800 hover:text-white transition-colors"
          >
            <BugAntIcon className="h-5 w-5 flex-shrink-0" />
            Bugreport
          </a>
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
    </>
  );
}
