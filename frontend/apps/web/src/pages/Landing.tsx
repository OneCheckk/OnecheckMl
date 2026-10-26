import React from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import {
  FileSearch,
  Database,
  GitCompareArrows,
  ListChecks,
  CalendarClock,
  UserCheck,
  ArrowRight,
  ArrowUpRight,
  Check,
  FileText,
  Landmark,
  Building2,
  Sparkles,
} from 'lucide-react';
import { StatusPill } from '../components/status';
import { VERIFICATION_STATUS } from '../components/status/statusMaps';

interface CapabilityItem {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
  tag: string;
  accent: 'saffron' | 'green' | 'blue';
  metric: string;
  title: string;
  body: string;
  highlight?: boolean;
}

const CAPABILITIES: CapabilityItem[] = [
  {
    icon: FileSearch,
    tag: 'Forensics',
    accent: 'saffron',
    metric: 'ELA & Stream Inspection',
    title: 'Document verification & forensics',
    body: 'Analyses uploaded PDFs and infrastructure images for byte-level revision history, perceptual hash collisions, and Error Level tampering.',
    highlight: false,
  },
  {
    icon: Database,
    tag: 'Ledger Truth',
    accent: 'blue',
    metric: 'Historical AICTE Database',
    title: 'AICTE record reconciliation',
    body: 'Reconciles current EoA declarations against AICTE-held historical archives, past intake capacity, and fee regulatory authorizations.',
    highlight: false,
  },
  {
    icon: GitCompareArrows,
    tag: 'Triangle of Truth',
    accent: 'green',
    metric: '3-Node Cross Verification',
    title: 'Evidence-linked mismatch detection',
    body: 'Every discrepancy is triangulated between Form Claims, OCR Extracts, and AICTE Ledgers with exact page citations and visual bounding boxes.',
    highlight: true,
  },
  {
    icon: ListChecks,
    tag: 'Completeness',
    accent: 'saffron',
    metric: 'Zero-Deficiency Gate',
    title: 'Checklist & schema validation',
    body: 'Category-specific statutory checklist is strictly evaluated. Submissions are rejected upfront if mandatory NOCs or faculty lists are missing.',
    highlight: false,
  },
  {
    icon: CalendarClock,
    tag: 'Temporal Check',
    accent: 'blue',
    metric: 'Session Commencement Window',
    title: 'Statutory certificate validity',
    body: 'Evaluates statutory validity against academic session timelines, ensuring building safety, fire NOCs, and affiliations remain valid through decision dates.',
    highlight: false,
  },
  {
    icon: UserCheck,
    tag: 'Human Oversight',
    accent: 'green',
    metric: '6-Status Explainable Ledger',
    title: 'Officer scrutiny & audit trail',
    body: 'The AI assists; the scrutiny officer always decides. Explicit explainable statuses with tamper-evident cryptographic audit logs for every action.',
    highlight: false,
  },
];

interface StepItem {
  step: string;
  title: string;
  body: string;
  badge: string;
  timing: string;
  numColor: string;
  badgeStyle: string;
  dotColor: string;
  circleBg: string;
  actionLabel: string;
  done: boolean;
  active?: boolean;
}

