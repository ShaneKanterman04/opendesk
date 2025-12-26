'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';

interface Folder {
  id: string;
  name: string;
}

interface File {
  id: string;
  name: string;
  url: string;
}

export default function DrivePage() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [docs, setDocs] = useState<{ id: string; title: string }[]>([]);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const { user } = useAuth();

  const fetchContents = async (folderId?: string) => {
    const token = localStorage.getItem('token');
    const res = await axios.get(`http://localhost:3001/drive/list`, {
      params: { folderId },
      headers: { Authorization: `Bearer ${token}` },
    });
    setFolders(res.data.folders);
    setFiles(res.data.files);
    setDocs(res.data.docs || []);
    setCurrentFolder(folderId || null);
  };

  useEffect(() => {
    fetchContents();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    setUploading(true);
    const file = e.target.files[0];
    const token = localStorage.getItem('token');

    try {
      // 1. Init upload
      const initRes = await axios.post(
        'http://localhost:3001/drive/upload/init',
        {
          name: file.name,
          size: file.size,
          mimeType: file.type,
          folderId: currentFolder,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // 2. Upload to MinIO
      await axios.put(initRes.data.uploadUrl, file, {
        headers: { 'Content-Type': file.type },
      });

      // 3. Finalize (optional, but good practice)
      await axios.post(
        'http://localhost:3001/drive/upload/finalize',
        { fileId: initRes.data.file.id },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      fetchContents(currentFolder || undefined);
    } catch (err) {
      console.error(err);
      alert('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const createFolder = async () => {
    const name = prompt('Folder name:');
    if (!name) return;
    const token = localStorage.getItem('token');
    await axios.post(
      'http://localhost:3001/drive/folders',
      { name, parentId: currentFolder },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    fetchContents(currentFolder || undefined);
  };

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-primary">My Drive</h2>
        <div className="flex gap-2">
          <button
            onClick={createFolder}
            className="btn btn-muted"
          >
            New Folder
          </button>
          <button
            onClick={async () => {
              const title = prompt('Document title:');
              if (!title) return;
              const token = localStorage.getItem('token');
              await axios.post(
                'http://localhost:3001/docs',
                { title, folderId: currentFolder },
                { headers: { Authorization: `Bearer ${token}` } }
              );
              fetchContents(currentFolder || undefined);
            }}
            className="btn btn-primary"
          >
            New Document
          </button>
          <label className="cursor-pointer btn btn-primary">
            <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        </div>
      </div>

      {currentFolder && (
        <button
          onClick={() => fetchContents(undefined)} // TODO: Implement proper breadcrumbs/up navigation
          className="mb-4 text-blue-500 hover:underline"
        >
          &larr; Back to Root
        </button>
      )}

      <div className="grid grid-cols-4 gap-4">
        {folders.map((folder) => (
          <div
            key={folder.id}
            onClick={() => fetchContents(folder.id)}
            className="cursor-pointer rounded border bg-card p-4 hover:shadow-md"
          >
            <div className="text-4xl text-yellow-500">📁</div>
            <div className="mt-2 truncate font-medium">{folder.name}</div>
          </div>
        ))}
        {files.map((file) => (
          <div key={file.id} className="rounded border bg-white p-4 hover:shadow-md">
            <div className="text-4xl text-gray-400">📄</div>
            <div className="mt-2 truncate font-medium">{file.name}</div>
            <a
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 block text-sm text-blue-500 hover:underline"
            >
              Download
            </a>
          </div>
        ))}

        {docs.map((doc) => (
          <div key={doc.id} className="rounded border bg-white p-4 hover:shadow-md">
            <div className="text-4xl text-indigo-400">📝</div>
            <div className="mt-2 truncate font-medium">{doc.title}</div>
            <a
              href={`/docs/${doc.id}`}
              className="mt-2 block text-sm text-blue-500 hover:underline"
            >
              Open
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
