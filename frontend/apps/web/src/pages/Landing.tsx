import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { GovtTopBar, TricolorBar, AppFooter } from '../components/ui';
import {
  ShieldCheck,
  Layers,
  ArrowRight,
  Lock,
  Scale,
  CheckCircle2,
  AlertTriangle,
  Clock,
  HelpCircle,
  Menu,
  X,
  FileSearch,
  Check,
  Database,
  Award,
  AlertCircle,
  FileText,
  UserCheck,
  Workflow,
  FileSpreadsheet,
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FA] text-[#0B2038] font-sans selection:bg-blue-100 selection:text-[#0B2038]">
      {/* Top Government of India Header */}
      <GovtTopBar />

      {/* Main Sticky Navigation Bar with Smooth Scroll Links */}
      <header className="bg-white/95 backdrop-blur-md border-b border-[#E5E7EB] sticky top-0 z-50 transition-all shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <img src="/assets/logo2.png" alt="OneCheck Logo" className="h-9 w-auto transition-transform group-hover:scale-105" />
            <div>
              <span className="font-extrabold text-lg tracking-tight text-[#0B2038] block leading-tight">
                ONECHECK
              </span>
              <p className="text-[10px] text-[#475569] uppercase tracking-widest font-semibold">
                AICTE Regulatory Scrutiny Platform
              </p>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-7 text-xs font-semibold text-[#475569]">
            <a
              href="#capabilities"
              className="hover:text-[#005ea2] transition-colors py-1 border-b-2 border-transparent hover:border-[#005ea2]"
            >
              Capabilities
            </a>
            <a
              href="#workflow"
              className="hover:text-[#005ea2] transition-colors py-1 border-b-2 border-transparent hover:border-[#005ea2]"
            >
              Workflow
            </a>
            <a
              href="#reconciliation"
              className="hover:text-[#005ea2] transition-colors py-1 border-b-2 border-transparent hover:border-[#005ea2]"
            >
              Reconciliation
            </a>
            <a
              href="#statuses"
              className="hover:text-[#005ea2] transition-colors py-1 border-b-2 border-transparent hover:border-[#005ea2]"
            >
              Statuses
            </a>
            <a
              href="#transparency"
              className="hover:text-[#005ea2] transition-colors py-1 border-b-2 border-transparent hover:border-[#005ea2]"
            >
              Transparency
            </a>
          </nav>

          {/* Action Button & Mobile Menu Toggle */}
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#005ea2] hover:bg-[#0b4778] text-white font-semibold rounded-md text-xs shadow-xs hover:shadow transition-all"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Portal Sign In</span>
            </Link>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-md text-[#475569] hover:text-[#0B2038] hover:bg-slate-100 transition-colors"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Navigation */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-[#E5E7EB] bg-white/98 px-4 py-4 space-y-2 shadow-lg">
            <a
              href="#capabilities"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-md text-sm font-semibold text-[#0B2038] hover:bg-slate-100 hover:text-[#005ea2]"
            >
              Capabilities
            </a>
            <a
              href="#workflow"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-md text-sm font-semibold text-[#0B2038] hover:bg-slate-100 hover:text-[#005ea2]"
            >
              Workflow
            </a>
            <a
              href="#reconciliation"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-md text-sm font-semibold text-[#0B2038] hover:bg-slate-100 hover:text-[#005ea2]"
            >
              Reconciliation
            </a>
            <a
              href="#statuses"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-md text-sm font-semibold text-[#0B2038] hover:bg-slate-100 hover:text-[#005ea2]"
            >
              Statuses
            </a>
            <a
              href="#transparency"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-md text-sm font-semibold text-[#0B2038] hover:bg-slate-100 hover:text-[#005ea2]"
            >
              Transparency
            </a>
          </div>
        )}
      </header>

      {/* Hero Section with Sliding Shadow Animation on Background Image */}
      <section className="relative min-h-[calc(100svh-4rem)] flex items-center justify-center overflow-hidden border-b border-[#E5E7EB]">
        {/* Background Image Container with Increased Brightness and Refined Soft Masks */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none">
          <img
            src="/assets/bg.png"
            alt="OneCheck Regulatory Background"
            style={{ filter: 'brightness(1.2)' }}
            className="w-full h-full object-cover object-center animate-hero-bg-shadow scale-[1.03]"
          />
          {/* Subtle Luminous Sliding Shadow Accent with Reduced Darkening */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="w-[85%] h-full bg-gradient-to-r from-transparent via-[#0B2038]/10 to-transparent blur-3xl animate-sliding-shadow-sweep" />
          </div>
          {/* Soft Luminous Gradient - lets natural background vibrancy shine through */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/15 via-transparent to-white/20" />
        </div>

        {/* Centered Hero Content with Contrast Enhancement */}
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 w-full flex flex-col items-center justify-center text-center">
          {/* Subtle soft backdrop halo to ensure 100% legibility over brighter background */}
          <div className="absolute inset-0 max-w-2xl mx-auto bg-white/50 rounded-3xl blur-3xl -z-10 pointer-events-none" />

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/95 border border-slate-300 text-xs font-bold text-[#0B2038] mb-6 shadow-xs backdrop-blur-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>AICTE APPROVAL PROCESS HANDBOOK 2024–27</span>
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl font-black text-[#0B2038] tracking-tight mb-4 drop-shadow-[0_2px_16px_rgba(255,255,255,0.95)]">
            ONECHECK
          </h1>

          <p className="text-sm sm:text-base md:text-lg text-[#0B2038] font-semibold max-w-2xl mx-auto leading-relaxed mb-8 drop-shadow-[0_1px_10px_rgba(255,255,255,0.95)]">
            Automated documentary cross-verification and regulatory compliance scrutiny for technical education institutions under AICTE Approval Process Handbook norms.
          </p>

          {/* Direct Primary Actions with Tricolor identity */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto">
            <Link
              to="/login"
              className="w-full sm:w-auto px-7 py-3.5 bg-[#0B2038] hover:bg-[#07192f] text-white font-bold rounded-md text-xs sm:text-sm shadow-md transition-all inline-flex items-center justify-center gap-2 relative overflow-hidden group border border-slate-700/50"
            >
              <span>Institutional Portal</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              <span className="absolute bottom-0 left-0 right-0 h-[2.5px] flex" aria-hidden="true">
                <span className="w-1/3 bg-[#FF9933]" />
                <span className="w-1/3 bg-white" />
                <span className="w-1/3 bg-[#138808]" />
              </span>
            </Link>

            <Link
              to="/login"
              className="w-full sm:w-auto px-7 py-3.5 bg-white hover:bg-slate-50 text-[#0B2038] font-bold rounded-md text-xs sm:text-sm shadow-md transition-all inline-flex items-center justify-center gap-2 border border-slate-300 relative overflow-hidden group"
            >
              <Lock className="w-4 h-4 text-[#005ea2]" />
              <span>Scrutiny Officer Queue</span>
              <span className="absolute bottom-0 left-0 right-0 h-[2.5px] flex" aria-hidden="true">
                <span className="w-1/3 bg-[#FF9933]" />
                <span className="w-1/3 bg-white" />
                <span className="w-1/3 bg-[#138808]" />
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* Tricolor National Accent Line */}
      <TricolorBar />

      {/* REFACTORED QUOTE CARD COMPONENT: Centered, constrained (max-w-[900px]), elevated shadow, saffron & green top border */}
      <div className="py-8 px-4 sm:px-6 max-w-[900px] mx-auto w-full">
        <div className="relative bg-white rounded-2xl border border-[#E5E7EB] p-8 shadow-lg overflow-hidden">
          {/* Thin Top Border Accent with Saffron & Green colors */}
          <div className="absolute top-0 left-0 right-0 h-[3.5px] flex" aria-hidden="true">
            <div className="w-1/2 bg-[#FF9933]" />
            <div className="w-1/2 bg-[#138808]" />
          </div>

          {/* Internal Horizontal Layout */}
          <div className="flex flex-col sm:flex-row items-center gap-5 sm:gap-6 text-center sm:text-left">
            <img
              src="/assets/modi_ji.png"
              alt="Narendra Modi"
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 border-slate-200 object-cover shrink-0 shadow-sm"
            />
            <div className="space-y-1.5">
              <p className="text-sm sm:text-base text-[#475569] italic leading-relaxed">
                "I see technology, innovation and regulatory transparency as exciting and effective instruments for India's transformation."
              </p>
              <p className="text-xs sm:text-sm font-bold text-[#0f172a]">
                — Narendra Modi, Prime Minister of India
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ENCAPSULATED SECTION: The Vision */}
      <section id="vision" className="scroll-mt-20 py-5 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-8 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            <div className="md:col-span-5 card-tricolor p-6 text-center flex flex-col items-center">
              <div className="absolute top-0 left-0 right-0 h-[3.5px] flex" aria-hidden="true">
                <div className="w-1/3 bg-[#FF9933]" />
                <div className="w-1/3 bg-slate-200" />
                <div className="w-1/3 bg-[#138808]" />
              </div>

              <img src="/assets/logo2.png" alt="OneCheck Logo" className="h-14 w-auto mb-3 mt-1" />
              <h3 className="font-bold text-lg text-[#0B2038] mb-0.5">ONECHECK</h3>
              <span className="text-[10.5px] font-semibold text-[#475569] uppercase tracking-wider mb-3">
                Automated Regulatory Scrutiny
              </span>
              <p className="text-xs text-[#475569] leading-relaxed max-w-xs mb-4">
                Connecting academic institutions with zero-trust automated scrutiny pipelines through secure, compliant verification.
              </p>
              <div className="text-[11px] font-medium text-[#475569] flex items-center justify-center gap-1.5 pt-3 border-t border-slate-100 w-full">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Standard GFR Rule 194 Conformance</span>
              </div>
            </div>

            <div className="md:col-span-7 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#005ea2] block">
                Our Purpose
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0B2038] tracking-tight">
                The Vision
              </h2>
              <p className="text-xs sm:text-sm text-[#475569] leading-relaxed">
                Traditional regulatory approval processes were constrained by manual document inspections, creating insurmountable verification backlogs, delayed academic sessions, and subjective manual checks across thousands of institutions.
              </p>
              <p className="text-xs sm:text-sm text-[#475569] leading-relaxed">
                <strong className="text-[#0B2038]">OneCheck transforms this.</strong> As an automated regulatory scrutiny engine, it cross-verifies physical building plans, land revenue records, fire safety certifications, and faculty rosters against AICTE Approval Process Handbook (APH) norms in real time.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ENCAPSULATED SECTION 1: System Capabilities */}
      <section
        id="capabilities"
        className="scroll-mt-20 py-5 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full"
      >
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-8 shadow-sm">
          <div className="text-center max-w-3xl mx-auto mb-10">
            {/* Small Green Badge above header */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              AICTE-GRADE VERIFICATION CORE
            </div>

            {/* Header */}
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B2038] tracking-tight mb-3">
              System Capabilities
            </h2>

            <p className="text-sm sm:text-base text-[#475569] leading-relaxed">
              Multi-layered algorithmic scrutiny modules engineered to enforce statutory mandates of the AICTE Approval Process Handbook.
            </p>
          </div>

          {/* 3x2 Grid of Feature Cards with Column Top Borders: Col 1 Orange, Col 2 Blue, Col 3 Green */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Card 1: Column 1 (Orange Border) */}
            <div className="bg-[#FFFFFF] rounded-xl border border-slate-200 border-t-4 border-t-[#FF671F] p-6 shadow-xs hover:shadow-md transition-all flex flex-col group">
              <div className="w-10 h-10 rounded-lg bg-orange-50 text-[#FF671F] flex items-center justify-center mb-4">
                <FileSearch className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#0B2038] mb-2 group-hover:text-[#FF671F] transition-colors">
                Document verification & forensics
              </h3>
              <p className="text-xs sm:text-sm text-[#475569] leading-relaxed flex-grow">
                Examines uploaded PDF artifact streams, font metadata, raster alteration layers, and digital signatures to detect document tampering and forgery in statutory filings.
              </p>
              <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
                <a
                  href="#workflow"
                  className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#FF671F] hover:text-[#d44e0f] group-hover:translate-x-0.5 transition-all"
                >
                  <span>EXPLORE</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Card 2: Column 2 (Blue Border) */}
            <div className="bg-[#FFFFFF] rounded-xl border border-slate-200 border-t-4 border-t-[#005ea2] p-6 shadow-xs hover:shadow-md transition-all flex flex-col group">
              <div className="w-10 h-10 rounded-lg bg-blue-50 text-[#005ea2] flex items-center justify-center mb-4">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#0B2038] mb-2 group-hover:text-[#005ea2] transition-colors">
                AICTE record reconciliation
              </h3>
              <p className="text-xs sm:text-sm text-[#475569] leading-relaxed flex-grow">
                Automated cross-referencing against central approval archives, verifying sanctioned intake history, previous EoA deficiency fulfillments, and accredited programme tracks.
              </p>
              <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
                <a
                  href="#reconciliation"
                  className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#005ea2] hover:text-[#0b4778] group-hover:translate-x-0.5 transition-all"
                >
                  <span>EXPLORE</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Card 3: Column 3 (Green Border) */}
            <div className="bg-[#FFFFFF] rounded-xl border border-slate-200 border-t-4 border-t-[#046A38] p-6 shadow-xs hover:shadow-md transition-all flex flex-col group">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 text-[#046A38] flex items-center justify-center mb-4">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#0B2038] mb-2 group-hover:text-[#046A38] transition-colors">
                Evidence-linked mismatch detection
              </h3>
              <p className="text-xs sm:text-sm text-[#475569] leading-relaxed flex-grow">
                Pinpoints exact discrepancies with coordinate-level bounding boxes across architectural layouts, land boundary surveys, and faculty affidavits for rapid officer scrutiny.
              </p>
              <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
                <a
                  href="#statuses"
                  className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#046A38] hover:text-[#034d28] group-hover:translate-x-0.5 transition-all"
                >
                  <span>EXPLORE</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Card 4: Column 1 (Orange Border) */}
            <div className="bg-[#FFFFFF] rounded-xl border border-slate-200 border-t-4 border-t-[#FF671F] p-6 shadow-xs hover:shadow-md transition-all flex flex-col group">
              <div className="w-10 h-10 rounded-lg bg-orange-50 text-[#FF671F] flex items-center justify-center mb-4">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#0B2038] mb-2 group-hover:text-[#FF671F] transition-colors">
                Checklist & schema validation
              </h3>
              <p className="text-xs sm:text-sm text-[#475569] leading-relaxed flex-grow">
                Validates mandatory APH appendix forms, land registration deeds, audited financial balance sheets, and barrier-free facility declarations against standardized schemas.
              </p>
              <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
                <a
                  href="#workflow"
                  className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#FF671F] hover:text-[#d44e0f] group-hover:translate-x-0.5 transition-all"
                >
                  <span>EXPLORE</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Card 5: Column 2 (Blue Border) */}
            <div className="bg-[#FFFFFF] rounded-xl border border-slate-200 border-t-4 border-t-[#005ea2] p-6 shadow-xs hover:shadow-md transition-all flex flex-col group">
              <div className="w-10 h-10 rounded-lg bg-blue-50 text-[#005ea2] flex items-center justify-center mb-4">
                <Award className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#0B2038] mb-2 group-hover:text-[#005ea2] transition-colors">
                Statutory certificate validity
              </h3>
              <p className="text-xs sm:text-sm text-[#475569] leading-relaxed flex-grow">
                Real-time validity period verification of fire safety NOCs, structural stability certifications, municipal occupancy clearances, and institutional pollution control consents.
              </p>
              <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
                <a
                  href="#reconciliation"
                  className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#005ea2] hover:text-[#0b4778] group-hover:translate-x-0.5 transition-all"
                >
                  <span>EXPLORE</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Card 6: Column 3 (Green Border) */}
            <div className="bg-[#FFFFFF] rounded-xl border border-slate-200 border-t-4 border-t-[#046A38] p-6 shadow-xs hover:shadow-md transition-all flex flex-col group">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 text-[#046A38] flex items-center justify-center mb-4">
                <Scale className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#0B2038] mb-2 group-hover:text-[#046A38] transition-colors">
                Officer scrutiny & audit trail
              </h3>
              <p className="text-xs sm:text-sm text-[#475569] leading-relaxed flex-grow">
                Cryptographically chained SHA-256 audit log storing every algorithm finding, officer remark, institutional clarification, and final administrative disposition.
              </p>
              <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
                <a
                  href="#transparency"
                  className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#046A38] hover:text-[#034d28] group-hover:translate-x-0.5 transition-all"
                >
                  <span>EXPLORE</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ENCAPSULATED SECTION 2: How OneCheck Works */}
      <section
        id="workflow"
        className="scroll-mt-20 py-5 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full"
      >
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-8 shadow-sm">
          {/* Progress Indicator and Header */}
          <div className="text-center max-w-3xl mx-auto mb-10">
            {/* Dark Pill-Shaped Progress Indicator */}
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-[#0B2038] text-white text-xs font-medium shadow-md mb-4 border border-slate-700/60">
              <span className="flex items-center gap-2 font-semibold text-slate-100">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
                </span>
                <span>Stage 3 of 5 · Verification in Progress</span>
              </span>
              <div className="w-24 sm:w-32 h-2 bg-slate-700/90 rounded-full overflow-hidden p-0.5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-orange-400 via-blue-400 to-emerald-400 transition-all duration-500"
                  style={{ width: '60%' }}
                />
              </div>
              <span className="text-[11px] font-bold text-blue-300 font-mono">60%</span>
            </div>

            {/* Centered Header */}
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B2038] tracking-tight mb-3">
              How OneCheck Works
            </h2>
            <p className="text-sm sm:text-base text-[#475569] leading-relaxed">
              An end-to-end statutory verification lifecycle moving from institutional submission to accountable officer disposition.
            </p>
          </div>

          {/* 5 Step Timeline Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            {/* Step 01 */}
            <div className="bg-[#FFFFFF] rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-col transition-all hover:border-slate-300">
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl font-black text-slate-400 font-mono">01</span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-orange-100 text-orange-800 border border-orange-200">
                  Filing
                </span>
              </div>
              <h3 className="text-sm font-bold text-[#0B2038] mb-1.5">Application Submission</h3>
              <p className="text-xs text-[#475569] leading-relaxed">
                Institution uploads building CAD blueprints, land revenue registry deeds, and faculty rosters into the portal.
              </p>
            </div>

            {/* Step 02 */}
            <div className="bg-[#FFFFFF] rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-col transition-all hover:border-slate-300">
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl font-black text-slate-400 font-mono">02</span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-200">
                  Instant
                </span>
              </div>
              <h3 className="text-sm font-bold text-[#0B2038] mb-1.5">Document Ingestion</h3>
              <p className="text-xs text-[#475569] leading-relaxed">
                Automated multi-modal parsing reads PDF vectors, checks digital signatures, and extracts structured data tables.
              </p>
            </div>

            {/* Step 03 - Active with Thick Blue Border and Drop Shadow */}
            <div className="bg-[#FFFFFF] rounded-xl border-2 border-[#005ea2] p-5 shadow-xl ring-4 ring-[#005ea2]/15 relative scale-[1.02] z-10 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl font-black text-[#005ea2] font-mono">03</span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-200 animate-pulse">
                  Multi-modal
                </span>
              </div>
              <div className="inline-block mb-1 text-[10px] font-extrabold uppercase tracking-widest text-[#005ea2]">
                ACTIVE STAGE
              </div>
              <h3 className="text-sm font-bold text-[#0B2038] mb-1.5">Triangle Reconciliation</h3>
              <p className="text-xs text-[#475569] leading-relaxed">
                Correlates claimed institutional numbers against evidence bounding boxes and central AICTE database benchmarks.
              </p>
            </div>

            {/* Step 04 */}
            <div className="bg-[#FFFFFF] rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-col transition-all hover:border-slate-300">
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl font-black text-slate-400 font-mono">04</span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Transparent
                </span>
              </div>
              <h3 className="text-sm font-bold text-[#0B2038] mb-1.5">Discrepancy Synthesis</h3>
              <p className="text-xs text-[#475569] leading-relaxed">
                Calculates exact variance percentages and flags any land deficit or norm shortfall with clear visual callouts.
              </p>
            </div>

            {/* Step 05 */}
            <div className="bg-[#FFFFFF] rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-col transition-all hover:border-slate-300">
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl font-black text-slate-400 font-mono">05</span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-300">
                  Human-in-Loop
                </span>
              </div>
              <h3 className="text-sm font-bold text-[#0B2038] mb-1.5">Officer Adjudication</h3>
              <p className="text-xs text-[#475569] leading-relaxed">
                Scrutiny Officers review side-by-side evidence packets to issue verified Approvals or precise Deficiency Memos.
              </p>
            </div>
          </div>

          {/* Connected Horizontal Timeline Bar with Checkmarks */}
          <div className="hidden md:block max-w-4xl mx-auto my-8 px-4">
            <div className="relative flex items-center justify-between">
              {/* Connecting line */}
              <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-1 bg-slate-200 z-0">
                <div className="h-full bg-gradient-to-r from-emerald-500 via-blue-500 to-blue-500 w-[50%]" />
              </div>

              {/* Node 1 - Completed */}
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-md ring-4 ring-white">
                  <Check className="w-5 h-5 stroke-[2.5]" />
                </div>
                <span className="text-[11px] font-bold text-emerald-700 mt-2">Step 01 Done</span>
              </div>

              {/* Node 2 - Completed */}
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-md ring-4 ring-white">
                  <Check className="w-5 h-5 stroke-[2.5]" />
                </div>
                <span className="text-[11px] font-bold text-emerald-700 mt-2">Step 02 Done</span>
              </div>

              {/* Node 3 - Active In Progress */}
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-[#005ea2] text-white flex items-center justify-center font-bold text-sm shadow-lg ring-4 ring-blue-100 animate-pulse">
                  <span className="font-mono">03</span>
                </div>
                <span className="text-[11px] font-extrabold text-[#005ea2] mt-2">Current Active</span>
              </div>

              {/* Node 4 - Upcoming */}
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-white border-2 border-slate-300 text-slate-500 flex items-center justify-center font-bold text-sm shadow-xs ring-4 ring-white">
                  <span className="font-mono">04</span>
                </div>
                <span className="text-[11px] font-semibold text-slate-500 mt-2">Upcoming</span>
              </div>

              {/* Node 5 - Upcoming */}
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-white border-2 border-slate-300 text-slate-500 flex items-center justify-center font-bold text-sm shadow-xs ring-4 ring-white">
                  <span className="font-mono">05</span>
                </div>
                <span className="text-[11px] font-semibold text-slate-500 mt-2">Final Step</span>
              </div>
            </div>
          </div>

          {/* Prominent Call-To-Action Button with Vibrant Orange-to-Red Linear Gradient */}
          <div className="text-center mt-6">
            <Link
              to="/login"
              className="inline-flex items-center gap-2.5 px-8 py-4 rounded-xl text-white font-bold text-sm sm:text-base shadow-lg shadow-orange-500/25 bg-gradient-to-r from-[#FF671F] via-[#F97316] to-[#DC2626] hover:from-[#EA580C] hover:to-[#B91C1C] hover:shadow-xl hover:scale-[1.02] active:scale-[0.99] transition-all group"
            >
              <span>Start verification demo — explore live workflow</span>
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </section>

      {/* ENCAPSULATED SECTION 3: Reconciling Three Authoritative Sources */}
      <section
        id="reconciliation"
        className="scroll-mt-20 py-5 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full"
      >
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-8 shadow-sm">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            {/* Left Column: Header and Explanatory Content */}
            <div className="lg:col-span-5 space-y-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-orange-50 text-orange-700 border border-orange-200 shadow-2xs">
                TRIANGLE OF TRUTH
              </div>

              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B2038] tracking-tight leading-tight">
                Reconciling Three Authoritative Sources
              </h2>

              <p className="text-sm sm:text-base text-[#475569] leading-relaxed">
                To eliminate subjective ambiguity and manual error, OneCheck operates on a strict triangular reconciliation paradigm. Every institutional assertion must be corroborated by both raw documentary proof and authoritative central AICTE historical data before regulatory approval is recommended.
              </p>

              <div className="pt-2 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-orange-100 text-[#FF671F] flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                  <p className="text-xs sm:text-sm text-[#475569]">
                    <strong className="text-[#0B2038]">Zero Blind Trust:</strong> Self-disclosed claims are never taken as gospel without corroborating evidence.
                  </p>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-blue-100 text-[#005ea2] flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                  <p className="text-xs sm:text-sm text-[#475569]">
                    <strong className="text-[#0B2038]">Spatial Proof Alignment:</strong> Direct pixel coordinates tie every room and building area to CAD blueprints.
                  </p>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 text-[#046A38] flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                  <p className="text-xs sm:text-sm text-[#475569]">
                    <strong className="text-[#0B2038]">Statutory History:</strong> Cross-checks historical approvals to prevent unauthorized quota expansion.
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column: Flowchart-Style Diagram */}
            <div className="lg:col-span-7 bg-slate-50/70 p-6 sm:p-8 rounded-2xl border border-slate-200">
              {/* Top Three Side-by-Side Boxes */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Box 1: Institution Claim (Orange Border) */}
                <div className="bg-white rounded-xl border-2 border-orange-500 p-4 text-center shadow-xs">
                  <div className="w-8 h-8 mx-auto rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center mb-2">
                    <FileText className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-bold text-[#0B2038]">Institution claim</h4>
                  <p className="text-[11px] text-[#475569] mt-1 leading-snug">
                    Declared built-up areas, faculty cadres & student intake
                  </p>
                </div>

                {/* Box 2: Document Evidence (Blue Border) */}
                <div className="bg-white rounded-xl border-2 border-blue-500 p-4 text-center shadow-xs">
                  <div className="w-8 h-8 mx-auto rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-2">
                    <FileSearch className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-bold text-[#0B2038]">Document evidence</h4>
                  <p className="text-[11px] text-[#475569] mt-1 leading-snug">
                    Architectural CAD plans, NOCs, bank challans & deed scans
                  </p>
                </div>

                {/* Box 3: AICTE Records (Green Border) */}
                <div className="bg-white rounded-xl border-2 border-emerald-500 p-4 text-center shadow-xs">
                  <div className="w-8 h-8 mx-auto rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2">
                    <Database className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-bold text-[#0B2038]">AICTE records</h4>
                  <p className="text-[11px] text-[#475569] mt-1 leading-snug">
                    Historical EoA databases, norm schedules & gazette rules
                  </p>
                </div>
              </div>

              {/* Dotted Lines Connecting Down to Comparison Box */}
              <div className="py-4 flex justify-center">
                <svg
                  className="w-full max-w-md h-16 text-blue-400"
                  viewBox="0 0 300 60"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M 50 0 V 25 Q 50 40 100 45 L 140 50"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeDasharray="4 4"
                  />
                  <path
                    d="M 150 0 V 50"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeDasharray="4 4"
                  />
                  <path
                    d="M 250 0 V 25 Q 250 40 200 45 L 160 50"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeDasharray="4 4"
                  />
                  <polygon points="150,58 145,49 155,49" fill="currentColor" />
                </svg>
              </div>

              {/* Single Blue-Bordered Box: Comparison under AICTE EoA Rules */}
              <div className="bg-white rounded-xl border-2 border-[#005ea2] p-5 shadow-md text-center max-w-lg mx-auto">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-[#005ea2] text-[11px] font-bold uppercase tracking-wider mb-2">
                  <Workflow className="w-3.5 h-3.5" />
                  AUTOMATED RECONCILIATION ENGINE
                </div>
                <h3 className="text-base sm:text-lg font-extrabold text-[#0B2038]">
                  Comparison under AICTE EoA Rules
                </h3>
                <p className="text-xs text-[#475569] mt-1.5 leading-relaxed">
                  Applies exact mathematical tolerances from AICTE Approval Process Handbook (APH 2024–27). Computes percentage discrepancy across land, instructional area, faculty ratios, and statutory fees.
                </p>

                <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-center gap-2">
                  <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 text-[11px] font-semibold border border-emerald-200">
                    Zero Variance: Auto-Clear
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-rose-50 text-rose-700 text-[11px] font-semibold border border-rose-200">
                    Deficiency: Bounding Box Flag
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-blue-50 text-[#005ea2] text-[11px] font-semibold border border-blue-200">
                    Officer Scrutiny Packet
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ENCAPSULATED SECTION 4: Verification statuses */}
      <section
        id="statuses"
        className="scroll-mt-20 py-5 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full"
      >
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-8 shadow-sm">
          <div className="max-w-3xl mb-8">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B2038] tracking-tight mb-3">
              Verification statuses
            </h2>
            <p className="text-sm sm:text-base text-[#475569] leading-relaxed">
              Standardized regulatory status classifications applied across institutional claims, uploaded documentary evidence, and municipal verification channels.
            </p>
          </div>

          {/* Full-Width Data Table with Light Grey Header Row */}
          <div className="rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200">
                    <th scope="col" className="py-4 px-6 text-xs font-bold text-[#0B2038] uppercase tracking-wider w-1/4 min-w-[200px]">
                      Status
                    </th>
                    <th scope="col" className="py-4 px-6 text-xs font-bold text-[#0B2038] uppercase tracking-wider">
                      Meaning
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {/* Row 1: Verified (Green) */}
                  <tr className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-4 px-6 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border border-emerald-600 text-emerald-700 bg-emerald-50/70">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Verified
                      </span>
                    </td>
                    <td className="py-4 px-6 text-[#475569] leading-relaxed">
                      The institutional claim has been completely corroborated by documentary evidence and authoritative repository records with zero discrepancy.
                    </td>
                  </tr>

                  {/* Row 2: Mismatch detected (Red) */}
                  <tr className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-4 px-6 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border border-rose-600 text-rose-700 bg-rose-50/70">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                        Mismatch detected
                      </span>
                    </td>
                    <td className="py-4 px-6 text-[#475569] leading-relaxed">
                      A substantive numerical or spatial variance exists between declared figures and extracted document evidence (e.g. built-up area variance exceeding allowable margin or faculty cadre deficit).
                    </td>
                  </tr>

                  {/* Row 3: Expired (Red) */}
                  <tr className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-4 px-6 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border border-rose-600 text-rose-700 bg-rose-50/70">
                        <Clock className="w-3.5 h-3.5 text-rose-600" />
                        Expired
                      </span>
                    </td>
                    <td className="py-4 px-6 text-[#475569] leading-relaxed">
                      The statutory certificate (e.g. Fire Safety NOC, Land Lease Deed, or Structural Stability Clearance) has lapsed past its mandatory validity date prior to the academic session.
                    </td>
                  </tr>

                  {/* Row 4: Verification pending (Blue) */}
                  <tr className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-4 px-6 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border border-blue-600 text-blue-700 bg-blue-50/70">
                        <Clock className="w-3.5 h-3.5 text-blue-600" />
                        Verification pending
                      </span>
                    </td>
                    <td className="py-4 px-6 text-[#475569] leading-relaxed">
                      Document ingested and queued for multi-modal OCR parsing, GIS parcel boundary check, or live API query against central databases.
                    </td>
                  </tr>

                  {/* Row 5: Source unavailable (Yellow) */}
                  <tr className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-4 px-6 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border border-amber-600 text-amber-700 bg-amber-50/70">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                        Source unavailable
                      </span>
                    </td>
                    <td className="py-4 px-6 text-[#475569] leading-relaxed">
                      External municipal registrar, state land revenue portal, or central banking treasury gateway is temporarily unreachable for automated cross-referencing.
                    </td>
                  </tr>

                  {/* Row 6: Manual review required (Purple) */}
                  <tr className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-4 px-6 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border border-purple-600 text-purple-700 bg-purple-50/70">
                        <UserCheck className="w-3.5 h-3.5 text-purple-600" />
                        Manual review required
                      </span>
                    </td>
                    <td className="py-4 px-6 text-[#475569] leading-relaxed">
                      Ambiguous or multi-part legal documentation detected requiring the assigned Scrutiny Officer to visually examine notarized affidavits, survey maps, or complex lease deeds.
                    </td>
                  </tr>

                  {/* Row 7: Not checked (Grey) */}
                  <tr className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-4 px-6 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border border-slate-400 text-slate-700 bg-slate-100">
                        <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
                        Not checked
                      </span>
                    </td>
                    <td className="py-4 px-6 text-[#475569] leading-relaxed">
                      Optional or conditional norm clause not triggered by the institution's specific programme category, location tier, or standalone status.
                    </td>
                  </tr>

                  {/* Row 8: Needs confirmation (Yellow) */}
                  <tr className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-4 px-6 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border border-amber-600 text-amber-700 bg-amber-50/70">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        Needs confirmation
                      </span>
                    </td>
                    <td className="py-4 px-6 text-[#475569] leading-relaxed">
                      Low-confidence OCR extraction or slight name spelling variation between registered society name and title deed holder requiring institutional reaffirmation.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ENCAPSULATED SECTION 5: Transparency and human oversight */}
      <section
        id="transparency"
        className="scroll-mt-20 py-5 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full"
      >
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-8 shadow-sm">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            {/* Left Column: Title aligned to the left */}
            <div className="lg:col-span-5 space-y-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-50 text-[#005ea2] border border-blue-200 shadow-2xs">
                ACCOUNTABLE GOVERNANCE
              </div>

              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B2038] tracking-tight leading-tight">
                Transparency and human oversight
              </h2>

              <p className="text-sm sm:text-base text-[#475569] leading-relaxed">
                OneCheck is an assistive intelligence platform built to empower statutory scrutiny committees—not replace them. By enforcing absolute algorithmic transparency, every verification decision remains accountable, contestable, and firmly in human hands.
              </p>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 mt-6">
                <div className="flex items-center gap-2 font-bold text-xs text-[#0B2038] mb-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Standard GFR Rule 194 Compliance</span>
                </div>
                <p className="text-xs text-[#475569] leading-relaxed">
                  Full adherence to sovereign digital public infrastructure benchmarks and strict non-repudiation of administrative scrutiny actions.
                </p>
              </div>
            </div>

            {/* Right Column: Vertical List of Four Items with Light Blue Left Border */}
            <div className="lg:col-span-7 space-y-5">
              {/* Item 1: Evidence first */}
              <div className="border-l-4 border-l-sky-400 pl-5 py-2.5 bg-slate-50/50 rounded-r-lg transition-all hover:bg-slate-50 hover:translate-x-1">
                <h3 className="font-bold text-lg text-[#0B2038] mb-1">
                  Evidence first
                </h3>
                <p className="text-xs sm:text-sm text-[#475569] leading-relaxed">
                  Every calculation, flag, and finding points directly to an immutable bounding box coordinate within original submitted PDFs. No synthetic score is ever generated in isolation.
                </p>
              </div>

              {/* Item 2: Explicit statuses */}
              <div className="border-l-4 border-l-sky-400 pl-5 py-2.5 bg-slate-50/50 rounded-r-lg transition-all hover:bg-slate-50 hover:translate-x-1">
                <h3 className="font-bold text-lg text-[#0B2038] mb-1">
                  Explicit statuses
                </h3>
                <p className="text-xs sm:text-sm text-[#475569] leading-relaxed">
                  Findings are presented through deterministic regulatory states rather than opaque confidence numbers. Institutions receive exact norm references to address deficiencies without guesswork.
                </p>
              </div>

              {/* Item 3: Recorded actions */}
              <div className="border-l-4 border-l-sky-400 pl-5 py-2.5 bg-slate-50/50 rounded-r-lg transition-all hover:bg-slate-50 hover:translate-x-1">
                <h3 className="font-bold text-lg text-[#0B2038] mb-1">
                  Recorded actions
                </h3>
                <p className="text-xs sm:text-sm text-[#475569] leading-relaxed">
                  All scrutiny officer dispositions, institutional replies, and automated extraction events are cryptographically hashed and permanently recorded in an immutable audit ledger.
                </p>
              </div>

              {/* Item 4: People decide */}
              <div className="border-l-4 border-l-sky-400 pl-5 py-2.5 bg-slate-50/50 rounded-r-lg transition-all hover:bg-slate-50 hover:translate-x-1">
                <h3 className="font-bold text-lg text-[#0B2038] mb-1">
                  People decide
                </h3>
                <p className="text-xs sm:text-sm text-[#475569] leading-relaxed">
                  Automated algorithms only summarize, cross-reference, and flag evidence. Final statutory approval, deficiency issuance, or rejection authority rests solely with designated AICTE scrutiny officers.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ENCAPSULATED SECTION: Digital Public Infrastructure Commitment */}
      <section id="governance" className="scroll-mt-20 py-5 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-8 shadow-sm text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[3.5px] flex" aria-hidden="true">
            <div className="w-1/3 bg-[#FF9933]" />
            <div className="w-1/3 bg-slate-200" />
            <div className="w-1/3 bg-[#138808]" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#475569] block mb-1 pt-1">
            Digital Public Infrastructure
          </span>
          <h2 className="text-xl sm:text-2xl font-extrabold text-[#0B2038] mb-2 tracking-tight">
            Our Statutory Commitment
          </h2>
          <p className="text-xs sm:text-sm text-[#475569] leading-relaxed max-w-2xl mx-auto">
            Built as scalable <strong className="text-[#0B2038]">Digital Public Infrastructure (DPI)</strong> for technical education governance in collaboration with AICTE and state regulatory authorities conforming to Standard GFR Rule 194.
          </p>
        </div>
      </section>

      {/* Official Government Footer */}
      <AppFooter />
    </div>
  );
};
