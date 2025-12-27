import React, { useState } from 'react';

export default function EditorToolbar({ editor, saving, onExport }: { editor: any; saving: boolean; onExport: (format: string, destination: string) => void }) {
  const [exportFormat, setExportFormat] = useState('pdf');
  const [exportDest, setExportDest] = useState('local');

  if (!editor) return null;

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);

    if (url === null) {
      return;
    }

    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div className="flex w-full items-center justify-between">
      <div className="flex flex-wrap items-center gap-1">
        {/* History */}
        <div className="flex items-center border-r pr-2 mr-1 gap-1">
          <button
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            className="rounded px-2 py-1 hover:bg-gray-100 disabled:opacity-30"
            title="Undo"
          >
            ↩️
          </button>
          <button
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            className="rounded px-2 py-1 hover:bg-gray-100 disabled:opacity-30"
            title="Redo"
          >
            ↪️
          </button>
        </div>

        {/* Headings & Font Size */}
        <div className="flex items-center border-r pr-2 mr-1 gap-1">
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`rounded px-2 py-1 hover:bg-gray-100 ${editor.isActive('heading', { level: 1 }) ? 'bg-gray-200 font-bold' : ''}`}
          >
            H1
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`rounded px-2 py-1 hover:bg-gray-100 ${editor.isActive('heading', { level: 2 }) ? 'bg-gray-200 font-bold' : ''}`}
          >
            H2
          </button>
          <select
            value={editor.getAttributes('textStyle')?.fontSize || '16px'}
            onChange={(e) => editor.chain().focus().setTextStyle({ fontSize: e.target.value }).run()}
            className="rounded border px-1 py-1 bg-surface text-xs ml-1"
          >
            <option value="12px">12px</option>
            <option value="14px">14px</option>
            <option value="16px">16px</option>
            <option value="18px">18px</option>
            <option value="20px">20px</option>
            <option value="24px">24px</option>
            <option value="32px">32px</option>
          </select>
        </div>

        {/* Basic Formatting */}
        <div className="flex items-center border-r pr-2 mr-1 gap-1">
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`rounded px-2 py-1 hover:bg-gray-100 ${editor.isActive('bold') ? 'bg-gray-200 font-bold' : ''}`}
            title="Bold"
          >
            B
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`rounded px-2 py-1 hover:bg-gray-100 ${editor.isActive('italic') ? 'bg-gray-200 italic' : ''}`}
            title="Italic"
          >
            I
          </button>
          <button
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={`rounded px-2 py-1 hover:bg-gray-100 ${editor.isActive('underline') ? 'bg-gray-200 underline' : ''}`}
            title="Underline"
          >
            U
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            className={`rounded px-2 py-1 hover:bg-gray-100 ${editor.isActive('highlight') ? 'bg-yellow-200' : ''}`}
            title="Highlight"
          >
            🖍️
          </button>
          <input
            type="color"
            onInput={(e) => editor.chain().focus().setColor((e.target as HTMLInputElement).value).run()}
            value={editor.getAttributes('textStyle').color || '#000000'}
            className="w-5 h-5 cursor-pointer border-none bg-transparent"
            title="Text Color"
          />
        </div>

        {/* Lists & Blocks */}
        <div className="flex items-center border-r pr-2 mr-1 gap-1">
          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`rounded px-2 py-1 hover:bg-gray-100 ${editor.isActive('bulletList') ? 'bg-gray-200' : ''}`}
            title="Bullet List"
          >
            •
          </button>
          <button
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`rounded px-2 py-1 hover:bg-gray-100 ${editor.isActive('orderedList') ? 'bg-gray-200' : ''}`}
            title="Ordered List"
          >
            1.
          </button>
          <button
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            className={`rounded px-2 py-1 hover:bg-gray-100 ${editor.isActive('taskList') ? 'bg-gray-200' : ''}`}
            title="Task List"
          >
            ☑️
          </button>
          <button
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={`rounded px-2 py-1 hover:bg-gray-100 ${editor.isActive('blockquote') ? 'bg-gray-200' : ''}`}
            title="Blockquote"
          >
            “
          </button>
        </div>

        {/* Insert & Advanced */}
        <div className="flex items-center border-r pr-2 mr-1 gap-1">
          <button
            onClick={setLink}
            className={`rounded px-2 py-1 hover:bg-gray-100 ${editor.isActive('link') ? 'bg-gray-200 text-blue-600' : ''}`}
            title="Link"
          >
            🔗
          </button>
          <button
            onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
            className="rounded px-2 py-1 hover:bg-gray-100"
            title="Insert Table"
          >
            📅
          </button>
          <button
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            className="rounded px-2 py-1 hover:bg-gray-100"
            title="Horizontal Rule"
          >
            —
          </button>
          <button
            onClick={() => editor.chain().focus().toggleCode().run()}
            className={`rounded px-2 py-1 hover:bg-gray-100 ${editor.isActive('code') ? 'bg-gray-200 font-mono' : ''}`}
            title="Inline Code"
          >
            `
          </button>
          <button
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            className={`rounded px-2 py-1 hover:bg-gray-100 ${editor.isActive('codeBlock') ? 'bg-gray-200' : ''}`}
            title="Code Block"
          >
            📜
          </button>
        </div>

        {/* Alignment */}
        <div className="flex items-center border-r pr-2 mr-1 gap-1">
          <button
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            className={`rounded px-2 py-1 hover:bg-gray-100 ${editor.isActive({ textAlign: 'left' }) ? 'bg-gray-200' : ''}`}
            title="Align Left"
          >
            L
          </button>
          <button
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            className={`rounded px-2 py-1 hover:bg-gray-100 ${editor.isActive({ textAlign: 'center' }) ? 'bg-gray-200' : ''}`}
            title="Align Center"
          >
            C
          </button>
          <button
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            className={`rounded px-2 py-1 hover:bg-gray-100 ${editor.isActive({ textAlign: 'right' }) ? 'bg-gray-200' : ''}`}
            title="Align Right"
          >
            R
          </button>
        </div>

        {/* Clear */}
        <button
          onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
          className="rounded px-2 py-1 hover:bg-gray-100"
          title="Clear Formatting"
        >
          🧹
        </button>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 border-r pr-2 mr-2">
           <select 
             value={exportFormat} 
             onChange={e => setExportFormat(e.target.value)} 
             className="border rounded px-1 py-0.5 text-xs bg-white"
           >
             <option value="pdf">PDF</option>
             <option value="docx">DOCX</option>
             <option value="md">MD</option>
           </select>
           <select 
             value={exportDest} 
             onChange={e => setExportDest(e.target.value)} 
             className="border rounded px-1 py-0.5 text-xs bg-white"
           >
             <option value="local">Download</option>
             <option value="drive">Drive</option>
           </select>
           <button 
             onClick={() => onExport(exportFormat, exportDest)} 
             className="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 border rounded text-xs"
           >
             Export
           </button>
        </div>

        <div className="text-xs font-medium text-muted-foreground whitespace-nowrap">
          {saving ? (
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500"></span>
              Saving...
            </span>
          ) : (
            <span className="text-green-600">✓ Saved</span>
          )}
        </div>
      </div>
    </div>
  );
}
