/** Display formatters (en-IN). Missing values render as an em dash, never as zero. */
export const fmtDate = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const fmtDateTime = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

/** "3 days ago" style age, computed only from a real timestamp. */
export const fmtAge = (iso?: string | null) => {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const days = Math.floor((Date.now() - t) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
};

export const fmtBytes = (n?: number) => {
  if (typeof n !== 'number' || n < 0) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
};

export const fmtNum = (n?: number | null, digits = 0) =>
  typeof n === 'number' && !Number.isNaN(n) ? n.toLocaleString('en-IN', { maximumFractionDigits: digits }) : '—';
