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
  closestCenter,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Pure UI Component
function DriveItemUI({
  type,
  name,
  onOpen,
  onDownload,
  onDelete,
  isDragging,
  isDropTarget,
  isOverlay,
  style,
  setNodeRef,
  attributes,
  listeners,
}: {
  type: 'folder' | 'file' | 'doc';
  name: string;
  onOpen?: () => void;
  onDownload?: () => void;
  onDelete?: () => void;
  isDragging?: boolean;
  isDropTarget?: boolean;
  isOverlay?: boolean;
  style?: React.CSSProperties;
  setNodeRef?: (node: HTMLElement | null) => void;
  attributes?: any;
  listeners?: any;
}) {
  const handleDeleteClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onDelete) return;
    const ok = window.confirm(`Delete "${name}"? This will move it to Trash.`);
    if (!ok) return;
    try {
      await onDelete();
    } catch (err) {
      console.error('Delete failed', err);
      alert('Delete failed');
    }
  };

  const handleDownloadClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDownload?.();
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={type === 'folder' ? onOpen : undefined}
      className={`
        relative rounded border bg-card p-4 transition-all
        ${isDropTarget ? 'ring-2 ring-blue-400 bg-blue-50' : ''}
        ${type === 'folder' ? 'cursor-pointer' : ''}
        ${isDragging ? 'opacity-0' : ''}
        ${isOverlay ? 'scale-95 shadow-xl z-50 cursor-grabbing bg-card' : 'hover:shadow-md'}
      `}
    >
      <div className="text-4xl">
        {type === 'folder' && '📁'}
        {type === 'file' && '📄'}
        {type === 'doc' && '📝'}
      </div>
      <div className="mt-2 truncate font-medium">{name}</div>
      
      {type !== 'folder' && !isOverlay && (
        <div className="mt-2 flex gap-4 items-center">
          {type === 'doc' ? (
            <a href="#" className="text-sm text-blue-500 hover:underline" onClick={(e) => e.stopPropagation()}>Open</a>
          ) : (
            <button onClick={handleDownloadClick} className="text-sm text-blue-500 hover:underline">Download</button>
          )}
          <button onClick={handleDeleteClick} className="text-sm text-red-500 hover:underline">Delete</button>
        </div>
      )}
    </div>
  );
}

// Sortable Wrapper
function SortableDriveItem({
  id,
  type,
  name,
  onOpen,
  onDownload,
  onDelete,
  draggingId,
}: {
  id: string;
  type: 'folder' | 'file' | 'doc';
  name: string;
  onOpen?: () => void;
  onDownload?: () => void;
  onDelete?: () => void;
  draggingId?: string | null;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isOver,
  } = useSortable({ id: `${type}-${id}` });

  const isActiveDrag = draggingId === `${type}-${id}`;
  
  // Determine if we should show drop highlight (only for folders when something else is dragged over)
  // We disable this for folder-on-folder drag to avoid confusion with reordering
  const isDropTarget = Boolean(type === 'folder' && isOver && draggingId && !isActiveDrag && !draggingId.startsWith('folder-'));

  // We do NOT apply transform if draggingId is set, to prevent reordering visuals
  // But we DO apply it if it's NOT dragging, to allow animations? 
  // Actually, if we want "no new sorting", we should just ignore transform when draggingId is present.
  // But useSortable gives transform for the *active* item too.
  // If we ignore transform, the list stays static.
  
  const style = {
    // Only apply transform if we are NOT dragging anything (or if we want animations when not dragging)
    // But wait, if we don't apply transform, items won't move to make space.
    // This is what the user wants: "no new sorting ... until user lets go".
    // So we simply omit transform.
    // transform: CSS.Transform.toString(transform), 
    transition,
  } as React.CSSProperties;

  return (
    <DriveItemUI
      type={type}
      name={name}
      onOpen={onOpen}
      onDownload={onDownload}
      onDelete={onDelete}
      isDragging={isActiveDrag}
      isDropTarget={isDropTarget}
      setNodeRef={setNodeRef}
      style={style}
      attributes={attributes}
      listeners={listeners}
    />
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
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!active) return;

    try {
      // Dropped onto a folder (Move into folder)
      // Only if we are NOT reordering folders themselves (i.e. active is not a folder)
      if (over?.id && String(over.id).startsWith('folder-') && !String(active.id).startsWith('folder-')) {
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

      // Reordering within folders
      if (over?.id && String(active.id).startsWith('folder-') && String(over.id).startsWith('folder-')) {
        const activeId = String(active.id).replace('folder-', '');
        const overId = String(over.id).replace('folder-', '');
        const oldIndex = folders.findIndex((f) => f.id === activeId);
        const newIndex = folders.findIndex((f) => f.id === overId);
        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
        const newFolders = arrayMove(folders, oldIndex, newIndex);
        setFolders(newFolders);

        // Persist order
        const token = localStorage.getItem('token');
        try {
          await axios.post(`${apiBaseUrl}/drive/item/reorder`, { itemType: 'folder', folderId: currentFolder || null, orderedIds: newFolders.map(f=>f.id) }, { headers: { Authorization: `Bearer ${token}` } });
        } catch (err) {
          console.error('Reorder failed', err);
          alert('Reorder failed');
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
    } finally {
      // Clear dragging state regardless of outcome so hover behavior stabilizes
      setDraggingId(null);
    }
  };

  const handleDragStart = (event: any) => {
    setDraggingId(String(event.active?.id ?? null));
  };

  const handleDragCancel = () => {
    setDraggingId(null);
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

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
        <div className="grid grid-cols-4 gap-4">
          <SortableContext 
            items={folders.map(f => `folder-${f.id}`)} 
            strategy={rectSortingStrategy}
          >
            {folders.map((folder) => (
              <SortableDriveItem
                key={folder.id}
                id={folder.id}
                type="folder"
                name={folder.name}
                onOpen={() => fetchContents(folder.id)}
                draggingId={draggingId}
              />
            ))}
          </SortableContext>

          <SortableContext items={files.map(f => `file-${f.id}`)} strategy={rectSortingStrategy}>
            {files.map((file) => (
              <SortableDriveItem
                key={file.id}
                id={file.id}
                type="file"
                name={file.name}
                onDownload={() => handleDownload(file.id, file.name)}
                draggingId={draggingId}
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

          <SortableContext items={docs.map(d => `doc-${d.id}`)} strategy={rectSortingStrategy}>
            {docs.map((doc) => (
              <SortableDriveItem
                key={doc.id}
                id={doc.id}
                type="doc"
                name={doc.title}
                draggingId={draggingId}
              />
            ))}
          </SortableContext>
        </div>

        <DragOverlay>
          {draggingId ? (
            <DriveItemUI
              type={draggingId.startsWith('folder-') ? 'folder' : draggingId.startsWith('file-') ? 'file' : 'doc'}
              name={
                draggingId.startsWith('folder-') ? folders.find(f => `folder-${f.id}` === draggingId)?.name || '' :
                draggingId.startsWith('file-') ? files.find(f => `file-${f.id}` === draggingId)?.name || '' :
                docs.find(d => `doc-${d.id}` === draggingId)?.title || ''
              }
              isOverlay
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
