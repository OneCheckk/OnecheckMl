import React, { useState } from 'react';
import { useForensicsSuite } from '../../api/queries';
import type { ForensicsSuiteData } from '@contracts';
import { Skeleton, ErrorState, Tabs, TabPanel, Notice, StatStrip } from '../ui';
import { StatusPill, SyntheticTag } from '../status';
import { humanize } from '../status/statusMaps';

const Empty: React.FC<{ what: string }> = ({ what }) => (
  <p className="px-3 py-4 text-sm text-ink-soft">No {what} results were returned for this application.</p>
);

const yesNo = (v: unknown) => (v === true ? 'Yes' : v === false ? 'No' : '—');

/** Contract / mock shape */
const SuiteView: React.FC<{ data: ForensicsSuiteData }> = ({ data }) => {
  const tabs = [
    { id: 'pdf', label: 'PDF revisions', count: data.pdfRevisions.length },
    { id: 'ela', label: 'Error level analysis', count: data.ela.length },
    { id: 'phash', label: 'Image hashing', count: data.perceptual.length },
    { id: 'geo', label: 'Photo location', count: data.photos.length },
    { id: 'faculty', label: 'Faculty identity', count: data.faculty.length },
    { id: 'blueprint', label: 'Floor plan area' },
  ];
  const [tab, setTab] = useState('pdf');
  const [elaIdx, setElaIdx] = useState(0);
  const ela = data.ela[elaIdx];

  return (
    <div className="rounded border border-line bg-white">
      <Tabs tabs={tabs} activeTab={tab} onChange={setTab} idPrefix="fx" aria-label="Forensic analyses" className="px-2 pt-1" />

      <TabPanel idPrefix="fx" id="pdf" active={tab === 'pdf'}>
        {data.pdfRevisions.length === 0 ? <Empty what="PDF revision" /> : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Revision</th><th>Saved at</th><th>Producer software</th><th>Note</th><th>Signal</th></tr></thead>
              <tbody>
                {data.pdfRevisions.map((r) => (
                  <tr key={r.stream}>
                    <td className="font-mono">#{r.stream}</td>
                    <td className="whitespace-nowrap font-mono text-[12px]">{r.savedAt}</td>
                    <td>{r.tool}</td>
                    <td className="text-ink-soft">{r.note}</td>
                    <td>
                      {r.suspicious ? (
                        <StatusPill domain="verification" value="MANUAL_REVIEW_REQUIRED" />
                      ) : (
                        <span className="text-meta text-ink-faint">No signal</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </TabPanel>

      <TabPanel idPrefix="fx" id="ela" active={tab === 'ela'} className="space-y-3 p-3">
        {data.ela.length === 0 ? <Empty what="error level analysis" /> : (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label htmlFor="ela-doc" className="field-label">Document</label>
                <select id="ela-doc" className="field-select h-8 text-[13px]" value={elaIdx} onChange={(e) => setElaIdx(Number(e.target.value))}>
                  {data.ela.map((d, i) => <option key={d.documentId} value={i}>{d.documentName}</option>)}
                </select>
              </div>
              {ela?.isSimulated && <SyntheticTag label="Simulated result" />}
            </div>
            <dl className="meta-list sm:grid-cols-[200px_1fr]">
              <dt>Compression variance score</dt>
              <dd className="font-mono">{ela?.score?.toFixed?.(2) ?? '—'}</dd>
              <dt>Flagged regions</dt>
              <dd>{ela?.flaggedRegions.length ?? 0}</dd>
            </dl>
            {ela && ela.flaggedRegions.length > 0 && (
              <table className="data-table rounded border border-line">
                <thead><tr><th>Region</th><th>Position (x, y)</th><th>Size (w × h)</th></tr></thead>
                <tbody>
                  {ela.flaggedRegions.map((r, i) => (
                    <tr key={i}>
                      <td>{r.label}</td>
                      <td className="font-mono text-[12px]">{r.x}, {r.y}</td>
                      <td className="font-mono text-[12px]">{r.w} × {r.h}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="text-meta text-ink-faint">A heatmap image is not shown because the server does not return one; regions are listed as returned.</p>
          </>
        )}
      </TabPanel>

      <TabPanel idPrefix="fx" id="phash" active={tab === 'phash'}>
        {data.perceptual.length === 0 ? <Empty what="image hashing" /> : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Photo</th><th>64-bit hash</th><th>Matched institution</th><th>Hamming distance</th><th>Stock image</th></tr></thead>
              <tbody>
                {data.perceptual.map((p) => (
                  <tr key={p.photoId}>
                    <td className="font-mono">{p.photoId}</td>
                    <td className="font-mono text-[12px]">{p.hash64}</td>
                    <td>{p.matchedInstitution ?? <span className="text-ink-faint">No match reported</span>}</td>
                    <td className="tabular-nums">{p.hammingDistance ?? '—'}</td>
                    <td>{yesNo(p.isStockImage)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </TabPanel>

      <TabPanel idPrefix="fx" id="geo" active={tab === 'geo'}>
        {data.photos.length === 0 ? <Empty what="photo location" /> : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Photo type</th><th>EXIF coordinates</th><th>Distance from campus</th><th>Result</th></tr></thead>
              <tbody>
                {data.photos.map((p) => (
                  <tr key={p.id}>
                    <td>{humanize(p.photoType)}</td>
                    <td className="font-mono text-[12px]">
                      {p.gpsLatitude != null ? `${p.gpsLatitude.toFixed(4)}, ${p.gpsLongitude?.toFixed(4)}` : 'Not present'}
                    </td>
                    <td className="tabular-nums">{p.distanceFromCampus != null ? `${p.distanceFromCampus.toLocaleString('en-IN')} m` : '—'}</td>
                    <td><StatusPill domain="geofence" value={p.geofenceStatus} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </TabPanel>

      <TabPanel idPrefix="fx" id="faculty" active={tab === 'faculty'}>
        {data.faculty.length === 0 ? <Empty what="faculty identity" /> : (
          <>
            <p className="px-3 pt-3 text-meta text-ink-faint">Identifiers are compared as keyed hashes; raw identifiers are not displayed.</p>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Name (normalised)</th><th>Identifier type</th><th>Also listed by</th><th>Match confidence</th><th>Result</th></tr></thead>
                <tbody>
                  {data.faculty.map((f) => (
                    <tr key={f.id}>
                      <td>{f.nameNormalized}</td>
                      <td>{f.identifierType}</td>
                      <td>{f.matchInstitutionName ?? <span className="text-ink-faint">No other institution</span>}</td>
                      <td className="tabular-nums">{f.matchConfidence != null ? `${Math.round(f.matchConfidence * 100)}%` : '—'}</td>
                      <td>
                        {f.isGhostFlagged ? <StatusPill domain="verification" value="MISMATCH_DETECTED" /> : <span className="text-meta text-ink-faint">No collision reported</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </TabPanel>

      <TabPanel idPrefix="fx" id="blueprint" active={tab === 'blueprint'} className="space-y-3 p-3">
        <div className="flex items-center gap-2">
          {data.blueprint.isSimulated && <SyntheticTag label="Simulated result" />}
        </div>
        <dl className="meta-list sm:grid-cols-[220px_1fr]">
          <dt>Area claimed in the application</dt>
          <dd className="font-mono">{data.blueprint.claimedSqm} m²</dd>
          <dt>Area detected in the floor plan</dt>
          <dd className="font-mono">{data.blueprint.detectedSqm} m²</dd>
        </dl>
        {data.blueprint.rooms.length > 0 && (
          <table className="data-table rounded border border-line">
            <thead><tr><th>Room</th><th className="text-right">Detected area (m²)</th></tr></thead>
            <tbody>
              {data.blueprint.rooms.map((r) => (
                <tr key={r.name}><td>{r.name}</td><td className="text-right font-mono">{r.sqm}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </TabPanel>
    </div>
  );
};

/** Backend shape: GET /applications/:id/forensics → { summary, documents[], photos[], faculty[] } */
const DocumentsView: React.FC<{
  summary?: Record<string, any>;
  documents: any[];
  photos: any[];
  faculty?: any[];
}> = ({ summary, documents, photos, faculty }) => (
  <div className="space-y-4">
    {summary && (
      <StatStrip
        items={[
          { label: 'Documents analysed', value: summary.totalDocuments },
          { label: 'Tampering suspected', value: summary.tamperSuspected, tone: summary.tamperSuspected > 0 ? 'bad' : 'default' },
          { label: 'Photos evaluated', value: summary.photosEvaluated },
          { label: 'Photo location status', value: summary.geofenceStatus ? humanize(summary.geofenceStatus) : undefined },
        ]}
      />
    )}
    <div className="overflow-x-auto rounded border border-line bg-white">
      <table className="data-table">
        <caption className="border-b border-line bg-[#f6f8fa] px-3 py-2 text-left text-[13px] font-semibold text-ink">Document signals</caption>
        <thead>
          <tr>
            <th>File</th><th>Type</th><th className="text-right">Version</th><th>Incremental updates</th><th className="text-right">ELA score</th><th>ELA signal</th><th className="text-right">Regions</th>
          </tr>
        </thead>
        <tbody>
          {documents.length === 0 ? (
            <tr><td colSpan={7} className="text-ink-soft">No documents were returned.</td></tr>
          ) : (
            documents.map((d, i) => (
              <tr key={d.documentId ?? i}>
                <td>{d.fileName ?? '—'}</td>
                <td>{humanize(d.docType) || '—'}</td>
                <td className="text-right tabular-nums">{d.version ?? '—'}</td>
                <td>{yesNo(d.pdfRevisions?.hasIncrementalUpdates)}</td>
                <td className="text-right font-mono">{typeof d.ela?.score === 'number' ? d.ela.score.toFixed(2) : '—'}</td>
                <td>{d.ela?.suspected ? <StatusPill domain="verification" value="MANUAL_REVIEW_REQUIRED" /> : d.ela ? <span className="text-meta text-ink-faint">No signal</span> : '—'}</td>
                <td className="text-right tabular-nums">{Array.isArray(d.ela?.regions) ? d.ela.regions.length : '—'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
    <div className="overflow-x-auto rounded border border-line bg-white">
      <table className="data-table">
        <caption className="border-b border-line bg-[#f6f8fa] px-3 py-2 text-left text-[13px] font-semibold text-ink">Infrastructure photos</caption>
        <thead><tr><th>Photo type</th><th>Location result</th><th>Distance from campus</th><th>Image hash</th></tr></thead>
        <tbody>
          {photos.length === 0 ? (
            <tr><td colSpan={4} className="text-ink-soft">No photos were returned.</td></tr>
          ) : (
            photos.map((p, i) => (
              <tr key={p.photoId ?? i}>
                <td>{humanize(p.photoType) || '—'}</td>
                <td><StatusPill domain="geofence" value={p.geofenceStatus} /></td>
                <td className="tabular-nums">{typeof p.distanceFromCampus === 'number' ? `${p.distanceFromCampus.toLocaleString('en-IN')} m` : '—'}</td>
                <td className="font-mono text-[12px]">{p.imageHash ?? '—'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>

    {faculty && faculty.length > 0 && (
      <div className="overflow-x-auto rounded border border-line bg-white">
        <div className="border-b border-line bg-[#f6f8fa] px-3 py-2">
          <h3 className="text-[13px] font-semibold text-ink">Faculty Identity & Ghost Duplication Checks</h3>
          <p className="text-meta text-ink-faint">
            Identifiers are matched cross-institutionally via salted HMAC-SHA256 hashes without storing or exposing raw Aadhaar/PAN.
          </p>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Name (normalised)</th>
              <th>Identifier type</th>
              <th>Also listed by</th>
              <th>Match confidence</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {faculty.map((f, i) => (
              <tr key={f.id ?? i}>
                <td className="font-medium text-ink">{f.nameNormalized}</td>
                <td>{f.identifierType}</td>
                <td>{f.matchInstitutionName ?? <span className="text-ink-faint">No other institution</span>}</td>
                <td className="tabular-nums">{f.matchConfidence != null ? `${Math.round(f.matchConfidence * 100)}%` : '—'}</td>
                <td>
                  {f.isGhostFlagged ? (
                    <StatusPill domain="verification" value="MISMATCH_DETECTED" />
                  ) : (
                    <span className="text-meta text-ink-faint">No collision reported</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

export const ForensicsPanel: React.FC<{ applicationId: string }> = ({ applicationId }) => {
  const { data, isLoading, isError, error, refetch } = useForensicsSuite(applicationId);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (isError) return <ErrorState error={error} title="Forensic results could not be loaded" onRetry={() => refetch()} />;
  if (!data || data.kind === 'empty') {
    return <Notice tone="muted">No forensic results have been returned for this application.</Notice>;
  }

  return (
    <div className="space-y-3">
      <p className="text-meta text-ink-faint">
        Document signals are indicators for review, not conclusions. Values are shown exactly as returned by the verification
        service.
      </p>
      {data.kind === 'suite' ? (
        <SuiteView data={data.data} />
      ) : (
        <DocumentsView
          summary={data.summary}
          documents={data.documents}
          photos={data.photos}
          faculty={data.faculty}
        />
      )}
    </div>
  );
};