const STEPS: StepItem[] = [
  {
    step: '01',
    title: 'Institution submits',
    body: 'The institution creates an application draft and uploads required statutory certificates, faculty matrices, and NOCs.',
    badge: 'Filing',
    timing: '~10 min',
    numColor: 'text-orange-600',
    badgeStyle: 'bg-orange-50 text-orange-700 border-orange-200',
    dotColor: 'bg-orange-500',
    circleBg: 'bg-orange-500 shadow-orange-500/30',
    actionLabel: 'SUBMIT',
    done: true,
  },
  {
    step: '02',
    title: 'Completeness checked',
    body: 'Category-specific checklists and format schemas validate required filings. Submissions with missing docs are rejected upfront.',
    badge: 'Instant',
    timing: 'Real-time',
    numColor: 'text-purple-600',
    badgeStyle: 'bg-purple-50 text-purple-700 border-purple-200',
    dotColor: 'bg-purple-500',
    circleBg: 'bg-purple-600 shadow-purple-500/30',
    actionLabel: 'VALIDATE',
    done: true,
  },
  {
    step: '03',
    title: 'Multi-modal analysis',
    body: 'Forensic OCR, Error Level tampering analysis, perceptual image matching, and geofence verification process each file.',
    badge: 'Multi-modal',
    timing: '< 60 sec',
    numColor: 'text-cyan-600',
    badgeStyle: 'bg-cyan-50 text-cyan-800 border-cyan-200',
    dotColor: 'bg-cyan-500',
    circleBg: 'bg-cyan-600 shadow-cyan-500/30 ring-4 ring-cyan-200',
    actionLabel: 'ANALYSE',
    done: true,
    active: true,
  },
  {
    step: '04',
    title: 'Evidence presented',
    body: 'Discrepancies and validity lapses are highlighted side-by-side with exact page citations, visual bounding boxes, and audit history.',
    badge: 'Transparent',
    timing: 'Automated',
    numColor: 'text-emerald-600',
    badgeStyle: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dotColor: 'bg-emerald-500',
    circleBg: 'bg-emerald-600 shadow-emerald-500/30',
    actionLabel: 'EVIDENCE',
    done: false,
  },
  {
    step: '05',
    title: 'An officer decides',
    body: 'Authorised scrutiny officers review findings, evaluate institutional clarifications, and record formal approval recommendations.',
    badge: 'Human-in-Loop',
    timing: 'Official',
    numColor: 'text-brand-900',
    badgeStyle: 'bg-slate-100 text-slate-800 border-slate-300',
    dotColor: 'bg-brand-900',
    circleBg: 'bg-brand-900 shadow-slate-500/30',
    actionLabel: 'DECISION',
    done: false,
  },
];

