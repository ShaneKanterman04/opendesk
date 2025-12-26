import Link from 'next/link';

export default function Sidebar() {
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
        </ul>
      </nav>
    </aside>
  );
}
