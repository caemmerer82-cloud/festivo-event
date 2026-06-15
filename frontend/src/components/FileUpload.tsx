import { useRef, useState } from 'react';
import { PhotoIcon, PaperClipIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface FileUploadProps {
  label: string;
  accept: string;
  onChange: (file: File | null) => void;
  currentUrl?: string;       // existing image URL (shown as preview)
  currentFilename?: string;  // existing non-image filename
  maxSizeMB?: number;        // client-side size limit in MB (default: 10)
  hint?: string;
}

export default function FileUpload({ label, accept, onChange, currentUrl, currentFilename, maxSizeMB = 10, hint }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [newFilename, setNewFilename] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // null = unchanged, 'cleared' = user removed it
  const [cleared, setCleared] = useState(false);

  const isImage = accept.includes('image');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setError(null);
    if (inputRef.current) inputRef.current.value = '';

    if (file) {
      const sizeMB = file.size / 1024 / 1024;
      if (sizeMB > maxSizeMB) {
        setError(`Datei zu groß: ${sizeMB.toFixed(1)} MB (max. ${maxSizeMB} MB)`);
        onChange(null);
        return;
      }
      setNewFilename(file.name);
      setCleared(false);
      if (isImage) setPreview(URL.createObjectURL(file));
      onChange(file);
    }
  };

  const handleClear = () => {
    setPreview(null);
    setNewFilename(null);
    setCleared(true);
    onChange(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  // What to display
  const displayImageUrl = preview || (!cleared ? currentUrl : null);
  const displayFilename = newFilename || (!cleared ? currentFilename : null);

  return (
    <div>
      <label className="label">{label}</label>

      {isImage && displayImageUrl ? (
        <div className="relative group inline-block">
          <img
            src={displayImageUrl}
            alt="Vorschau"
            className="h-32 w-auto rounded-lg object-cover border border-gray-200"
          />
          <button
            type="button"
            onClick={handleClear}
            className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            title="Entfernen"
          >
            <XMarkIcon className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="absolute bottom-1 right-1 px-2 py-0.5 text-xs bg-black/50 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
          >
            Ändern
          </button>
        </div>
      ) : !isImage && displayFilename ? (
        <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
          <PaperClipIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
          <span className="text-sm text-gray-700 flex-1 truncate">{displayFilename}</span>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="text-xs text-indigo-600 hover:underline flex-shrink-0"
          >
            Ändern
          </button>
          <button type="button" onClick={handleClear} className="text-gray-400 hover:text-red-500 flex-shrink-0">
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 rounded-lg text-gray-400 hover:border-primary-400 hover:text-primary-500 transition-colors"
        >
          <PhotoIcon className="h-8 w-8 mb-1" />
          <span className="text-xs">Datei auswählen</span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="hidden"
      />
      {error && <p className="mt-1 text-xs text-red-500 font-medium">{error}</p>}
      {!error && hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}
