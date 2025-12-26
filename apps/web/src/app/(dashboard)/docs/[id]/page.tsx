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
    <div>
      <h1 className="mb-4 text-2xl font-bold">{doc.title}</h1>
      <Editor docId={doc.id} initialContent={doc.content} />
    </div>
  );
}
