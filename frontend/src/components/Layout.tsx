import Sidebar from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  actions?: React.ReactNode;
}

export default function Layout({ children, title, actions }: LayoutProps) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 pt-14 lg:pt-0">
        {(title || actions) && (
          <header className="bg-white border-b border-gray-200 px-4 sm:px-8 py-4 sm:py-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              {title && <h1 className="text-lg sm:text-xl font-semibold text-gray-900">{title}</h1>}
              {actions && <div className="flex items-center gap-2 sm:gap-3 flex-wrap">{actions}</div>}
            </div>
          </header>
        )}
        <div className="flex-1 p-4 sm:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
