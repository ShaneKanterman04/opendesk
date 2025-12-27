"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { DriveItemUI } from '@/components/DriveItemUI';
import { DriveToolbar } from '@/components/DriveToolbar';
import { Breadcrumbs } from '@/components/Breadcrumbs';

// DnD
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Sortable Wrapper
function SortableDriveItem({
  id,
  type,
  name,
  onOpen,
  onDownload,
  onDelete,
  onRename,
  onEdit,
  onView,
  draggingId,
}: {
  id: string;
  type: 'folder' | 'file' | 'doc';
  name: string;
  onOpen?: () => void;
  onDownload?: () => void;
  onDelete?: () => void;
  onRename?: () => void;
  onEdit?: () => void;
  onView?: () => void;
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
  const isDropTarget = Boolean(type === 'folder' && isOver && draggingId && !isActiveDrag && !draggingId.startsWith('folder-'));

  const style = {
    transition,
    transform: CSS.Transform.toString(transform), 
  } as React.CSSProperties;

  return (
    <DriveItemUI
      type={type}
      name={name}
      itemId={id}
      onOpen={onOpen}
      onDownload={onDownload}
      onDelete={onDelete}
      onEdit={onEdit}
      onView={onView}
      onRename={onRename}
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

interface BreadcrumbItem {
  id: string;
  name: string;
}

export default function DrivePage() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [docs, setDocs] = useState<{ id: string; title: string }[]>([]);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const { user } = useAuth();
  const router = useRouter();

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

  const fetchContents = async (folderId?: string | null) => {
    const token = localStorage.getItem('token');
    try {
      const res = await axios.get(`${apiBaseUrl}/drive/list`, {
        params: { folderId },
        headers: { Authorization: `Bearer ${token}` },
      });
      setFolders(res.data.folders);
      setFiles((res.data.files || []).map((file: any) => ({ id: file.id, name: file.name })));
      setDocs(res.data.docs || []);
    } catch (err) {
      console.error('Failed to fetch contents', err);
    }
  };

  useEffect(() => {
    fetchContents(currentFolder);
  }, [currentFolder]);

  const handleNavigate = (folderId: string | null, folderName?: string) => {
    if (folderId === null) {
      setBreadcrumbs([]);
      setCurrentFolder(null);
    } else {
      // Check if we are navigating back via breadcrumbs
      const existingIndex = breadcrumbs.findIndex(b => b.id === folderId);
      if (existingIndex !== -1) {
        setBreadcrumbs(breadcrumbs.slice(0, existingIndex + 1));
      } else if (folderName) {
        // Navigating deeper
        setBreadcrumbs([...breadcrumbs, { id: folderId, name: folderName }]);
      }
      setCurrentFolder(folderId);
    }
  };

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

      // 3. Finalize
      await axios.post(
        `${apiBaseUrl}/drive/upload/finalize`,
        { fileId: initRes.data.file.id },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      fetchContents(currentFolder);
    } catch (err) {
      console.error('Upload error:', err);
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

  const handleExportDoc = async (docId: string, title: string) => {
    const token = localStorage.getItem('token');
    try {
      const res = await axios.post(
        `${apiBaseUrl}/docs/${docId}/export`,
        { format: 'pdf', destination: 'local' },
        { headers: { Authorization: `Bearer ${token}` }, responseType: 'blob' }
      );

      const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${title}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Export failed', err);
      alert('Export failed');
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
    fetchContents(currentFolder);
  };

  const createDoc = async () => {
    const title = prompt('Document title:');
    if (!title) return;
    const token = localStorage.getItem('token');
    await axios.post(
      `${apiBaseUrl}/docs`,
      { title, folderId: currentFolder },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    fetchContents(currentFolder);
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
      if (over?.id && String(over.id).startsWith('folder-') && !String(active.id).startsWith('folder-')) {
        const folderId = String(over.id).replace('folder-', '');
        const activeId = String(active.id);
        const itemType = activeId.startsWith('file-') ? 'file' : activeId.startsWith('doc-') ? 'doc' : null;
        if (!itemType) return;
        const itemId = activeId.replace(/^file-|^doc-/, '');
        const token = localStorage.getItem('token');
        try {
          await axios.post(`${apiBaseUrl}/drive/item/move`, { itemType, itemId, folderId }, { headers: { Authorization: `Bearer ${token}` } });
          fetchContents(currentFolder);
        } catch (err) {
          console.error('Move failed', err);
          alert('Move failed');
        }
        return;
      }

      // Reordering logic (simplified for brevity, same as before)
      // ... (Keep existing reordering logic if needed, or simplify)
      // For now, I'll just refresh content to reset order if dropped in same place
      // But to support reordering, we need the arrayMove logic.
      
      const activeType = String(active.id).split('-')[0];
      const overType = String(over?.id).split('-')[0];
      
      if (activeType === overType && over) {
         // Handle reorder
         const activeId = String(active.id).replace(`${activeType}-`, '');
         const overId = String(over.id).replace(`${activeType}-`, '');
         
         let newItems: any[] = [];
         let setFunction: any = null;
         let itemType = '';

         if (activeType === 'folder') {
            const oldIndex = folders.findIndex(f => f.id === activeId);
            const newIndex = folders.findIndex(f => f.id === overId);
            if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
                newItems = arrayMove(folders, oldIndex, newIndex);
                setFolders(newItems);
                setFunction = setFolders;
                itemType = 'folder';
            }
         } else if (activeType === 'file') {
            const oldIndex = files.findIndex(f => f.id === activeId);
            const newIndex = files.findIndex(f => f.id === overId);
            if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
                newItems = arrayMove(files, oldIndex, newIndex);
                setFiles(newItems);
                setFunction = setFiles;
                itemType = 'file';
            }
         } else if (activeType === 'doc') {
            const oldIndex = docs.findIndex(d => d.id === activeId);
            const newIndex = docs.findIndex(d => d.id === overId);
            if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
                newItems = arrayMove(docs, oldIndex, newIndex);
                setDocs(newItems);
                setFunction = setDocs;
                itemType = 'doc';
            }
         }

         if (itemType && newItems.length > 0) {
             const token = localStorage.getItem('token');
             try {
                 await axios.post(`${apiBaseUrl}/drive/item/reorder`, { 
                     itemType, 
                     folderId: currentFolder || null, 
                     orderedIds: newItems.map(i => i.id) 
                 }, { headers: { Authorization: `Bearer ${token}` } });
             } catch (err) {
                 console.error('Reorder failed', err);
             }
         }
      }

    } finally {
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
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">My Drive</h2>
        <p className="text-gray-500">Manage your files and folders</p>
      </div>

      <DriveToolbar
        onCreateFolder={createFolder}
        onCreateDoc={createDoc}
        onUpload={handleUpload}
        uploading={uploading}
        onSearch={(q) => console.log('Search:', q)}
        showDelete={currentFolder !== null}
        onDeleteCurrentFolder={async () => {
          if (!currentFolder) return;
          const ok = confirm('Delete this folder and its contents?');
          if (!ok) return;
          const token = localStorage.getItem('token');
          try {
            await axios.delete(`${apiBaseUrl}/drive/folder/${currentFolder}`, { headers: { Authorization: `Bearer ${token}` } });
            try { (window as any).toast?.('Folder deleted'); } catch (e) {}
            // navigate up to parent (simple behavior: go to root)
            setCurrentFolder(null);
            setBreadcrumbs([]);
            fetchContents(null);
          } catch (err) {
            console.error('Folder delete failed', err);
            try { (window as any).toast?.('Folder delete failed'); } catch (e) { alert('Folder delete failed'); }
          }
        }}
      />

      <Breadcrumbs
        items={breadcrumbs}
        onNavigate={(id) => handleNavigate(id)}
      />

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
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
                onOpen={() => handleNavigate(folder.id, folder.name)}
                draggingId={draggingId}
                onRename={() => {
                    const newName = prompt('New name:', folder.name);
                    if (!newName || newName === folder.name) return;
                    (async () => {
                      const token = localStorage.getItem('token');
                      try {
                        await axios.put(`${apiBaseUrl}/drive/folder/${folder.id}`, { name: newName }, { headers: { Authorization: `Bearer ${token}` } });
                        try { (window as any).toast?.('Folder renamed'); } catch (e) {}
                        fetchContents(currentFolder);
                      } catch (err) {
                        console.error('Rename failed', err);
                        alert('Rename failed');
                      }
                    })();
                }}
                onDelete={async () => {
                    const ok = confirm(`Delete folder "${folder.name}"? This will soft-delete contained files and documents.`);
                    if (!ok) return;
                    const token = localStorage.getItem('token');
                    try {
                        await axios.delete(`${apiBaseUrl}/drive/folder/${folder.id}`, { headers: { Authorization: `Bearer ${token}` } });
                        try { (window as any).toast?.('Folder deleted'); } catch (e) {}
                        fetchContents(currentFolder);
                    } catch (err) {
                        console.error('Folder delete failed', err);
                        alert('Folder delete failed');
                    }
                }}
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
                onRename={() => {
                  const newName = prompt('New name:', file.name);
                  if (!newName || newName === file.name) return;
                  (async () => {
                    const token = localStorage.getItem('token');
                    try {
                      await axios.put(`${apiBaseUrl}/drive/file/${file.id}`, { name: newName }, { headers: { Authorization: `Bearer ${token}` } });
                      try { (window as any).toast?.('File renamed'); } catch (e) {}
                      fetchContents(currentFolder);
                    } catch (err) {
                      console.error('Rename failed', err);
                      alert('Rename failed');
                    }
                  })();
                }}
                onDelete={async () => {
                  const token = localStorage.getItem('token');
                  try {
                    await axios.delete(`${apiBaseUrl}/drive/file/${file.id}`, { headers: { Authorization: `Bearer ${token}` } });
                    try { (window as any).toast?.('File deleted'); } catch (e) {}
                    fetchContents(currentFolder);
                  } catch (err) {
                    console.error('Delete failed', err);
                    try { (window as any).toast?.('Delete failed'); } catch (e) { alert('Delete failed'); }
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
                onEdit={() => {
                    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
                    if (currentPath === `/docs/${doc.id}`) {
                      window.dispatchEvent(new CustomEvent('focus-doc', { detail: doc.id }));
                    } else {
                      router.push(`/docs/${doc.id}`);
                    }
                }}
                onView={() => router.push(`/docs/${doc.id}?view=1`)}
                onDownload={() => handleExportDoc(doc.id, doc.title)}
                onRename={() => {
                  const newName = prompt('New title:', doc.title);
                  if (!newName || newName === doc.title) return;
                  (async () => {
                    const token = localStorage.getItem('token');
                    try {
                      await axios.put(`${apiBaseUrl}/docs/${doc.id}`, { title: newName }, { headers: { Authorization: `Bearer ${token}` } });
                      try { (window as any).toast?.('Document renamed'); } catch (e) {}
                      fetchContents(currentFolder);
                    } catch (err) {
                      console.error('Rename failed', err);
                      alert('Rename failed');
                    }
                  })();
                }}
                onDelete={async () => {
                    // TODO: Implement doc delete API
                     const token = localStorage.getItem('token');
                     try {
                         await axios.delete(`${apiBaseUrl}/docs/${doc.id}`, { headers: { Authorization: `Bearer ${token}` } });
                     try { (window as any).toast?.('Document deleted'); } catch (e) {}
                     fetchContents(currentFolder);
                     } catch (err) {
                         console.error('Delete failed', err);
                     try { (window as any).toast?.('Delete failed'); } catch (e) { alert('Delete failed'); }
                     }
                }}
              />
            ))}
          </SortableContext>
        </div>
        
        {folders.length === 0 && files.length === 0 && docs.length === 0 && (
            <div className="text-center py-20 text-gray-400">
                <div className="mb-4 text-6xl">📂</div>
                <p className="text-lg">This folder is empty</p>
            </div>
        )}

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
