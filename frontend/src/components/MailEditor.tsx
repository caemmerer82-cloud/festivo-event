import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { useEffect, useCallback, useState } from 'react';

const PLACEHOLDERS = [
  { key: '{{salutation_formal}}', label: 'Anrede (förmlich)' },
  { key: '{{salutation_friendly}}', label: 'Anrede (freundlich)' },
  { key: '{{first_name}}', label: 'Vorname' },
  { key: '{{last_name}}', label: 'Nachname' },
  { key: '{{email}}', label: 'E-Mail' },
  { key: '{{event_name}}', label: 'Veranstaltungsname' },
  { key: '{{event_date}}', label: 'Datum' },
  { key: '{{event_location}}', label: 'Ort' },
  { key: '{{rsvp_link}}', label: 'RSVP-Link' },
  { key: '{{banner_img}}', label: 'Banner-Bild' },
  { key: '{{banner_url}}', label: 'Banner-URL' },
];

interface MailEditorProps {
  value: string;
  onChange: (value: string) => void;
}

function ToolbarBtn({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`px-2 py-1 rounded text-sm font-medium transition-colors ${
        active
          ? 'bg-indigo-600 text-white'
          : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="w-px h-5 bg-gray-300 self-center mx-0.5" />;
}

export default function MailEditor({ value, onChange }: MailEditorProps) {
  const [showHtml, setShowHtml] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [showLinkInput, setShowLinkInput] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-indigo-600 underline' } }),
      Image.configure({ HTMLAttributes: { style: 'max-width:100%;height:auto;display:block;' } }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Sync external value changes (e.g. when a template is loaded)
  useEffect(() => {
    if (!editor) return;
    const currentHtml = editor.getHTML();
    if (currentHtml !== value) {
      editor.commands.setContent(value || '');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const insertPlaceholder = useCallback((placeholder: string) => {
    if (editor) {
      editor.chain().focus().insertContent(placeholder).run();
    }
  }, [editor]);

  const applyLink = () => {
    if (!editor) return;
    if (linkUrl) {
      const url = linkUrl.startsWith('http') ? linkUrl : 'https://' + linkUrl;
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    } else {
      editor.chain().focus().unsetLink().run();
    }
    setShowLinkInput(false);
    setLinkUrl('');
  };

  if (!editor) return null;

  return (
    <div className="space-y-2">
      {/* Placeholder buttons */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-1.5">Platzhalter einfügen:</p>
        <div className="flex flex-wrap gap-1.5">
          {PLACEHOLDERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => insertPlaceholder(key)}
              className="px-2 py-1 text-xs rounded-md bg-primary-100 text-primary-700 hover:bg-primary-200 font-mono transition-colors"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
          {/* Text style */}
          <ToolbarBtn
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive('bold')}
            title="Fett"
          >
            <strong>F</strong>
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive('italic')}
            title="Kursiv"
          >
            <em>K</em>
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            active={editor.isActive('underline')}
            title="Unterstrichen"
          >
            <span className="underline">U</span>
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => editor.chain().focus().toggleStrike().run()}
            active={editor.isActive('strike')}
            title="Durchgestrichen"
          >
            <span className="line-through">D</span>
          </ToolbarBtn>

          <Divider />

          {/* Headings */}
          <ToolbarBtn
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            active={editor.isActive('heading', { level: 1 })}
            title="Überschrift 1"
          >
            H1
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor.isActive('heading', { level: 2 })}
            title="Überschrift 2"
          >
            H2
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            active={editor.isActive('heading', { level: 3 })}
            title="Überschrift 3"
          >
            H3
          </ToolbarBtn>

          <Divider />

          {/* Lists */}
          <ToolbarBtn
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive('bulletList')}
            title="Aufzählungsliste"
          >
            • Liste
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive('orderedList')}
            title="Nummerierte Liste"
          >
            1. Liste
          </ToolbarBtn>

          <Divider />

          {/* Alignment */}
          <ToolbarBtn
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            active={editor.isActive({ textAlign: 'left' })}
            title="Linksbündig"
          >
            ←
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            active={editor.isActive({ textAlign: 'center' })}
            title="Zentriert"
          >
            ↔
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            active={editor.isActive({ textAlign: 'right' })}
            title="Rechtsbündig"
          >
            →
          </ToolbarBtn>

          <Divider />

          {/* Link */}
          <ToolbarBtn
            onClick={() => {
              const existing = editor.getAttributes('link').href ?? '';
              setLinkUrl(existing);
              setShowLinkInput(true);
            }}
            active={editor.isActive('link')}
            title="Link einfügen"
          >
            🔗
          </ToolbarBtn>

          {/* Image by URL */}
          <ToolbarBtn
            onClick={() => {
              const url = prompt('Bild-URL eingeben:');
              if (url) editor.chain().focus().setImage({ src: url }).run();
            }}
            title="Bild einfügen"
          >
            🖼
          </ToolbarBtn>

          <Divider />

          {/* Horizontal rule */}
          <ToolbarBtn
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            title="Trennlinie"
          >
            —
          </ToolbarBtn>

          {/* Undo / Redo */}
          <ToolbarBtn
            onClick={() => editor.chain().focus().undo().run()}
            title="Rückgängig"
          >
            ↩
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => editor.chain().focus().redo().run()}
            title="Wiederholen"
          >
            ↪
          </ToolbarBtn>

          <Divider />

          {/* HTML toggle */}
          <button
            type="button"
            onClick={() => setShowHtml(!showHtml)}
            className={`ml-auto px-2 py-1 rounded text-xs transition-colors ${
              showHtml
                ? 'bg-indigo-600 text-white'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            &lt;/&gt; HTML
          </button>
        </div>

        {/* Link input */}
        {showLinkInput && (
          <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 border-b border-indigo-100">
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://..."
              className="flex-1 text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              onKeyDown={(e) => { if (e.key === 'Enter') applyLink(); if (e.key === 'Escape') setShowLinkInput(false); }}
              autoFocus
            />
            <button type="button" onClick={applyLink} className="text-sm px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700">OK</button>
            <button type="button" onClick={() => setShowLinkInput(false)} className="text-sm px-2 py-1 text-gray-500 hover:text-gray-700">✕</button>
          </div>
        )}

        {/* Editor / HTML view */}
        {showHtml ? (
          <textarea
            className="w-full font-mono text-xs p-3 focus:outline-none resize-none"
            rows={20}
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              editor.commands.setContent(e.target.value);
            }}
            spellCheck={false}
          />
        ) : (
          <EditorContent
            editor={editor}
            className="prose prose-sm max-w-none p-4 min-h-[300px] focus:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[280px]"
          />
        )}
      </div>
    </div>
  );
}
