import React, { useState } from 'react';
import { StatusBadge } from '../status';
import { Button, FormField, Modal, Notice } from '../ui';
import type { Claim, ClaimRecheckResult } from '@contracts';
import { Edit2, HelpCircle, ExternalLink } from 'lucide-react';
import { errorMessage } from '../../api/errors';

interface ClaimTableProps {
  claims: Claim[];
  onSelectClaimSource?: (claim: Claim) => void;
  onConfirmClaim?: (claimId: string) => Promise<void>;
  onEditClaim?: (claimId: string, value: string | number, reason: string) => Promise<ClaimRecheckResult>;
  onShowRecheckToast?: (result: ClaimRecheckResult) => void;
  /** Hide correction controls entirely (e.g. for read-only roles). */
  readOnly?: boolean;
}

/** A claim needs a person to confirm it only when the server says so. */
const needsConfirmation = (c: Claim) => !!c.needsConfirmation || c.status === 'BLOCKED_LOW_CONFIDENCE' || (c as any).status === 'NEEDS_CONFIRMATION';

export const ClaimTable: React.FC<ClaimTableProps> = ({
  claims,
  onSelectClaimSource,
  onConfirmClaim,
  onEditClaim,
  onShowRecheckToast,
  readOnly = false,
}) => {
  const [editingClaim, setEditingClaim] = useState<Claim | null>(null);
  const [newValue, setNewValue] = useState<string>('');
  const [editReason, setEditReason] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});

  const startEdit = (claim: Claim) => {
    setEditingClaim(claim);
    setNewValue(String(claim.value ?? ''));
    setEditReason('');
    setErrorMsg(null);
  };

  const submitEdit = async () => {
    if (!editReason || editReason.trim().length < 5) {
      setErrorMsg('A mandatory explanation (min 5 chars) is required for correcting extracted data.');
      return;
    }
    if (!editingClaim) return;
    if (!onEditClaim) {
      setErrorMsg('Corrections cannot be saved from this view.');
      return;
    }

    setIsSubmitting(true);
    try {
      const parsedValue = newValue.trim() !== '' && !isNaN(Number(newValue)) ? Number(newValue) : newValue;
      const res = await onEditClaim(editingClaim.claimId, parsedValue, editReason.trim());
      if (res && onShowRecheckToast) onShowRecheckToast(res);
      setEditingClaim(null);
    } catch (err) {
      setErrorMsg(errorMessage(err, 'The correction could not be saved.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirm = async (claim: Claim) => {
    if (!onConfirmClaim) {
      setRowError((p) => ({ ...p, [claim.claimId]: 'Confirmation is not available from this view.' }));
      return;
    }
    setConfirming(claim.claimId);
    setRowError((p) => ({ ...p, [claim.claimId]: '' }));
    try {
      await onConfirmClaim(claim.claimId);
    } catch (err) {
      setRowError((p) => ({ ...p, [claim.claimId]: errorMessage(err, 'Could not confirm this value.') }));
    } finally {
      setConfirming(null);
    }
  };

  if (claims.length === 0) {
    return (
      <div data-testid="claim-table" className="panel px-4 py-8 text-center text-sm text-ink-soft">
        No extracted values have been returned for this application yet. Values appear after documents are analysed.
      </div>
    );
  }

  return (
    <div data-testid="claim-table" className="overflow-hidden rounded border border-line bg-white">
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Data item</th>
              <th scope="col">Extracted value</th>
              <th scope="col">Extraction confidence</th>
              <th scope="col">Verification status</th>
              <th scope="col">Source</th>
              {!readOnly && <th scope="col" className="text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {claims.map((claim) => {
              const flagged = needsConfirmation(claim);
              const conf = typeof claim.confidence === 'number' ? claim.confidence : undefined;
              return (
                <tr key={claim.claimId} data-testid="claim-row" className={flagged ? '[&>td]:!bg-warn-bg/50' : undefined}>
                  <td>
                    <span className="block font-semibold text-ink">{claim.predicateLabel}</span>
                    <span className="font-mono text-[11.5px] text-ink-faint">{claim.predicate}</span>
                  </td>
                  <td>
                    <span className="font-mono text-[13.5px] font-semibold text-ink">
                      {String(claim.value)} {claim.unit || ''}
                    </span>
                    {claim.originalValue !== undefined && claim.originalValue !== null && (
                      <span className="block text-[11.5px] text-ink-faint">
                        Originally extracted: <span className="line-through">{String(claim.originalValue)}</span>
                      </span>
                    )}
                    {claim.correctionReason && (
                      <span className="block text-[11.5px] text-ink-faint">Reason: {claim.correctionReason}</span>
                    )}
                  </td>
                  <td>
                    {conf === undefined ? (
                      <span className="text-ink-faint">—</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-sm bg-line-soft" aria-hidden="true">
                          <div className="h-full bg-brand-600" style={{ width: `${Math.max(0, Math.min(1, conf)) * 100}%` }} />
                        </div>
                        <span className="tabular-nums text-[12.5px]">{Math.round(conf * 100)}%</span>
                      </div>
                    )}
                  </td>
                  <td>
                    <StatusBadge status={claim.status} size="sm" />
                  </td>
                  <td>
                    {claim.source?.docId ? (
                      onSelectClaimSource ? (
                        <button type="button" onClick={() => onSelectClaimSource(claim)} className="link inline-flex items-center gap-1 text-[12.5px]">
                          Doc {claim.source.docId}, p.{claim.source.page}
                          <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </button>
                      ) : (
                        <span className="font-mono text-[12px] text-ink-soft">
                          Doc {claim.source.docId}, p.{claim.source.page}
                        </span>
                      )
                    ) : (
                      <span className="text-ink-faint">—</span>
                    )}
                  </td>
                  {!readOnly && (
                    <td className="text-right">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {flagged && !claim.confirmed && (
                          <Button variant="outline" size="sm" onClick={() => confirm(claim)} isLoading={confirming === claim.claimId}>
                            <HelpCircle className="h-3.5 w-3.5 text-warn" aria-hidden="true" />
                            Please confirm
                          </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => startEdit(claim)}>
                          <Edit2 className="h-3.5 w-3.5" aria-hidden="true" />
                          Edit
                        </Button>
                      </div>
                      {rowError[claim.claimId] && (
                        <p className="mt-1 text-[11.5px] text-bad" role="alert">
                          {rowError[claim.claimId]}
                        </p>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={!!editingClaim}
        onClose={() => setEditingClaim(null)}
        title={`Edit Extracted Data: ${editingClaim?.predicateLabel}`}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setEditingClaim(null)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={submitEdit} isLoading={isSubmitting}>
              Confirm Correction & Re-verify
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-ink-soft">
            The corrected value replaces the extracted one and the affected rules are re-run by the server. Your reason is
            recorded in the audit trail.
          </p>
          <FormField label="Corrected value" htmlFor="claim-new-value" required>
            <input id="claim-new-value" type="text" value={newValue} onChange={(e) => setNewValue(e.target.value)} className="field-input font-mono" />
          </FormField>
          <FormField label="Reason for correction" htmlFor="claim-reason" required helperText="At least 5 characters.">
            <textarea
              id="claim-reason"
              rows={3}
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              placeholder="For example: the scan was misread; page 4 shows 640, not 610."
              className="field-textarea"
            />
          </FormField>
          {errorMsg && <Notice tone="bad">{errorMsg}</Notice>}
        </div>
      </Modal>
    </div>
  );
};
