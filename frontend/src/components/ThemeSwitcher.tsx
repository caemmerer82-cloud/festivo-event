import { useTheme, THEMES } from '../contexts/ThemeContext';
import { SwatchIcon } from '@heroicons/react/24/outline';

export default function ThemeSwitcher({ variant = 'dark' }: { variant?: 'dark' | 'light' }) {
  const { theme, setTheme } = useTheme();

  const baseClass = variant === 'dark'
    ? 'bg-primary-900 text-primary-100 border-primary-700'
    : 'bg-white text-gray-700 border-gray-300';

  return (
    <label className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border ${baseClass}`}>
      <SwatchIcon className="h-4 w-4 flex-shrink-0" />
      <select
        value={theme}
        onChange={(e) => setTheme(e.target.value as typeof theme)}
        className="bg-transparent border-none focus:outline-none focus:ring-0 text-sm w-full"
      >
        {THEMES.map(({ value, label }) => (
          <option key={value} value={value} className="text-gray-900">
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}
