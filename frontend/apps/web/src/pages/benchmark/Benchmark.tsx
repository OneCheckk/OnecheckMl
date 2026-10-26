import React, { useState } from 'react';
import { Play, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { useBenchmarkRuns, useRunBenchmark } from '../../api/queries';
import type { BenchmarkView } from '../../api/adapters';
import { describeApiError } from '../../api/errors';
import { Button, EmptyState, ErrorState, FormField, Notice, PageHeader, PageSkeleton, Panel, StatStrip } from '../../components/ui';
import { DemoBanner } from '../../components/status';
import { IS_MOCK_MODE } from '../../config';
import { fmtDateTime, fmtNum } from '../../lib/format';

const pct = (v?: number) => (typeof v === 'number' ? `${fmtNum(v, 1)}%` : undefined);

export const BenchmarkPage: React.FC = () => {
  const runsQ = useBenchmarkRuns();
  const runMutation = useRunBenchmark();
  const [n, setN] = useState(IS_MOCK_MODE ? 100 : 2);
  const [seed, setSeed] = useState(42);
  const [faultRate, setFaultRate] = useState(0.35);
  const [scanRatio, setScanRatio] = useState(0.4);
  const [error, setError] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<string | null>(null);

  if (runsQ.isLoading) return <PageSkeleton />;

  const runs = runsQ.data ?? [];
  const run: BenchmarkView | undefined = runs.find((r) => r.runId === selectedRun) ?? runs[0];

  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await runMutation.mutateAsync(IS_MOCK_MODE ? { n, seed, faultRate, scanRatio } : { n, seed });
      setSelectedRun(null);
    } catch (err) {
      setError(describeApiError(err, 'The benchmark run failed.').message);
    }
  };

  const download = () => {
    if (!run) return;
    const blob = new Blob([JSON.stringify(run.raw, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `onecheck_benchmark_${run.runId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const chartData = (run?.perFault ?? []).map((f) => ({
    name: f.label.replace(/_/g, ' '),
    Precision: f.precision !== undefined ? +f.precision.toFixed(1) : null,
    Recall: f.recall !== undefined ? +f.recall.toFixed(1) : null,
    F1: f.f1 !== undefined ? +f.f1.toFixed(1) : null,
  }));

  return (
    <div className="page py-6">
      <PageHeader
        title="Benchmark"
        description="Evaluation of the verification pipeline against synthetic applications with planted faults."
        breadcrumbs={[{ label: 'Oversight' }, { label: 'Benchmark' }]}
      />
      <DemoBanner className="mb-4" />
      <Notice tone="muted" className="mb-5">
        Figures on this page are produced only by benchmark runs started here, using synthetic data. When the API runs with
        its mock verification service, scores are fixed fixture values. They are not measurements of production use.
      </Notice>

      <div className="grid gap-5 grid-cols-1 lg:grid-cols-[300px_1fr]">
        <div className="space-y-5">
          <Panel title="Start a run">
            <form onSubmit={start} className="space-y-3">
              <FormField label="Synthetic applications (n)" htmlFor="bench-n" required>
                <input id="bench-n" type="number" min={1} max={500} value={n} onChange={(e) => setN(Math.max(1, Number(e.target.value)))} className="field-input" />
              </FormField>
              <FormField label="Random seed" htmlFor="bench-seed" required helperText="The same seed reproduces the same dataset.">
                <input id="bench-seed" type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))} className="field-input" />
              </FormField>
              {IS_MOCK_MODE && (
                <>
                  <FormField label="Fault rate" htmlFor="bench-fault" helperText="Mock layer only.">
                    <input id="bench-fault" type="number" step={0.05} min={0} max={1} value={faultRate} onChange={(e) => setFaultRate(Number(e.target.value))} className="field-input" />
                  </FormField>
                  <FormField label="Scanned-document ratio" htmlFor="bench-scan" helperText="Mock layer only.">
                    <input id="bench-scan" type="number" step={0.05} min={0} max={1} value={scanRatio} onChange={(e) => setScanRatio(Number(e.target.value))} className="field-input" />
                  </FormField>
                </>
              )}
              {error && <Notice tone="bad">{error}</Notice>}
              <Button type="submit" isLoading={runMutation.isPending} className="w-full">
                <Play className="h-4 w-4" aria-hidden="true" /> {runMutation.isPending ? 'Running…' : 'Run benchmark'}
              </Button>
            </form>
          </Panel>

          {runs.length > 0 && (
            <Panel title="Runs" bodyClassName="">
              <ul className="divide-y divide-line-soft">
                {runs.map((r) => (
                  <li key={r.runId}>
                    <button
                      type="button"
                      onClick={() => setSelectedRun(r.runId)}
                      aria-pressed={run?.runId === r.runId}
                      className={`w-full px-4 py-2 text-left text-[12.5px] hover:bg-brand-50 ${run?.runId === r.runId ? 'bg-brand-50' : ''}`}
                    >
                      <span className="block font-mono text-ink">{r.runId}</span>
                      <span className="text-ink-faint">{fmtDateTime(r.executedAt)} · seed {r.seed ?? '—'} · n {r.n ?? '—'}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>

        <div className="space-y-5">
          {runsQ.isError ? (
            <ErrorState error={runsQ.error} title="Benchmark runs could not be loaded" onRetry={() => runsQ.refetch()} />
          ) : !run ? (
            <Panel>
              <EmptyState title="No benchmark runs yet" description="Start a run to evaluate the pipeline. Results appear here once the run completes." />
            </Panel>
          ) : (
            <>
              <Panel
                title="Run results"
                subtitle={`${run.runId} · ${fmtDateTime(run.executedAt)}`}
                actions={<Button variant="outline" size="sm" onClick={download}><Download className="h-3.5 w-3.5" aria-hidden="true" /> Download JSON</Button>}
              >
                <StatStrip
                  items={[
                    { label: 'Extraction accuracy', value: pct(run.extractionAccuracy) },
                    { label: 'Validation accuracy', value: pct(run.validationAccuracy) },
                    { label: 'False positives on clean applications', value: pct(run.falsePositiveRate) },
                    { label: 'Average verification time', value: typeof run.avgVerificationTimeSec === 'number' ? `${fmtNum(run.avgVerificationTimeSec, 2)} s` : undefined },
                  ]}
                />
                <dl className="meta-list mt-4 sm:grid-cols-[160px_1fr]">
                  <dt>Seed</dt><dd>{run.seed ?? '—'}</dd>
                  <dt>Applications</dt><dd>{run.n ?? '—'}</dd>
                  <dt>Manifest hash</dt><dd className="break-all font-mono text-[12px]">{run.manifestHash ?? '—'}</dd>
                </dl>
              </Panel>

              <Panel title="Per-fault detection" bodyClassName="">
                {run.perFault.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-ink-soft">This run did not report per-fault results.</p>
                ) : (
                  <>
                    <div className="h-64 px-2 pt-3" role="img" aria-label="Bar chart of precision, recall and F1 per fault type. The same values are in the table below.">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 4, right: 12, left: -12, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e9ef" vertical={false} />
                          <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#435064' }} interval={0} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#435064' }} unit="%" />
                          <Tooltip formatter={(v: any) => `${v}%`} />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <Bar dataKey="Precision" fill="#174a85" />
                          <Bar dataKey="Recall" fill="#6f95c4" />
                          <Bar dataKey="F1" fill="#b4c9e2" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Fault / rule</th><th className="text-right">Precision</th><th className="text-right">Recall</th><th className="text-right">F1</th>
                            <th className="text-right">TP</th><th className="text-right">FP</th><th className="text-right">FN</th>
                          </tr>
                        </thead>
                        <tbody>
                          {run.perFault.map((f) => (
                            <tr key={f.label}>
                              <td className="font-mono text-[12px]">{f.label}</td>
                              <td className="text-right tabular-nums">{pct(f.precision) ?? '—'}</td>
                              <td className="text-right tabular-nums">{pct(f.recall) ?? '—'}</td>
                              <td className="text-right tabular-nums">{pct(f.f1) ?? '—'}</td>
                              <td className="text-right tabular-nums">{f.tp ?? '—'}</td>
                              <td className="text-right tabular-nums">{f.fp ?? '—'}</td>
                              <td className="text-right tabular-nums">{f.fn ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </Panel>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
