import React from 'react';
import { Plus, FolderPlus, FileText, Upload, Search } from 'lucide-react';

interface DriveToolbarProps {
  onCreateFolder: () => void;
  onCreateDoc: () => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  uploading: boolean;
  onSearch?: (query: string) => void;
  showDelete?: boolean;
  onDeleteCurrentFolder?: () => void;
}

export function DriveToolbar({
  onCreateFolder,
  onCreateDoc,
  onUpload,
  uploading,
  onSearch,
  showDelete,
  onDeleteCurrentFolder
}: DriveToolbarProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 bg-card p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
      <div className="relative w-full sm:w-72">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
        <input
          type="text"
          placeholder="Search files..."
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-foreground placeholder:text-muted text-sm"
          onChange={(e) => onSearch?.(e.target.value)}
        />
      </div>

      <div className="flex items-center gap-3 w-full sm:w-auto">
        <button
          onClick={onCreateFolder}
          className="btn btn-muted flex-1 sm:flex-none"
        >
          <FolderPlus size={18} />
          <span>Folder</span>
        </button>
        
        <button
          onClick={onCreateDoc}
          className="btn btn-primary flex-1 sm:flex-none"
        >
          <FileText size={18} />
          <span>Doc</span>
        </button>

        <label className={`btn btn-muted flex-1 sm:flex-none cursor-pointer ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
          <Upload size={18} />
          <span>Upload</span>
          <input type="file" className="hidden" onChange={onUpload} disabled={uploading} />
        </label>
        {showDelete && onDeleteCurrentFolder && (
          <button onClick={onDeleteCurrentFolder} className="btn btn-destructive flex-1 sm:flex-none">
            <span>Delete Folder</span>
          </button>
        )}
      </div>
    </div>
  );
}
