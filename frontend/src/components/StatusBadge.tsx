import type { GuestStatus } from '../types';

const statusConfig: Record<GuestStatus, { label: string; classes: string }> = {
  angelegt: { label: 'Angelegt', classes: 'bg-gray-100 text-gray-700' },
  eingeladen: { label: 'Eingeladen', classes: 'bg-blue-100 text-blue-700' },
  zugesagt: { label: 'Zugesagt', classes: 'bg-green-100 text-green-700' },
  abgesagt: { label: 'Abgesagt', classes: 'bg-red-100 text-red-700' },
};

export default function StatusBadge({ status }: { status: GuestStatus }) {
  const config = statusConfig[status] ?? statusConfig.angelegt;
  return (
    <span className={`badge ${config.classes}`}>
      {config.label}
    </span>
  );
}
