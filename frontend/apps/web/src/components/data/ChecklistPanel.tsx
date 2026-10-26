import React, { useRef, useState } from 'react';
import clsx from 'clsx';
import { UploadCloud, RefreshCw, FileText } from 'lucide-react';
import type { ChecklistItem } from '@contracts';
import { StateChip, PlaceholderTag } from '../status';
import { humanize } from '../status/statusMaps';
import { Notice } from '../ui';
import { UPLOAD_ACCEPT, UPLOAD_EXTENSIONS, UPLOAD_MAX_MB } from '../../config';
import { errorMessage } from '../../api/errors';

type Item = ChecklistItem & { docTypes?: string[] };

interface ChecklistPanelProps {
  items: Item[];
  onUploadFile: (itemId: string, file: File, docTypeHint: string, onProgress?: (pct: number) => void) => Promise<void>;
  onReplaceFile?: (itemId: string, file: File) => Promise<void>;
  onDeleteVersion?: (itemId: string) => Promise<void>;
  /** When false, upload controls are hidden (e.g. application already submitted). */
  canUpload?: boolean;
  uploadDisabledReason?: string;
}

interface RowState {
  progress?: number;
  error?: string;
  uploadedName?: string;
}

const validateFile = (file: File): string | null => {
  const name = file.name.toLowerCase();
  if (!UPLOAD_EXTENSIONS.some((ext) => name.endsWith(ext))) {
    return `“${file.name}” is not an accepted format. Upload a PDF, JPEG or PNG file.`;
  }
  if (file.size > UPLOAD_MAX_MB * 1024 * 1024) {
    return `“${file.name}” is larger than ${UPLOAD_MAX_MB} MB.`;
  }
  return null;
};

export const ChecklistPanel: React.FC<ChecklistPanelProps> = ({
  items,
  onUploadFile,
  canUpload = true,
  uploadDisabledReason,
}) => {
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  const required = items.filter((i) => i.required);
  const requiredStored = required.filter((i) => i.state !== 'MISSING').length;
  const analysed = items.filter((i) => i.state === 'DONE').length;

  const setRow = (id: string, patch: RowState) => setRows((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const handleFile = async (item: Item, file: File) => {
    const invalid = validateFile(file);
    if (invalid) {
      setRow(item.id, { error: invalid, progress: undefined });
      return;
    }
    setBusyId(item.id);
    setRow(item.id, { error: undefined, progress: 0, uploadedName: undefined });
    try {
      await onUploadFile(item.id, file, item.docType, (pct) => setRow(item.id, { progress: pct }));
      setRow(item.id, { progress: undefined, uploadedName: file.name });
    } catch (err) {
      setRow(item.id, { progress: undefined, error: errorMessage(err, 'The server did not accept this file.') });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div data-testid="checklist-panel" className="panel">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Required documents</h2>
          <p className="panel-subtitle">
            Accepted formats: PDF, JPEG, PNG · Up to {UPLOAD_MAX_MB} MB per file (server-configured)
          </p>
        </div>
        <p className="text-meta text-ink-soft" aria-live="polite">
          <span className="font-semibold text-ink tabular-nums">{requiredStored}</span> of{' '}
          <span className="tabular-nums">{required.length}</span> required uploaded ·{' '}
          <span className="tabular-nums">{analysed}</span> analysed
        </p>
      </div>

      {!canUpload && uploadDisabledReason && (
        <div className="border-b border-line-soft px-4 py-2.5">
          <Notice tone="muted">{uploadDisabledReason}</Notice>
        </div>
      )}

      {items.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-ink-soft">
          No checklist has been returned for this application yet.
        </p>
      ) : (
        <ul className="divide-y divide-line-soft">
          {items.map((item) => {
            const row = rows[item.id] ?? {};
            const isBusy = busyId === item.id;
            const hasFile = item.state !== 'MISSING';
            const types = item.docTypes?.length ? item.docTypes : item.docType ? [item.docType] : [];
            return (
              <li key={item.id} className="grid gap-3 px-4 py-3.5 md:grid-cols-[1fr_auto] md:items-start">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden="true" />
                    <span className="font-semibold text-ink">{item.label}</span>
                    <span className={clsx('text-[11.5px] font-medium', item.required ? 'text-bad' : 'text-ink-faint')}>
                      {item.required ? 'Required' : 'Optional'}
                    </span>
                    <StateChip state={item.state} />
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 pl-6 text-meta text-ink-faint">
                    {types.length > 0 && <span>Document type: {types.map(humanize).join(' / ')}</span>}
                    {item.clauseRef && !item.placeholder && item.clauseRef !== 'HANDBOOK-REF-TBD' && (
                      <span>
                        Clause: <span className="font-mono">{item.clauseRef}</span>
                      </span>
                    )}
                    {(item.placeholder || item.clauseRef === 'HANDBOOK-REF-TBD') && <PlaceholderTag />}
                    {item.fileName && <span>File: {item.fileName}</span>}
                  </div>

                  {item.state === 'EXTRACTING' && (
                    <p className="mt-1.5 pl-6 text-meta text-info">
                      Stored. Analysis is in progress{typeof item.processingProgress === 'number' ? ` (${item.processingProgress}%)` : ''}; results
                      will appear once the server finishes.
                    </p>
                  )}
                  {item.state === 'UPLOADED' && (
                    <p className="mt-1.5 pl-6 text-meta text-ink-soft">Stored. Not yet analysed — storage is not verification.</p>
                  )}
                  {item.state === 'FAILED' && (
                    <p className="mt-1.5 pl-6 text-meta text-bad">The server could not analyse this file. Upload it again or replace it.</p>
                  )}

                  {typeof row.progress === 'number' && (
                    <div className="mt-2 pl-6" role="status" aria-live="polite">
                      <div className="flex justify-between text-meta text-ink-soft">
                        <span>Uploading…</span>
                        <span className="tabular-nums">{row.progress}%</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full max-w-sm overflow-hidden rounded-sm bg-line-soft">
                        <div className="h-full bg-brand-600 transition-all" style={{ width: `${row.progress}%` }} />
                      </div>
                    </div>
                  )}
                  {row.uploadedName && (
                    <p className="mt-1.5 pl-6 text-meta text-ok" role="status">
                      “{row.uploadedName}” was accepted by the server. Analysis runs separately.
                    </p>
                  )}
                  {row.error && (
                    <p className="mt-1.5 pl-6 text-meta font-medium text-bad" role="alert">
                      {row.error}
                    </p>
                  )}
                </div>

                {canUpload && (
                  <div className="pl-6 md:pl-0">
                    <input
                      ref={(el) => (inputs.current[item.id] = el)}
                      type="file"
                      accept={UPLOAD_ACCEPT}
                      className="sr-only"
                      id={`upload-${item.id}`}
                      disabled={isBusy}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = '';
                        if (f) handleFile(item, f);
                      }}
                    />
                    <label
                      htmlFor={`upload-${item.id}`}
                      className={clsx(
                        'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded border px-2.5 text-[13px] font-semibold',
                        hasFile
                          ? 'border-line-strong bg-white text-brand-800 hover:bg-brand-50'
                          : 'border-brand-700 bg-brand-700 text-white hover:bg-brand-800',
                        isBusy && 'pointer-events-none opacity-60'
                      )}
                    >
                      {isBusy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}
                      {hasFile ? 'Replace file' : 'Upload file'}
                      <span className="sr-only"> for {item.label}</span>
                    </label>
                    {row.error && (
                      <button type="button" className="link ml-2 text-meta" onClick={() => inputs.current[item.id]?.click()}>
                        Try again
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
