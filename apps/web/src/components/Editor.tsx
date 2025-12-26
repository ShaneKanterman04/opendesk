'use client';

import { useEditor, EditorContent, Extension } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import { TextAlign } from '@tiptap/extension-text-align';
import { Underline } from '@tiptap/extension-underline';
import { Highlight } from '@tiptap/extension-highlight';
import { Color } from '@tiptap/extension-color';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Link } from '@tiptap/extension-link';
import { Placeholder } from '@tiptap/extension-placeholder';
import { useEffect, useState, useCallback, useMemo } from 'react';
import axios from 'axios';
import debounce from 'lodash/debounce';
import EditorToolbar from './EditorToolbar';

const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() {
    return {
      types: ['textStyle'],
    };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize.replace(/['"]+/g, ''),
            renderHTML: (attributes) => {
              if (!attributes.fontSize) {
                return {};
              }
              return {
                style: `font-size: ${attributes.fontSize}`,
              };
            },
          },
        },
      },
    ];
  },
});

export default function Editor({ docId, initialContent }: { docId: string; initialContent: any }) {
  const [saving, setSaving] = useState(false);

  const debouncedSave = useMemo(
    () =>
      debounce(async (json: any) => {
        setSaving(true);
        const token = localStorage.getItem('token');
        try {
          await axios.put(
            `http://localhost:3001/docs/${docId}`,
            { content: json },
            { headers: { Authorization: `Bearer ${token}` } }
          );
        } catch (err) {
          console.error('Failed to save', err);
        } finally {
          setSaving(false);
        }
      }, 1000),
    [docId]
  );

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      FontSize,
      Color,
      Underline,
      Highlight.configure({ multicolor: true }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 underline cursor-pointer',
        },
      }),
      Placeholder.configure({
        placeholder: 'Start typing...',
      }),
    ],
    content: initialContent,
    onUpdate: ({ editor }) => {
      debouncedSave(editor.getJSON());
    },
  });

  if (!editor) {
    return null;
  }

  return (
    <div className="flex flex-1 flex-col min-h-0 bg-card">
      <div className="sticky top-0 z-10 border-b bg-card px-8 py-2">
        <EditorToolbar editor={editor} saving={saving} />
      </div>
      <div className="flex-1 overflow-y-auto p-8">
        <EditorContent
          editor={editor}
          className="tiptap prose max-w-none focus:outline-none"
        />
      </div>
    </div>
  );
}
