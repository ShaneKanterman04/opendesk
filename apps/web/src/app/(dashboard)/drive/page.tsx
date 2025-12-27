'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';

// DnD
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Small helpers / components for DnD
function FolderCard({ folder, onOpen }: { folder: {id:string; name:string}, onOpen: () => void }){
  const { isOver, setNodeRef } = useDroppable({ id: `folder-${folder.id}` });

  return (
    <div ref={setNodeRef} onClick={onOpen} className={`cursor-pointer rounded border bg-card p-4 hover:shadow-md ${isOver? 'ring-2 ring-blue-400': ''}`}>
      <div className="text-4xl text-yellow-500">📁</div>
      <div className="mt-2 truncate font-medium">{folder.name}</div>
    </div>
  );
}

function SortableFile({ file, onDownload, onDelete }: { file: {id:string; name:string}, onDownload: (id:string, name:string) => void, onDelete?: () => Promise<void> }){
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: `file-${file.id}` });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  } as React.CSSProperties;

  const handleDeleteClick = async () => {
    if (!onDelete) return;
    const ok = window.confirm(`Delete "${file.name}"? This will move it to Trash.`);
    if (!ok) return;
    try {
      await onDelete();
    } catch (err) {
      console.error('Delete failed', err);
      alert('Delete failed');
    }
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="rounded border bg-white p-4 hover:shadow-md">
      <div className="text-4xl text-gray-400">📄</div>
      <div className="mt-2 truncate font-medium">{file.name}</div>
      <div className="mt-2 flex gap-4 items-center">
        <button onClick={() => onDownload(file.id, file.name)} className="text-sm text-blue-500 hover:underline">Download</button>
        <button onClick={handleDeleteClick} className="text-sm text-red-500 hover:underline">Delete</button>
      </div>
    </div>
  );
}

function SortableDoc({ doc }: { doc: {id:string; title:string} }){
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: `doc-${doc.id}` });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  } as React.CSSProperties;

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="rounded border bg-white p-4 hover:shadow-md">
      <div className="text-4xl text-indigo-400">📝</div>
      <div className="mt-2 truncate font-medium">{doc.title}</div>
      <a href={`/docs/${doc.id}`} className="mt-2 block text-sm text-blue-500 hover:underline">Open</a>
    </div>
  );
}


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

  // DnD sensors and handlers
  const sensors = useSensors(useSensor(PointerSensor));

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!active) return;

    // Dropped onto a folder
    if (over?.id && String(over.id).startsWith('folder-')) {
      const folderId = String(over.id).replace('folder-', '');
      const activeId = String(active.id);
      const itemType = activeId.startsWith('file-') ? 'file' : activeId.startsWith('doc-') ? 'doc' : null;
      if (!itemType) return;
      const itemId = activeId.replace(/^file-|^doc-/, '');
      const token = localStorage.getItem('token');
      try {
        await axios.post(`${apiBaseUrl}/drive/item/move`, { itemType, itemId, folderId }, { headers: { Authorization: `Bearer ${token}` } });
        fetchContents(currentFolder || undefined);
      } catch (err) {
        console.error('Move failed', err);
        alert('Move failed');
      }
      return;
    }

    // Reordering within files
    if (over?.id && String(active.id).startsWith('file-') && String(over.id).startsWith('file-')) {
      const activeId = String(active.id).replace('file-', '');
      const overId = String(over.id).replace('file-', '');
      const oldIndex = files.findIndex((f) => f.id === activeId);
      const newIndex = files.findIndex((f) => f.id === overId);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
      const newFiles = arrayMove(files, oldIndex, newIndex);
      setFiles(newFiles);

      // Persist order
      const token = localStorage.getItem('token');
      try {
        await axios.post(`${apiBaseUrl}/drive/item/reorder`, { itemType: 'file', folderId: currentFolder || null, orderedIds: newFiles.map(f=>f.id) }, { headers: { Authorization: `Bearer ${token}` } });
      } catch (err) {
        console.error('Reorder failed', err);
        alert('Reorder failed');
      }
      return;
    }

    // Reordering within docs
    if (over?.id && String(active.id).startsWith('doc-') && String(over.id).startsWith('doc-')) {
      const activeId = String(active.id).replace('doc-', '');
      const overId = String(over.id).replace('doc-', '');
      const oldIndex = docs.findIndex((d) => d.id === activeId);
      const newIndex = docs.findIndex((d) => d.id === overId);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
      const newDocs = arrayMove(docs, oldIndex, newIndex);
      setDocs(newDocs);

      const token = localStorage.getItem('token');
      try {
        await axios.post(`${apiBaseUrl}/drive/item/reorder`, { itemType: 'doc', folderId: currentFolder || null, orderedIds: newDocs.map(d=>d.id) }, { headers: { Authorization: `Bearer ${token}` } });
      } catch (err) {
        console.error('Reorder failed', err);
        alert('Reorder failed');
      }
      return;
    }
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

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-4 gap-4">
          {folders.map((folder) => (
            <FolderCard key={folder.id} folder={folder} onOpen={() => fetchContents(folder.id)} />
          ))}

          <SortableContext items={files.map(f => `file-${f.id}`)} strategy={verticalListSortingStrategy}>
            {files.map((file) => (
              <SortableFile
                key={file.id}
                file={file}
                onDownload={handleDownload}
                onDelete={async () => {
                  const token = localStorage.getItem('token');
                  try {
                    await axios.delete(`${apiBaseUrl}/drive/file/${file.id}`, { headers: { Authorization: `Bearer ${token}` } });
                    await fetchContents(currentFolder || undefined);
                  } catch (err) {
                    console.error('Delete failed', err);
                    alert('Delete failed');
                  }
                }}
              />
            ))}
          </SortableContext>

          <SortableContext items={docs.map(d => `doc-${d.id}`)} strategy={verticalListSortingStrategy}>
            {docs.map((doc) => (
              <SortableDoc key={doc.id} doc={doc} />
            ))}
          </SortableContext>
        </div>
      </DndContext>
    </div>
  );
}
