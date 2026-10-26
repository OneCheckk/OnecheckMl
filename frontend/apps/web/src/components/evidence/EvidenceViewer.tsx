import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { useQuery } from '@tanstack/react-query';
import { ZoomIn, ZoomOut, ChevronLeft, ChevronRight, MoveHorizontal, FileWarning, RefreshCw } from 'lucide-react';
import type { FindingEvidence } from '@contracts';
import { BBoxOverlay, isDrawableBBox } from './BBoxOverlay';
import { apiClient } from '../../api/client';
import { describeApiError } from '../../api/errors';
import { Button } from '../ui';

// PDF.js worker. react-pdf 9.2.1 bundles its own pdfjs-dist (4.8.69, nested in
// node_modules/react-pdf/node_modules per package-lock.json), while the
// workspace root resolves pdfjs-dist 4.10.38. The worker must match react-pdf's
// API version, so it is loaded from react-pdf's own copy.
try {
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    '../../../../../node_modules/react-pdf/node_modules/pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
} catch {
  // Test or non-browser environments
}

export interface DocumentTab {
  docId: string;
  name: string;
  /** Public URL (mock fixtures) */
  fileUrl?: string;
  /** Fetch through the authenticated API: GET /documents/:docId/file */
  viaApi?: boolean;
  docType?: string;
}

