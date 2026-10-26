import React from 'react';
import clsx from 'clsx';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Hourglass,
  CloudOff,
  Eye,
  MinusCircle,
  HelpCircle,
  AlertTriangle,
  ShieldAlert,
  FileText,
  Send,
  PlayCircle,
  Loader2,
  Ban,
  Info,
} from 'lucide-react';
import type { VerificationStatus, Band, Severity, FindingState, ChecklistState } from '@contracts';
import {
  describeStatus,
  TONE_CLASSES,
  type IconKey,
  type StatusDomain,
} from './statusMaps';
import { IS_MOCK_MODE } from '../../config';

export * from './statusMaps';

const ICONS: Record<IconKey, React.FC<{ className?: string }>> = {
  check: CheckCircle2,
  x: XCircle,
  clock: Clock,
  hourglass: Hourglass,
  'cloud-off': CloudOff,
  eye: Eye,
  minus: MinusCircle,
  help: HelpCircle,
  alert: AlertTriangle,
  shield: ShieldAlert,
  file: FileText,
  send: Send,
  play: PlayCircle,
  loader: Loader2,
  ban: Ban,
  info: Info,
};

interface StatusPillProps {
  domain: StatusDomain;
  value: string | null | undefined;
  size?: 'sm' | 'md';
  className?: string;
  showDescription?: boolean;
  testId?: string;
}

/** Generic, mapping-driven status label: text + icon + tone (never colour alone). */
export const StatusPill: React.FC<StatusPillProps> = ({
  domain,
  value,
  size = 'sm',
  className,
  showDescription = false,
  testId = 'status-pill',
}) => {
  const d = describeStatus(domain, value);
  const Icon = ICONS[d.icon];
  return (
    <span
      data-testid={testId}
      data-domain={domain}
      data-status={value ?? ''}
      title={d.description}
      className={clsx(
        'inline-flex max-w-full items-center gap-1 rounded-sm border font-medium leading-tight',
        size === 'sm' ? 'px-1.5 py-[2px] text-[12px]' : 'px-2 py-0.5 text-[13px]',
        TONE_CLASSES[d.tone],
        className
      )}
    >
      <Icon className={clsx('shrink-0', size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4')} aria-hidden="true" />
      <span className="truncate">{d.label}</span>
      {showDescription && d.description && <span className="sr-only">. {d.description}</span>}
    </span>
  );
};

interface StatusBadgeProps {
  status: VerificationStatus;
  className?: string;
  size?: 'sm' | 'md';
}

/** Verification outcome badge (findings, ledger entries, claims). */
export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className, size = 'md' }) => (
  <StatusPill domain="verification" value={status} size={size} className={className} testId="status-badge" showDescription />
);

export const DocumentStatusBadge: React.FC<{ status?: string; className?: string }> = ({ status, className }) => (
  <StatusPill domain="document" value={status} className={className} testId="document-status" />
);

export const ApplicationStatusBadge: React.FC<{ status?: string; className?: string; size?: 'sm' | 'md' }> = ({
  status,
  className,
  size,
}) => <StatusPill domain="application" value={status} className={className} size={size} testId="application-status" />;

export const CheckRunBadge: React.FC<{ status?: string; className?: string }> = ({ status, className }) => (
  <StatusPill domain="checkRun" value={status} className={className} testId="check-run-status" />
);

export const AlertStatusBadge: React.FC<{ status?: string; className?: string }> = ({ status, className }) => (
  <StatusPill domain="alert" value={status} className={className} testId="alert-status" />
);

interface BandChipProps {
  band: Band;
  className?: string;
}

/** Risk band — a decision-support signal, not a decision. */
export const BandChip: React.FC<BandChipProps> = ({ band, className }) => (
  <StatusPill domain="band" value={band} className={className} testId="band-chip" />
);

interface SeverityChipProps {
  severity: Severity;
  className?: string;
}

export const SeverityChip: React.FC<SeverityChipProps> = ({ severity, className }) => {
  const d = describeStatus('severity', severity);
  return (
    <span
      data-testid="severity-chip"
      data-severity={severity}
      className={clsx(
        'inline-flex items-center rounded-sm border px-1.5 py-[1px] text-[11.5px] font-semibold uppercase tracking-wide',
        severity === 'CRITICAL' ? 'border-bad bg-bad text-white' : TONE_CLASSES[d.tone],
        className
      )}
    >
      {d.label}
    </span>
  );
};

export const SeverityBadge = SeverityChip;

interface StateChipProps {
  state: FindingState | ChecklistState | string;
  className?: string;
}

/** Finding disposition or checklist state. */
export const StateChip: React.FC<StateChipProps> = ({ state, className }) => {
  const isChecklist = ['MISSING', 'UPLOADED', 'EXTRACTING', 'DONE', 'FAILED'].includes(state);
  return (
    <StatusPill
      domain={isChecklist ? 'checklist' : 'finding'}
      value={state}
      className={className}
      testId="state-chip"
    />
  );
};

export const PlaceholderTag: React.FC<{ className?: string }> = ({ className }) => (
  <span
    data-testid="placeholder-tag"
    className={clsx(
      'inline-flex items-center gap-1 rounded-sm border border-muted-line bg-muted-bg px-1.5 py-[1px] text-[11.5px] text-muted',
      className
    )}
    title="The handbook clause reference for this rule has not been confirmed yet."
  >
    <Info className="h-3 w-3" aria-hidden="true" />
    <span>Handbook clause to be confirmed</span>
  </span>
);

/**
 * Shown only when the frontend is running against MSW fixtures
 * (VITE_USE_MOCKS=true), so demonstration data is never mistaken for real data.
 */
export const DemoBanner: React.FC<{ className?: string; force?: boolean }> = ({ className, force }) => {
  // Authenticated pages already show a global mock-mode strip (AppLayout); render here only when forced.
  if (!force || !IS_MOCK_MODE) return null;
  return (
    <div
      data-testid="demo-banner"
      role="note"
      className={clsx(
        'flex items-center gap-2 rounded-sm border border-warn-line bg-warn-bg px-3 py-1.5 text-meta text-warn',
        className
      )}
    >
      <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>
        <strong className="font-semibold">Demonstration data.</strong> This screen is served by the built-in mock
        layer (VITE_USE_MOCKS=true), not the OneCheck API.
      </span>
    </div>
  );
};

/** Inline marker for synthetic/simulated data that the server itself labels as such. */
export const SyntheticTag: React.FC<{ label?: string; className?: string }> = ({ label = 'Synthetic source', className }) => (
  <span
    className={clsx(
      'inline-flex items-center rounded-sm border border-warn-line bg-warn-bg px-1.5 py-[1px] text-[11px] font-medium text-warn',
      className
    )}
    title="The server marks this value as coming from a synthetic or simulated adapter."
  >
    {label}
  </span>
);
