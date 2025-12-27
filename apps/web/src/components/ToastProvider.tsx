"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';

type Toast = { id: string; message: string };

const ToastContext = createContext<{ push: (msg: string) => void } | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    // expose a global convenience function used by existing code
    (window as any).toast = (msg: string) => setToasts((t) => [...t, { id: String(Date.now()), message: msg }]);
    return () => { (window as any).toast = undefined; };
  }, []);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) =>
      setTimeout(() => setToasts((cur) => cur.filter((x) => x.id !== t.id)), 3000)
    );
    return () => timers.forEach((id) => clearTimeout(id));
  }, [toasts]);

  const push = (msg: string) => setToasts((t) => [...t, { id: String(Date.now()), message: msg }]);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="fixed right-4 bottom-6 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className="rounded-md bg-gray-900 text-white px-4 py-2 shadow">{t.message}</div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
