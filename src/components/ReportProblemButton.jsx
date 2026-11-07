import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bug, Check, Info, Paperclip, X } from 'lucide-react';
import { settingsApi } from '../api.js';

const MAX_FILES = 4;
const MAX_BYTES = 10 * 1024 * 1024;

function currentPath(portal) {
  if (typeof window === 'undefined') return portal;
  return `${portal} ${window.location.pathname || '/'}${window.location.search || ''}`.slice(0, 480);
}

function isMediaFile(file) {
  const type = file?.type || '';
  if (type.startsWith('image/') || type.startsWith('video/')) return true;
  const ext = (file?.name || '').split('.').pop()?.toLowerCase();
  return ['jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'mov', 'webm', 'm4v'].includes(ext);
}

export function ReportProblemModal({ path, onClose, onSubmit }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);
  const filesRef = useRef([]);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => () => {
    filesRef.current.forEach((item) => URL.revokeObjectURL(item.preview));
  }, []);

  const addFiles = (list) => {
    const incoming = Array.from(list || []).filter(isMediaFile);
    if (!incoming.length) {
      setError('Sirf photo ya video choose karein.');
      return;
    }
    let message = '';
    setFiles((current) => {
      const next = [...current];
      for (const file of incoming) {
        if (next.length >= MAX_FILES) {
          message = `Maximum ${MAX_FILES} files.`;
          break;
        }
        const used = next.reduce((sum, item) => sum + item.file.size, 0);
        if (file.size > MAX_BYTES || used + file.size > MAX_BYTES) {
          message = 'Photo aur video milakar 10 MB se kam honi chahiye.';
          continue;
        }
        next.push({
          id: `${file.name}-${file.size}-${file.lastModified}-${next.length}`,
          file,
          preview: URL.createObjectURL(file),
          kind: (file.type || '').startsWith('video/') ? 'video' : 'image',
        });
      }
      return next;
    });
    setError(message);
  };

  const removeFile = (id) => {
    setFiles((current) => {
      const target = current.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      return current.filter((item) => item.id !== id);
    });
  };

  const submit = async () => {
    if (!title.trim() || busy) return;
    if (!body.trim() && files.length === 0) {
      setError('Problem likhein, ya photo/video lagayein.');
      return;
    }
    setBusy(true);
    setError('');
    const form = new FormData();
    form.append('title', title.trim());
    form.append('body', body.trim());
    form.append('path', path || '');
    form.append('source', 'user');
    files.forEach((item) => form.append('files', item.file));
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err.message || 'Submit failed');
    } finally {
      setBusy(false);
    }
  };

  const modal = (
    <div className="fixed inset-0 z-[200] flex items-end justify-center overflow-y-auto bg-[#0b1b33]/45 p-3 backdrop-blur-[2px] sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="my-auto max-h-[calc(100vh-24px)] w-full max-w-lg overflow-y-auto rounded-[12px] border border-[#dbe5f2] bg-white p-5 shadow-[0_24px_64px_rgba(15,23,42,0.28)]"
        onClick={(e) => e.stopPropagation()}
        onPaste={(event) => {
          const pasted = [];
          for (const item of event.clipboardData?.items || []) {
            if (item.kind !== 'file') continue;
            const file = item.getAsFile();
            if (file && isMediaFile(file)) pasted.push(file);
          }
          if (pasted.length) {
            event.preventDefault();
            addFiles(pasted);
          }
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Report a problem"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 size-5 shrink-0 text-[#0b65e5]" />
            <div className="min-w-0">
              <h3 className="text-[16px] font-extrabold text-[#1e3261]">Report a problem</h3>
              <p className="mt-0.5 break-all text-[12px] font-semibold text-[#7a8fa6]">{path}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-[8px] p-2 hover:bg-[#f1f5f9]" aria-label="Close"><X className="size-4" /></button>
        </div>
        <label className="mt-4 block text-[12px] font-bold text-[#53647f]">
          Short title
          <input
            className="mt-1.5 h-11 w-full rounded-[8px] border border-[#d9e2ec] px-3 text-[13px]"
            placeholder="Example: Invoice print blank aa raha hai"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="mt-3 block text-[12px] font-bold text-[#53647f]">
          Problem
          <textarea
            className="mt-1.5 min-h-[120px] w-full rounded-[10px] border border-[#d9e2ec] px-3 py-2 text-[13px]"
            placeholder="Problem likhein. Screenshot yahin paste kar sakte hain."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
          />
        </label>
        {files.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {files.map((item) => (
              <div key={item.id} className="relative h-16 w-20 overflow-hidden rounded-[8px] border border-[#d9e2ec] bg-[#f8fafc]">
                {item.kind === 'video' ? (
                  <video src={item.preview} className="h-full w-full object-cover" muted />
                ) : (
                  <img src={item.preview} alt="" className="h-full w-full object-cover" />
                )}
                <button type="button" onClick={() => removeFile(item.id)} className="absolute top-0.5 right-0.5 rounded-full bg-white/90 p-0.5 text-[#b91c1c]" aria-label="Remove file">
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        ) : null}
        <div className="mt-3 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex h-10 items-center gap-2 rounded-[8px] border border-[#d9e2ec] px-3 text-[12px] font-extrabold text-[#1e3261]"
          >
            <Paperclip className="size-4" />
            Select
          </button>
          <button type="button" onClick={submit} disabled={busy} className="inline-flex size-10 items-center justify-center rounded-full bg-[#f43f5e] text-white disabled:opacity-60" aria-label="Send">
            <Check className="size-4" />
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={(event) => {
            addFiles(event.target.files);
            event.target.value = '';
          }}
        />
        {error ? <p className="mt-2 text-[12px] font-bold text-[#dc2626]">{error}</p> : null}
        <p className="mt-2 text-[11px] font-semibold text-[#9aa8bc]">Photo ya video lagayein, screenshot paste karein. Enter se bhejein. Nayi line ke liye Shift+Enter.</p>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

export function ReportProblemButton({ portal = 'CRM', notify, className = '' }) {
  const [open, setOpen] = useState(false);
  const path = currentPath(portal);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-[#fecaca] bg-[#fff1f2] text-[#e11d48] transition hover:bg-[#ffe4e6] ${className}`}
        aria-label="Report a problem"
        title="Report a problem"
      >
        <Bug className="size-[18px]" />
      </button>
      {open ? (
        <ReportProblemModal
          path={path}
          onClose={() => setOpen(false)}
          onSubmit={async (payload) => {
            await settingsApi.bugReports.create(payload);
            setOpen(false);
            notify?.('Bug report submitted', 'success');
          }}
        />
      ) : null}
    </>
  );
}
