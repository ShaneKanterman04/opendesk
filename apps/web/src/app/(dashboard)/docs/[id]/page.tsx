'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams } from 'next/navigation';
import Editor from '@/components/Editor';

export default function DocPage() {
  const { id } = useParams();
  const [doc, setDoc] = useState<any>(null);

  useEffect(() => {
    const fetchDoc = async () => {
      const token = localStorage.getItem('token');
      const res = await axios.get(`http://localhost:3001/docs/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDoc(res.data);
    };
    if (id) fetchDoc();
  }, [id]);

  if (!doc) return <div>Loading...</div>;

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="p-6 pb-0">
        <h1 className="mb-4 text-2xl font-bold">{doc.title}</h1>
      </div>
      <Editor docId={doc.id} initialContent={doc.content} />
    </div>
  );
}
