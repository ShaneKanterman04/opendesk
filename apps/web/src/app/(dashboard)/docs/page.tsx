'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Doc {
  id: string;
  title: string;
  updatedAt: string;
}

export default function DocsListPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const router = useRouter();

  useEffect(() => {
    const fetchDocs = async () => {
      const token = localStorage.getItem('token');
      const res = await axios.get('http://localhost:3001/docs', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDocs(res.data);
    };
    fetchDocs();
  }, []);

  const createDoc = async () => {
    const title = prompt('Document Title:');
    if (!title) return;
    const token = localStorage.getItem('token');
    const res = await axios.post(
      'http://localhost:3001/docs',
      { title },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    router.push(`/docs/${res.data.id}`);
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold">My Documents</h2>
        <button
          onClick={createDoc}
          className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
        >
          New Document
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {docs.map((doc) => (
          <Link key={doc.id} href={`/docs/${doc.id}`}>
            <div className="cursor-pointer rounded border bg-white p-4 hover:shadow-md">
              <div className="text-4xl text-blue-400">📝</div>
              <div className="mt-2 truncate font-medium">{doc.title}</div>
              <div className="text-xs text-gray-500">
                {new Date(doc.updatedAt).toLocaleDateString()}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
