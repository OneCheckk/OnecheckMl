import React, { useState, useEffect, useId } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { X, ShieldAlert, BarChart3 } from 'lucide-react';
import { apiClient } from '../../api/client';
import { demoOffsetPayload, readDemoOffset } from '../../api/queries';
import { errorMessage } from '../../api/errors';
import { useAuth } from '../../auth/AuthProvider';
import { Button, ConfirmationDialog, Notice } from '../ui';

interface DemoControlsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Demonstration controls backed by /api/demo/settings (OFFICER/ADMIN) and the
 * audit tamper endpoint (ADMIN, demo mode only). Values are shown as saved only
 * after the server confirms them.
 */
export const DemoControlsDrawer: React.FC<DemoControlsDrawerProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const offsetId = useId();
  const [offsetDays, setOffsetDays] = useState<number>(0);
  const [savedOffset, setSavedOffset] = useState<number | null>(null);
  const [forceUnavailable, setForceUnavailable] = useState<boolean>(false);
  const [status, setStatus] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tamperStatus, setTamperStatus] = useState<{ tone: 'ok' | 'bad' | 'warn'; text: string } | null>(null);
  const [isTampering, setIsTampering] = useState<boolean>(false);
  const [confirmTamper, setConfirmTamper] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setStatus(null);
    setLoadError(null);
    apiClient
      .get('/demo/settings')
      .then((res) => {
        const data = res.data?.data;
        if (data) {
          const off = readDemoOffset(data);
          setOffsetDays(off);
          setSavedOffset(off);
          setForceUnavailable(!!data.forceSourceUnavailable);
        }
      })
      .catch((e) => setLoadError(errorMessage(e, 'Demo settings could not be loaded.')));
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const save = async (nextOffset: number, nextForce: boolean) => {
    setSaving(true);
    setStatus(null);
    try {
      const res = await apiClient.put('/demo/settings', {
        ...demoOffsetPayload(nextOffset),
        forceSourceUnavailable: nextForce,
      });
      const data = res.data?.data;
      const confirmedOffset = data ? readDemoOffset(data) : nextOffset;
      setSavedOffset(confirmedOffset);
      setForceUnavailable(data ? !!data.forceSourceUnavailable : nextForce);
      setStatus({ tone: 'ok', text: 'Settings saved by the server.' });
      queryClient.invalidateQueries({ queryKey: ['validity'] });
      queryClient.invalidateQueries({ queryKey: ['findings'] });
    } catch (e) {
      setStatus({ tone: 'bad', text: errorMessage(e, 'The server did not accept the settings.') });
    } finally {
      setSaving(false);
    }
  };

  const handleTamperAudit = async () => {
    setIsTampering(true);
    setTamperStatus(null);
    try {
      await apiClient.post('/demo/tamper-audit');
      const verifyRes = await apiClient.get('/audit/verify');
      const data = verifyRes.data?.data ?? {};
      const intact = data.intact ?? data.verified;
      const brokenAt = data.brokenAtSeq ?? data.brokenSeq;
      setTamperStatus(
        intact === false
          ? { tone: 'warn', text: `Audit chain verification now fails at event #${brokenAt ?? '?'}, as expected after tampering.` }
          : { tone: 'ok', text: 'An event was altered, but the verification endpoint still reports the chain as intact.' }
      );
    } catch (err) {
      setTamperStatus({ tone: 'bad', text: errorMessage(err, 'Tamper simulation failed.') });
    } finally {
      setIsTampering(false);
      setConfirmTamper(false);
    }
  };

  if (!isOpen) return null;

  const dirty = savedOffset !== null && savedOffset !== offsetDays;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#0d1b2e]/45" role="dialog" aria-modal="true" aria-labelledby="demo-drawer-title">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-sm flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-line bg-[#f6f8fa] px-4 py-3">
          <h2 id="demo-drawer-title" className="text-[15px] font-semibold text-brand-900">
            Demonstration controls
          </h2>
          <button onClick={onClose} className="rounded p-1 text-ink-faint hover:text-ink" aria-label="Close demonstration controls" type="button">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4 text-sm">
          <Notice tone="warn">
            These controls change server-side simulation settings for every user of this deployment. Use them only in
            demonstration environments.
          </Notice>
          {loadError && <Notice tone="bad">{loadError}</Notice>}

          <section className="space-y-2 rounded border border-line p-3">
            <label htmlFor={offsetId} className="field-label">
              Decision date offset
            </label>
            <div className="flex items-center gap-3">
              <input
                id={offsetId}
                type="range"
                min={0}
                max={180}
                step={5}
                value={offsetDays}
                onChange={(e) => setOffsetDays(Number(e.target.value))}
                className="w-full accent-[#174a85]"
                aria-valuetext={`${offsetDays} days`}
              />
              <span className="w-20 text-right font-mono text-[13px]">+{offsetDays} d</span>
            </div>
            <p className="field-help">
              Moves the server's evaluation date forward so certificate validity can be re-evaluated against a later date.
              {savedOffset !== null && <> Saved value: <strong>+{savedOffset} days</strong>.</>}
            </p>
            <Button size="sm" onClick={() => save(offsetDays, forceUnavailable)} isLoading={saving} disabled={!dirty}>
              Apply offset
            </Button>
          </section>

          <section className="rounded border border-line p-3">
            <label className="flex items-start gap-2.5">
              <input
                type="checkbox"
                checked={forceUnavailable}
                disabled={saving}
                onChange={(e) => save(offsetDays, e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[#174a85]"
              />
              <span>
                <span className="font-semibold text-ink">Simulate source unavailable</span>
                <span className="block text-meta text-ink-faint">
                  External source adapters respond as unreachable, so checks are recorded as "Source unavailable".
                </span>
              </span>
            </label>
          </section>

          {status && <Notice tone={status.tone}>{status.text}</Notice>}

          <Link to="/benchmark" onClick={onClose} className="flex items-center gap-2 rounded border border-line p-3 hover:bg-brand-50">
            <BarChart3 className="h-4 w-4 text-brand-700" aria-hidden="true" />
            <span className="link">Open the benchmark page</span>
          </Link>

          {user?.role === 'ADMIN' && (
            <section className="space-y-2 rounded border border-bad-line p-3">
              <h3 className="flex items-center gap-1.5 font-semibold text-ink">
                <ShieldAlert className="h-4 w-4 text-bad" aria-hidden="true" />
                Audit chain tamper test
              </h3>
              <p className="text-meta text-ink-soft">
                Alters one stored audit event (server demo mode only) and then runs chain verification, to demonstrate
                that tampering is detected. This modifies audit data.
              </p>
              <Button variant="danger" size="sm" onClick={() => setConfirmTamper(true)} isLoading={isTampering}>
                Run tamper test
              </Button>
              {tamperStatus && <Notice tone={tamperStatus.tone}>{tamperStatus.text}</Notice>}
            </section>
          )}
        </div>
      </div>

      <ConfirmationDialog
        isOpen={confirmTamper}
        onCancel={() => setConfirmTamper(false)}
        onConfirm={handleTamperAudit}
        isLoading={isTampering}
        isDangerous
        title="Alter an audit event?"
        message="This deliberately modifies a stored audit event so that chain verification fails. Only proceed in a demonstration environment."
        confirmText="Alter event and verify"
      />
    </div>
  );
};
