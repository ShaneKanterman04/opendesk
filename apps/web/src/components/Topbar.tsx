'use client';

import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';

export default function Topbar() {
  const { logout } = useAuth();
  const { theme, setTheme, toggleTheme } = useTheme();

  return (
    <header className="flex items-center justify-between bg-surface px-6 py-4 shadow">
      <h1 className="text-xl font-semibold text-primary">Dashboard</h1>
      <div className="flex items-center gap-3">
        <select
          value={theme}
          onChange={(e) => setTheme(e.target.value as any)}
          className="rounded border px-2 py-1 bg-surface"
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="auto">Auto</option>
        </select>
        <button onClick={toggleTheme} className="rounded bg-gray-200 px-3 py-1 hidden sm:inline">Toggle</button>
        <button
          onClick={logout}
          className="rounded bg-red-500 px-4 py-2 text-sm font-bold text-white hover:bg-red-600"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
