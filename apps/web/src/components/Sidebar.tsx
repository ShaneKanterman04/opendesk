import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { HardDrive, FileText, Settings, Shield } from 'lucide-react';

export default function Sidebar() {
  const { user } = useAuth();
  return (
    <aside className="w-64 bg-[var(--sidebar-bg)] text-[var(--sidebar-fg)] flex flex-col h-screen border-r border-white/5">
      <div className="p-6">
        <div className="flex items-center gap-3 text-xl font-bold tracking-tight">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <span className="text-white text-lg">O</span>
          </div>
          OpenDesk
        </div>
      </div>
      
      <nav className="flex-1 px-3 py-4">
        <ul className="space-y-1">
          <li>
            <Link 
              href="/drive" 
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--sidebar-hover)] transition-colors text-sm font-medium"
            >
              <HardDrive size={18} className="text-blue-400" />
              Drive
            </Link>
          </li>
          <li>
            <Link 
              href="/docs" 
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--sidebar-hover)] transition-colors text-sm font-medium"
            >
              <FileText size={18} className="text-orange-400" />
              Docs
            </Link>
          </li>
          {user?.isAdmin && (
            <li>
              <Link 
                href="/admin" 
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--sidebar-hover)] transition-colors text-sm font-medium"
              >
                <Shield size={18} className="text-purple-400" />
                Admin
              </Link>
            </li>
          )}
        </ul>
      </nav>

      <div className="p-4 border-t border-white/5">
        <button className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg hover:bg-[var(--sidebar-hover)] transition-colors text-sm font-medium text-gray-400 hover:text-white">
          <Settings size={18} />
          Settings
        </button>
      </div>
    </aside>
  );
}
