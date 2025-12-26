'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';

interface Folder {
  id: string;
  name: string;
}

interface FileItem {
  id: string;
  name: string;
}

export default function DrivePage() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [docs, setDocs] = useState<{ id: string; title: string }[]>([]);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const { user } = useAuth();

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

  const fetchContents = async (folderId?: string) => {
    const token = localStorage.getItem('token');
    const res = await axios.get(`${apiBaseUrl}/drive/list`, {
      params: { folderId },
      headers: { Authorization: `Bearer ${token}` },
    });
    setFolders(res.data.folders);
    setFiles((res.data.files || []).map((file: any) => ({ id: file.id, name: file.name })));
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
        `${apiBaseUrl}/drive/upload/init`,
        {
          name: file.name,
          size: file.size,
          mimeType: file.type,
          folderId: currentFolder,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // 2. Upload file via API (backend streams to storage)
      const formData = new FormData();
      formData.append('file', file);
      await axios.post(
        `${apiBaseUrl}/drive/upload/${initRes.data.file.id}`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      // 3. Finalize (optional, but good practice)
      await axios.post(
        `${apiBaseUrl}/drive/upload/finalize`,
        { fileId: initRes.data.file.id },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      fetchContents(currentFolder || undefined);
    } catch (err) {
      console.error('Upload error:', err);
      if (err instanceof Error) {
        console.error('Error details:', err.message);
      }
      alert('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (fileId: string, fileName: string) => {
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`${apiBaseUrl}/drive/file/${fileId}`, {
        responseType: 'blob',
        headers: { Authorization: `Bearer ${token}` },
      });

      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Download error:', err);
      alert('Download failed');
    }
  };

  const createFolder = async () => {
    const name = prompt('Folder name:');
    if (!name) return;
    const token = localStorage.getItem('token');
    await axios.post(
      `${apiBaseUrl}/drive/folders`,
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
                `${apiBaseUrl}/docs`,
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
            <button
              onClick={() => handleDownload(file.id, file.name)}
              className="mt-2 text-sm text-blue-500 hover:underline"
            >
              Download
            </button>
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