export const LandingPage: React.FC = () => {
  return (
    <div className="bg-white">
      {/* Introduction */}
      <section className="landing-hero relative isolate overflow-hidden border-b border-line">
        <div className="page grid gap-8 py-10 sm:py-14 lg:min-h-[540px] lg:grid-cols-[1fr_360px] lg:items-center lg:py-20">
          <div className="panel bg-white/92 backdrop-blur-sm p-6 sm:p-7 shadow-sm border border-line lg:max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-orange-50 border border-orange-200/80 px-3 py-1 mb-2">
              <span className="h-2 w-2 rounded-full bg-saffron animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider text-saffron-ink">
                AICTE EoA Scrutiny Support
              </span>
            </div>
            <h1 className="mt-1 text-[28px] font-extrabold leading-tight text-brand-900 sm:text-[34px] tracking-tight">
              Regulatory Verification. <span className="text-saffron block sm:inline">Evidence You Can Trust.</span>
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
              OneCheck accelerates scrutiny of AICTE Extension of Approval applications through multi-modal document forensics,
              three-source record reconciliation, and transparent evidence-linked findings for authorised officers.
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <Link
                to="/login"
                className="inline-flex h-10 items-center gap-2 rounded border border-brand-700 bg-brand-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-800 transition-colors"
              >
                Sign in to OneCheck <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex h-10 items-center rounded border border-line-strong bg-white px-4 text-sm font-semibold text-brand-800 hover:bg-brand-50 transition-colors"
              >
                How OneCheck works
              </a>
            </div>
          </div>

          <aside className="panel self-start lg:self-center" aria-labelledby="who-uses">
            <div className="panel-header">
              <h2 id="who-uses" className="panel-title">
                Who uses OneCheck
              </h2>
            </div>
            <ul className="divide-y divide-line-soft text-sm">
              {[
                { icon: Building2, t: 'Institutions', d: 'Prepare and submit applications, upload documents and respond to deficiency letters.' },
                { icon: FileText, t: 'Scrutiny officers', d: 'Review evidence-linked findings and record dispositions and recommendations.' },
                { icon: Landmark, t: 'Regional directors', d: 'Confirm final outcomes on applications reviewed by officers.' },
                { icon: UserCheck, t: 'Administrators and auditors', d: 'Manage users, checklists and rulepacks; inspect the audit trail.' },
              ].map(({ icon: Icon, t, d }) => (
                <li key={t} className="flex gap-3 px-4 py-3">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-ink">{t}</p>
                    <p className="text-meta text-ink-soft">{d}</p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="border-t border-line-soft px-4 py-2.5 text-meta text-ink-faint">
              Your role is set on your account by an administrator.
            </p>
          </aside>
        </div>
      </section>

      <section id="about" className="scroll-mt-4 border-b border-line">
        <div className="page grid gap-8 py-10 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <h2 className="section-title text-lg">About OneCheck</h2>
            <p className="mt-1 text-meta text-ink-faint">Purpose and scope</p>
          </div>
          <div className="space-y-3 text-[15px] leading-relaxed text-ink-soft lg:col-span-2">
            <p>
              During each approval cycle, institutions file applications supported by many documents — building plans,
              fire safety certificates, faculty lists, fee receipts and previous approval letters. Inconsistencies often
              appear not on a single page but between what the institution declares, what its documents show, and what
              AICTE already holds on record.
            </p>
            <p>
              OneCheck brings these three sources together. It turns each value into an evidence-linked claim,
              compares them, and presents any disagreement with a citation to the page it came from. The aim is to help
              officers find what needs attention, faster, while keeping every decision with an authorised person.
            </p>
          </div>
        </div>
      </section>

      {/* Capabilities matching Reference Image 3 */}
      <section id="capabilities" className="scroll-mt-4 border-b border-line bg-gradient-to-b from-[#f8fafc] via-[#f1f5f9]/50 to-[#f8fafc] py-16">
        <div className="page">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 mb-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  AICTE-Grade Verification Core
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-brand-900 tracking-tight">
                System Capabilities
              </h2>
              <p className="mt-1.5 max-w-2xl text-[15px] text-ink-soft leading-relaxed">
                Automated multi-modal evidence extraction, cross-reconciliation, and statutory compliance checks.
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-xs font-semibold text-slate-500 bg-white border border-line-soft px-3.5 py-1.5 rounded-full shadow-sm">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-saffron" /> Saffron: Automated Signals
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 ml-2" /> Green: Truth Core
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map((c) => {
              const Icon = c.icon;
              return (
                <div
                  key={c.title}
                  className={clsx(
                    'group relative rounded-2xl p-6 sm:p-7 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1.5',
                    c.highlight
                      ? 'bg-gradient-to-b from-emerald-50/50 via-white to-white border-2 border-emerald-500 shadow-lg shadow-emerald-500/10 ring-4 ring-emerald-500/5'
                      : 'bg-white border border-slate-200/90 hover:border-orange-300 hover:shadow-xl shadow-[0_4px_20px_rgba(0,0,0,0.04)]'
                  )}
                >
                  {/* Subtle top accent bar */}
                  <div
                    className={clsx(
                      'absolute top-0 left-0 right-0 h-1 rounded-t-2xl',
                      c.accent === 'saffron' && 'bg-gradient-to-r from-orange-400 to-amber-500',
                      c.accent === 'green' && 'bg-gradient-to-r from-emerald-500 to-teal-500',
                      c.accent === 'blue' && 'bg-gradient-to-r from-blue-600 to-indigo-600'
                    )}
                  />

                  <div>
                    {/* Header: Icon badge & Pill Tag */}
                    <div className="flex items-center justify-between gap-2">
                      <div
                        className={clsx(
                          'w-12 h-12 rounded-xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300',
                          c.accent === 'saffron' && 'bg-orange-50 text-orange-600 border border-orange-200/80',
                          c.accent === 'green' && 'bg-emerald-50 text-emerald-600 border border-emerald-200/80',
                          c.accent === 'blue' && 'bg-blue-50 text-blue-600 border border-blue-200/80'
                        )}
                      >
                        <Icon className="h-6 w-6" aria-hidden="true" />
                      </div>
                      <span
                        className={clsx(
                          'text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border',
                          c.accent === 'saffron' && 'bg-orange-50 text-orange-700 border-orange-200',
                          c.accent === 'green' && 'bg-emerald-50 text-emerald-700 border-emerald-200',
                          c.accent === 'blue' && 'bg-blue-50 text-blue-700 border-blue-200'
                        )}
                      >
                        {c.tag}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="mt-4 text-[17px] font-bold text-slate-900 group-hover:text-brand-900 transition-colors leading-snug">
                      {c.title}
                    </h3>

                    {/* Body */}
                    <p className="mt-2 text-[13.5px] leading-relaxed text-slate-600">
                      {c.body}
                    </p>
                  </div>

                  {/* Footer */}
                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[12px] font-semibold text-slate-500 flex items-center gap-1.5">
                      <span
                        className={clsx(
                          'h-1.5 w-1.5 rounded-full',
                          c.accent === 'saffron' && 'bg-orange-500',
                          c.accent === 'green' && 'bg-emerald-500',
                          c.accent === 'blue' && 'bg-blue-500'
                        )}
                      />
                      {c.metric}
                    </span>
                    <span
                      className={clsx(
                        'text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-all',
                        c.accent === 'saffron' && 'text-orange-600 group-hover:text-orange-700',
                        c.accent === 'green' && 'text-emerald-600 group-hover:text-emerald-700',
                        c.accent === 'blue' && 'text-blue-600 group-hover:text-blue-700'
                      )}
                    >
                      EXPLORE <ArrowUpRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it works matching Reference Image 4 */}
      <section id="how-it-works" className="scroll-mt-4 border-b border-line bg-white py-16">
        <div className="page">
          {/* Top Progress Milestone Pill matching Image 4 */}
          <div className="flex flex-col items-center text-center max-w-2xl mx-auto mb-12">
            <div className="inline-flex items-center gap-3 rounded-full bg-slate-900 text-white px-4 py-1.5 shadow-sm mb-4">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-saffron text-white text-[11px] font-extrabold">
                3
              </span>
              <span className="text-xs font-bold tracking-wide">
                Stage 3 of 5 · Verification in Progress
              </span>
              <div className="w-20 h-2 bg-slate-700 rounded-full overflow-hidden ml-1">
                <div className="h-full bg-gradient-to-r from-orange-400 via-purple-400 to-emerald-400 rounded-full w-[60%]" />
              </div>
              <span className="text-[11px] font-semibold text-slate-300">60%</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-brand-900 tracking-tight">
              How OneCheck Works
            </h2>
            <p className="mt-2 text-[15px] text-ink-soft leading-relaxed">
              An evidence-linked 5-stage scrutiny lifecycle. Automated algorithms extract and cross-reconcile, while authorised human officers retain final decision authority.
            </p>
          </div>

          {/* 5 Milestone Cards matching Image 4 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {STEPS.map((s) => (
              <div
                key={s.step}
                className={clsx(
                  'rounded-2xl p-5 bg-white border flex flex-col justify-between shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-lg transition-all duration-300 hover:-translate-y-1',
                  s.active
                    ? 'border-2 border-cyan-500 ring-4 ring-cyan-500/10 bg-cyan-50/15'
                    : 'border-slate-200/90'
                )}
              >
                <div>
                  {/* Top row: Big Number + Pill Badge */}
                  <div className="flex items-center justify-between">
                    <span
                      className={clsx(
                        'text-3xl sm:text-4xl font-extrabold tracking-tight',
                        s.numColor
                      )}
                    >
                      {s.step}
                    </span>
                    <span
                      className={clsx(
                        'text-[11px] font-bold px-2.5 py-0.5 rounded-full border',
                        s.badgeStyle
                      )}
                    >
                      {s.badge}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="mt-3 text-[15px] font-bold text-slate-900 leading-snug">
                    {s.title}
                  </h3>

                  {/* Description */}
                  <p className="mt-2 text-[12.5px] leading-relaxed text-slate-600">
                    {s.body}
                  </p>
                </div>

                {/* Step indicator tag */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    {s.timing}
                  </span>
                  <span className={clsx('h-2 w-2 rounded-full', s.dotColor)} />
                </div>
              </div>
            ))}
          </div>

          {/* Connecting Timeline Track matching Image 4 */}
          <div className="mt-10 hidden lg:block relative">
            <div className="absolute top-1/2 left-[8%] right-[8%] -translate-y-1/2 h-1 bg-gradient-to-r from-orange-400 via-purple-500 to-emerald-500 rounded-full -z-0" />
            <div className="grid grid-cols-5 relative z-10">
              {STEPS.map((s) => (
                <div key={s.step} className="flex flex-col items-center text-center">
                  <div
                    className={clsx(
                      'w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-md transition-transform hover:scale-110',
                      s.circleBg
                    )}
                  >
                    {s.done ? <Check className="h-4 w-4 stroke-[3]" /> : s.step}
                  </div>
                  <span className="mt-2 text-xs font-extrabold uppercase tracking-wider text-slate-700">
                    {s.actionLabel}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Action CTA Button matching Image 4 */}
          <div className="mt-12 flex justify-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-2.5 rounded-full bg-gradient-to-r from-orange-500 via-orange-600 to-rose-500 px-8 py-3.5 text-sm sm:text-base font-bold text-white shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 hover:scale-[1.02] transition-all"
            >
              Start verification demo — explore live workflow <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Three-source reconciliation */}
          <div className="mt-14 rounded-2xl border border-slate-200/90 bg-gradient-to-br from-slate-50 via-white to-orange-50/30 p-6 sm:p-8 shadow-sm">
            <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-center">
              <div>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-saffron bg-orange-100/70 border border-orange-200 px-3 py-1 rounded-full mb-3">
                  Triangle of Truth
                </span>
                <h3 className="text-xl sm:text-2xl font-extrabold text-brand-900 tracking-tight">
                  Reconciling Three Authoritative Sources
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                  Every claim is checked from three independent directions. When any two disagree beyond tolerance,
                  OneCheck records an explainable <strong>Mismatch Detected</strong> finding citing the exact document page,
                  bounding box, and regulatory rule that applies.
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 rounded bg-white border border-line px-2.5 py-1 font-semibold text-slate-700">
                    <span className="h-2 w-2 rounded-full bg-saffron" /> Form Declarations
                  </span>
                  <span className="inline-flex items-center gap-1 rounded bg-white border border-line px-2.5 py-1 font-semibold text-slate-700">
                    <span className="h-2 w-2 rounded-full bg-blue-600" /> Extracted OCR Evidence
                  </span>
                  <span className="inline-flex items-center gap-1 rounded bg-white border border-line px-2.5 py-1 font-semibold text-slate-700">
                    <span className="h-2 w-2 rounded-full bg-emerald-600" /> AICTE Ledger Archives
                  </span>
                </div>
              </div>
              <figure className="rounded-xl border border-line bg-white p-5 shadow-sm" aria-label="Diagram: claim, document and record compared">
                <div className="grid grid-cols-3 gap-2.5 text-center text-[13px]">
                  {[
                    { t: 'Institution claim', d: 'Values entered in application form', border: 'border-orange-200 bg-orange-50/50 text-orange-950' },
                    { t: 'Document evidence', d: 'OCR values from uploaded PDFs', border: 'border-blue-200 bg-blue-50/50 text-blue-950' },
                    { t: 'AICTE records', d: 'Past approval ledgers & intake caps', border: 'border-emerald-200 bg-emerald-50/50 text-emerald-950' },
                  ].map((n) => (
                    <div key={n.t} className={clsx('rounded-lg border px-2.5 py-3 transition-transform hover:scale-105', n.border)}>
                      <p className="font-bold text-[13px]">{n.t}</p>
                      <p className="mt-1 text-[11px] leading-tight text-slate-600">{n.d}</p>
                    </div>
                  ))}
                </div>
                <div className="my-3 flex justify-center text-slate-400" aria-hidden="true">
                  <svg width="260" height="26" viewBox="0 0 260 26" fill="none">
                    <path d="M43 0 V10 H130 M217 0 V10 H130 M130 0 V22" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" />
                    <path d="M125 17 L130 23 L135 17" stroke="currentColor" strokeWidth="2" fill="none" />
                  </svg>
                </div>
                <div className="mx-auto max-w-xs rounded-lg border border-brand-300 bg-brand-50 px-4 py-2.5 text-center shadow-sm">
                  <p className="font-bold text-brand-900 text-sm">Comparison under AICTE EoA Rules</p>
                  <p className="text-[11.5px] text-brand-700 font-medium">Recorded with cryptographic evidence citations</p>
                </div>
              </figure>
            </div>
          </div>
        </div>
      </section>

      {/* Status reference */}
      <section id="statuses" className="scroll-mt-4 border-b border-line bg-[#f7f9fb]">
        <div className="page py-10">
          <h2 className="section-title text-lg">Verification statuses</h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-soft">
            Every check ends in one explicit status. A source that cannot be reached is reported as unavailable and
            routed to an officer — it is never treated as verified.
          </p>
          <div className="mt-5 overflow-x-auto rounded border border-line bg-white">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col" className="w-[230px]">Status</th>
                  <th scope="col">Meaning</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(VERIFICATION_STATUS).map(([value, d]) => (
                  <tr key={value}>
                    <td>
                      <StatusPill domain="verification" value={value} size="md" />
                    </td>
                    <td className="text-ink-soft">{d.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Oversight */}
      <section id="oversight" className="scroll-mt-4 border-b border-line">
        <div className="page grid gap-8 py-10 lg:grid-cols-3">
          <div>
            <h2 className="section-title text-lg">Transparency and human oversight</h2>
          </div>
          <ul className="space-y-3 text-[15px] text-ink-soft lg:col-span-2">
            <li className="border-l-[3px] border-brand-200 pl-3">
              <strong className="text-ink">Evidence first.</strong> A finding shows the claim, the extracted value, the
              source page and the rule reference, so it can be checked independently.
            </li>
            <li className="border-l-[3px] border-brand-200 pl-3">
              <strong className="text-ink">Explicit statuses.</strong> Pending, unavailable and manual-review states are
              shown as such and are never presented as a pass.
            </li>
            <li className="border-l-[3px] border-brand-200 pl-3">
              <strong className="text-ink">Recorded actions.</strong> Sign-ins, uploads, dispositions, letters and
              decisions are written to a hash-linked audit log that can be verified for tampering.
            </li>
            <li className="border-l-[3px] border-brand-200 pl-3">
              <strong className="text-ink">People decide.</strong> Risk scores and findings are decision support.
              Approval outcomes are recorded only by authorised officers and directors.
            </li>
          </ul>
        </div>
      </section>

      {/* Disclaimer */}
      <section id="disclaimer" className="scroll-mt-4">
        <div className="page py-8">
          <div className="rounded border border-line bg-[#f7f9fb] px-4 py-3 text-sm text-ink-soft">
            <h2 className="font-semibold text-ink">Disclaimer</h2>
            <p className="mt-1">
              OneCheck is an independent project developed for the Smart India Hackathon. It is not an official website
              of AICTE, the Ministry of Education or the Government of India, and is not endorsed by them. External
              registries used for verification in this prototype are simulated, and demonstration cases use synthetic
              data.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