interface EvidenceViewerProps {
  documents?: DocumentTab[];
  activeDocId?: string;
  onSelectDoc?: (docId: string) => void;
  selectedEvidence?: FindingEvidence | null;
  evidenceList?: FindingEvidence[];
  onSelectEvidence?: (evidence: FindingEvidence) => void;
  /** Shown when no documents are available */
  emptyMessage?: string;
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 2.5;

/** Loads a document as a Blob, using the authenticated API client when needed. */
function useDocumentBlob(doc?: DocumentTab) {
  return useQuery({
    queryKey: ['doc-file', doc?.docId, doc?.fileUrl],
    enabled: !!doc,
    staleTime: 5 * 60 * 1000,
    retry: 0,
    queryFn: async (): Promise<Blob> => {
      if (!doc) throw new Error('No document');
      if (doc.viaApi) {
        const res = await apiClient.get(`/documents/${doc.docId}/file`, { responseType: 'blob' });
        return res.data as Blob;
      }
      const res = await fetch(doc.fileUrl!);
      if (!res.ok) throw new Error(`The file could not be fetched (HTTP ${res.status}).`);
      return await res.blob();
    },
  });
}

const sameEvidence = (a?: FindingEvidence | null, b?: FindingEvidence | null) =>
  !!a && !!b && a.label === b.label && a.source?.docId === b.source?.docId && a.source?.page === b.source?.page;

export const EvidenceViewer: React.FC<EvidenceViewerProps> = ({
  documents = [],
  activeDocId,
  onSelectDoc,
  selectedEvidence,
  evidenceList = [],
  onSelectEvidence,
  emptyMessage = 'No stored documents are available for this application.',
}) => {
  const [currentDocId, setCurrentDocId] = useState<string>(activeDocId || documents[0]?.docId || '');
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(600);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep a valid document selected when the list changes
  useEffect(() => {
    if (!documents.find((d) => d.docId === currentDocId) && documents[0]) setCurrentDocId(documents[0].docId);
  }, [documents, currentDocId]);

  useEffect(() => {
    if (activeDocId) setCurrentDocId(activeDocId);
  }, [activeDocId]);

  // Jump to the selected evidence's document and page
  useEffect(() => {
    const src = selectedEvidence?.source;
    if (!src) return;
    if (src.docId && src.docId !== currentDocId && documents.some((d) => d.docId === src.docId)) {
      setCurrentDocId(src.docId);
      onSelectDoc?.(src.docId);
    }
    if (src.page) setPageNumber(src.page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEvidence]);

  // Reset page state when the document changes
  useEffect(() => {
    setNumPages(null);
    setRenderError(null);
  }, [currentDocId]);

  // Fit-to-width measurement
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setContainerWidth(Math.max(240, Math.floor(w - 32)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const activeDoc = documents.find((d) => d.docId === currentDocId) || documents[0];
  const blobQ = useDocumentBlob(activeDoc);
  const blob = blobQ.data;
  const isImage = !!blob && blob.type.startsWith('image/');
  const imageUrl = useMemo(() => (blob && isImage ? URL.createObjectURL(blob) : null), [blob, isImage]);
  useEffect(() => () => { if (imageUrl) URL.revokeObjectURL(imageUrl); }, [imageUrl]);

  const pageWidth = Math.round(containerWidth * scale);

  const pageEvidence = evidenceList.filter((e) => e.source?.docId === currentDocId && (e.source?.page ?? 1) === pageNumber);
  const drawable = pageEvidence.filter((e) => isDrawableBBox(e.source?.bbox));
  const elsewhere = evidenceList.filter((e) => !(e.source?.docId === currentDocId && (e.source?.page ?? 1) === pageNumber));
  const missingDocs = evidenceList.filter((e) => e.source?.docId && !documents.some((d) => d.docId === e.source.docId));

  if (documents.length === 0) {
    return (
      <div data-testid="evidence-viewer" className="flex h-full flex-col items-center justify-center rounded border border-line bg-white p-8 text-center">
        <FileWarning className="mb-2 h-6 w-6 text-ink-faint" aria-hidden="true" />
        <p className="text-sm text-ink-soft">{emptyMessage}</p>
        {evidenceList.length > 0 && (
          <p className="mt-1 text-meta text-ink-faint">The selected finding cites {evidenceList.length} evidence item(s), listed in the finding detail.</p>
        )}
      </div>
    );
  }

  const loadError = blobQ.isError ? describeApiError(blobQ.error, 'The document could not be retrieved.') : null;

  return (
    <div data-testid="evidence-viewer" className="flex h-full min-h-0 flex-col overflow-hidden rounded border border-line bg-white">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-[#f6f8fa] px-3 py-2">
        <label className="sr-only" htmlFor="evidence-doc-select">
          Document
        </label>
        <select
          id="evidence-doc-select"
          value={currentDocId}
          onChange={(e) => {
            setCurrentDocId(e.target.value);
            setPageNumber(1);
            onSelectDoc?.(e.target.value);
          }}
          className="field-select h-8 max-w-[280px] text-[13px]"
        >
          {documents.map((d) => (
            <option key={d.docId} value={d.docId}>
              {d.name}
            </option>
          ))}
        </select>

        <div className="ml-auto flex items-center gap-1.5">
          <div className="flex items-center rounded border border-line-strong bg-white">
            <button
              type="button"
              onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
              disabled={pageNumber <= 1}
              aria-label="Previous page"
              className="flex h-8 w-8 items-center justify-center text-ink-soft hover:bg-brand-50 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[84px] text-center text-[12.5px] tabular-nums" aria-live="polite">
              Page {pageNumber}
              {numPages ? ` of ${numPages}` : ''}
            </span>
            <button
              type="button"
              onClick={() => setPageNumber((p) => (numPages ? Math.min(numPages, p + 1) : p + 1))}
              disabled={!!numPages && pageNumber >= numPages}
              aria-label="Next page"
              className="flex h-8 w-8 items-center justify-center text-ink-soft hover:bg-brand-50 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center rounded border border-line-strong bg-white">
            <button
              type="button"
              onClick={() => setScale((s) => Math.max(MIN_SCALE, +(s - 0.1).toFixed(2)))}
              aria-label="Zoom out"
              className="flex h-8 w-8 items-center justify-center text-ink-soft hover:bg-brand-50"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="w-12 text-center text-[12.5px] tabular-nums">{Math.round(scale * 100)}%</span>
            <button
              type="button"
              onClick={() => setScale((s) => Math.min(MAX_SCALE, +(s + 0.1).toFixed(2)))}
              aria-label="Zoom in"
              className="flex h-8 w-8 items-center justify-center text-ink-soft hover:bg-brand-50"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setScale(1)}
            className="inline-flex h-8 items-center gap-1 rounded border border-line-strong bg-white px-2 text-[12.5px] text-ink-soft hover:bg-brand-50"
            title="Fit page to width"
          >
            <MoveHorizontal className="h-3.5 w-3.5" aria-hidden="true" /> Fit width
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col 2xl:flex-row">
        {/* Canvas */}
        <div ref={containerRef} className="min-h-[320px] flex-1 overflow-auto bg-[#e7ebf0] p-4">
          {blobQ.isLoading ? (
            <div className="flex h-64 items-center justify-center text-sm text-ink-soft" role="status">
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> Loading document…
            </div>
          ) : loadError || renderError ? (
            <div className="mx-auto max-w-md rounded border border-bad-line bg-white p-4 text-sm" role="alert">
              <p className="font-semibold text-ink">This document could not be displayed</p>
              <p className="mt-1 text-ink-soft">{loadError ? loadError.message : renderError}</p>
              {loadError?.requestId && <p className="mt-1 text-[11.5px] text-ink-faint">Request ID: {loadError.requestId}</p>}
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setRenderError(null); blobQ.refetch(); }}>
                  <RefreshCw className="h-3.5 w-3.5" /> Try again
                </Button>
                {blob && (
                  <a
                    href={URL.createObjectURL(blob)}
                    download={activeDoc?.name}
                    className="inline-flex h-8 items-center rounded border border-line-strong bg-white px-2.5 text-[13px] font-semibold text-brand-800 hover:bg-brand-50"
                  >
                    Download file
                  </a>
                )}
              </div>
              {pageEvidence.length > 0 && (
                <p className="mt-3 text-meta text-ink-faint">Cited evidence for this page is listed alongside; regions cannot be drawn without the page.</p>
              )}
            </div>
          ) : blob ? (
            <div className="mx-auto w-fit">
              <div className="relative bg-white shadow-[0_1px_3px_rgba(16,24,40,0.15)]" data-testid="evidence-page-wrapper">
                {isImage && imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={`${activeDoc?.name} (image document)`}
                    style={{ width: pageWidth }}
                    className="block"
                    onLoad={() => setNumPages(1)}
                    onError={() => setRenderError('The image could not be decoded.')}
                  />
                ) : (
                  <Document
                    file={blob}
                    onLoadSuccess={({ numPages: n }) => {
                      setNumPages(n);
                      setPageNumber((p) => Math.min(Math.max(1, p), n));
                    }}
                    onLoadError={(e) => setRenderError(`The file is not a readable PDF (${e?.message ?? 'unknown error'}).`)}
                    loading={<div className="flex h-64 w-[320px] items-center justify-center text-sm text-ink-soft">Rendering…</div>}
                  >
                    <Page
                      pageNumber={pageNumber}
                      width={pageWidth}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                      onRenderError={() => setRenderError('This page could not be rendered.')}
                      loading={<div style={{ width: pageWidth, height: pageWidth * 1.414 }} />}
                    />
                  </Document>
                )}
                {/* Overlays share the page box, so percentage coordinates map directly */}
                {drawable.map((ev, idx) => (
                  <BBoxOverlay
                    key={`${ev.label}-${idx}`}
                    index={idx + 1}
                    bbox={ev.source.bbox}
                    title={`${ev.label}: ${ev.value}${ev.unit ? ' ' + ev.unit : ''}`}
                    isSelected={sameEvidence(selectedEvidence, ev)}
                    onClick={() => onSelectEvidence?.(ev)}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Evidence list (keyboard reachable equivalent of the overlays) */}
        <aside aria-label="Cited evidence" className="max-h-[200px] shrink-0 overflow-y-auto border-t border-line bg-white 2xl:max-h-none 2xl:w-64 2xl:border-l 2xl:border-t-0">
          <div className="border-b border-line-soft px-3 py-2">
            <h3 className="text-[13px] font-semibold text-ink">On this page ({pageEvidence.length})</h3>
          </div>
          {pageEvidence.length === 0 ? (
            <p className="px-3 py-3 text-meta text-ink-faint">No cited evidence on page {pageNumber} of this document.</p>
          ) : (
            <ul className="divide-y divide-line-soft">
              {pageEvidence.map((ev, idx) => {
                const drawIdx = drawable.indexOf(ev);
                const selected = sameEvidence(selectedEvidence, ev);
                return (
                  <li key={idx}>
                    <button
                      type="button"
                      onClick={() => onSelectEvidence?.(ev)}
                      aria-pressed={selected}
                      className={`w-full px-3 py-2 text-left text-[12.5px] hover:bg-brand-50 ${selected ? 'bg-bad-bg/70' : ''}`}
                    >
                      <span className="flex items-center gap-1.5 font-semibold text-ink">
                        {drawIdx >= 0 && (
                          <span className={`rounded-sm px-1 text-[10.5px] text-white ${selected ? 'bg-bad' : 'bg-warn'}`}>{drawIdx + 1}</span>
                        )}
                        {ev.label}
                      </span>
                      <span className="mt-0.5 block font-mono text-ink">
                        {String(ev.value)} {ev.unit ?? ''}
                      </span>
                      {ev.source.snippet && <span className="mt-0.5 block text-ink-soft">“{ev.source.snippet}”</span>}
                      <span className="mt-0.5 block text-[11.5px] text-ink-faint">
                        {typeof ev.confidence === 'number' && <>Extraction confidence {Math.round(ev.confidence * 100)}% · </>}
                        {drawIdx >= 0 ? 'Region highlighted' : 'No region coordinates'}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {elsewhere.length > 0 && (
            <>
              <div className="border-y border-line-soft px-3 py-2">
                <h3 className="text-[13px] font-semibold text-ink">Elsewhere ({elsewhere.length})</h3>
              </div>
              <ul className="divide-y divide-line-soft">
                {elsewhere.map((ev, idx) => {
                  const available = documents.some((d) => d.docId === ev.source?.docId);
                  return (
                    <li key={idx} className="px-3 py-2 text-[12.5px]">
                      <span className="block font-semibold text-ink">{ev.label}</span>
                      {available ? (
                        <button type="button" className="link text-[12px]" onClick={() => onSelectEvidence?.(ev)}>
                          Go to page {ev.source.page}
                          {ev.source.docId !== currentDocId ? ` of ${documents.find((d) => d.docId === ev.source.docId)?.name}` : ''}
                        </button>
                      ) : (
                        <span className="text-[11.5px] text-ink-faint">Cited document {ev.source?.docId} is not among the stored files.</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          {missingDocs.length > 0 && elsewhere.length === 0 && (
            <p className="px-3 py-2 text-[11.5px] text-ink-faint">Some cited documents are not among the stored files.</p>
          )}
        </aside>
      </div>
    </div>
  );
};
