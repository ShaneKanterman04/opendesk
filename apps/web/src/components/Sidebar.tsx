import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

export default function Sidebar() {
  const { user } = useAuth();
  return (
    <aside className="w-64 bg-gray-800 text-white">
      <div className="p-4 text-xl font-bold">OpenDesk</div>
      <nav className="mt-4">
        <ul>
          <li>
            <Link href="/drive" className="block px-4 py-2 hover:bg-gray-700">
              Drive
            </Link>
          </li>
          <li>
            <Link href="/docs" className="block px-4 py-2 hover:bg-gray-700">
              Docs
            </Link>
          </li>
          {user?.isAdmin && (
            <li>
              <Link href="/(dashboard)/admin" className="block px-4 py-2 hover:bg-gray-700">
                Admin
              </Link>
            </li>
          )}
        </ul>
      </nav>
    </aside>
  );
}
