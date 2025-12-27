import React, { useState, useRef, useEffect } from 'react';
import { Folder, FileText, File, MoreVertical, Download, Trash2, ExternalLink, Edit2 } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface DriveItemUIProps {
  type: 'folder' | 'file' | 'doc';
  name: string;
  onOpen?: () => void;
  onDownload?: () => void;
  onDelete?: () => void;
  itemId?: string;
  onRename?: () => void;
  isDragging?: boolean;
  isDropTarget?: boolean;
  isOverlay?: boolean;
  style?: React.CSSProperties;
  setNodeRef?: (node: HTMLElement | null) => void;
  attributes?: any;
  listeners?: any;
}

export function DriveItemUI({
  type,
  name,
  onOpen,
  onDownload,
  onDelete,
  itemId,
  onRename,
  isDragging,
  isDropTarget,
  isOverlay,
  style,
  setNodeRef,
  attributes,
  listeners,
}: DriveItemUIProps) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(!showMenu);
  };

  const handleAction = (action: () => void) => {
    setShowMenu(false);
    action();
  };

  const Icon = type === 'folder' ? Folder : type === 'doc' ? FileText : File;
  const iconColor = type === 'folder' ? 'text-blue-500' : type === 'doc' ? 'text-orange-500' : 'text-gray-500';
  const fill = type === 'folder' ? 'fill-blue-500/20' : type === 'doc' ? 'fill-orange-500/20' : 'fill-gray-500/20';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={type === 'folder' ? onOpen : undefined}
      className={twMerge(
        'group relative flex flex-col justify-between rounded-xl border bg-card p-4 transition-all duration-200',
        'hover:shadow-md hover:border-blue-200 dark:hover:border-blue-800',
        isDropTarget && 'ring-2 ring-blue-400 bg-blue-50 dark:bg-blue-900/20',
        type === 'folder' && 'cursor-pointer',
        isDragging && 'opacity-50',
        isOverlay && 'scale-105 shadow-xl z-50 cursor-grabbing bg-card ring-2 ring-blue-500',
        !isOverlay && !isDragging && 'hover:-translate-y-0.5'
      )}
    >
      <div className="flex items-start justify-between">
        <div className={clsx("p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 transition-colors", iconColor)}>
          <Icon size={32} className={fill} />
        </div>
        
        {!isOverlay && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={handleMenuClick}
              className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreVertical size={16} />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border bg-card shadow-lg z-50 py-1 animate-in fade-in zoom-in-95 duration-100">
                {type === 'folder' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleAction(onOpen!); }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <ExternalLink size={14} /> Open
                  </button>
                )}
                {type !== 'folder' && onDownload && (
                  <button
                    id={itemId ? `export-btn-${itemId}` : undefined}
                    onClick={(e) => { e.stopPropagation(); handleAction(onDownload); }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <Download size={14} /> Download
                  </button>
                )}
                {onRename && (
                   <button
                   onClick={(e) => { e.stopPropagation(); handleAction(onRename); }}
                   className="flex w-full items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-gray-50 dark:hover:bg-gray-800"
                 >
                   <Edit2 size={14} /> Rename
                 </button>
                )}
                {onDelete && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleAction(onDelete); }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-4">
        <h3 className="font-medium text-foreground truncate" title={name}>
          {name}
        </h3>
        <p className="text-xs text-muted mt-1">
          {type === 'folder' ? 'Folder' : type === 'doc' ? 'Document' : 'File'}
        </p>
      </div>
    </div>
  );
}
