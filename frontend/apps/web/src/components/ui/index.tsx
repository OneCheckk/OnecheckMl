import React, { useState, useEffect, useRef, useId, useCallback } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import {
  AlertCircle,
  RefreshCw,
  Search,
  X,
  ChevronDown,
  ChevronUp,
  ChevronsLeft,
  ChevronsRight,
  ChevronLeft,
  ChevronRight,
  UploadCloud,
  HelpCircle,
  Inbox,
  Info,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { describeApiError } from '../../api/errors';

// ==========================================
// 1. Government context strip
// ==========================================

const FONT_STEPS = ['87.5%', '100%', '112.5%'];
const FONT_KEY = 'onecheck_text_size';

/**
 * Compact context strip. States the Government-of-India / Ministry context of
 * the AICTE process this tool supports, and states plainly that OneCheck is an
 * independent project, not an official website.
 */
export const GovtTopBar: React.FC<{ onOpenHelp?: () => void }> = ({ onOpenHelp }) => {
  const [step, setStep] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(FONT_KEY);
      const v = raw === null ? 1 : Number(raw);
      return Number.isInteger(v) && v >= 0 && v <= 2 ? v : 1;
    } catch {
      return 1;
    }
  });

  useEffect(() => {
    document.documentElement.style.fontSize = FONT_STEPS[step];
    try {
      localStorage.setItem(FONT_KEY, String(step));
    } catch {
      /* storage unavailable */
    }
  }, [step]);

  return (
    <div className="border-b border-line bg-[#f4f6f9] text-[12px] text-ink-soft">
      <div className="h-[3px] w-full flex" aria-hidden="true">
        <span className="flex-1 bg-saffron" />
        <span className="flex-1 bg-white" />
        <span className="flex-1 bg-indiagreen" />
      </div>
      <div className="page flex min-h-[30px] items-center justify-between gap-3 py-1">
        <p className="min-w-0 truncate">
          <span lang="hi" className="font-medium text-ink">भारत सरकार</span>
          <span className="mx-1.5 text-line-strong">|</span>
          <span className="font-medium text-ink">Government of India</span>
          <span className="hidden md:inline">
            <span className="mx-1.5 text-line-strong">|</span>
            Ministry of Education
          </span>
        </p>
        <div className="flex shrink-0 items-center gap-3">
          <span className="hidden lg:inline text-ink-faint">
            Independent SIH project — not an official Government website
          </span>
          <a href="#main-content" className="hidden sm:inline link text-[12px]">
            Skip to main content
          </a>
          <div className="flex items-center" role="group" aria-label="Text size">
            {['A-', 'A', 'A+'].map((label, i) => (
              <button
                key={label}
                type="button"
                onClick={() => setStep(i)}
                aria-pressed={step === i}
                aria-label={i === 0 ? 'Decrease text size' : i === 1 ? 'Default text size' : 'Increase text size'}
                className={clsx(
                  'h-6 min-w-[26px] border border-line px-1 text-[11px] font-semibold first:rounded-l-sm last:rounded-r-sm -ml-px first:ml-0',
                  step === i ? 'bg-brand-900 text-white border-brand-900' : 'bg-white text-ink hover:bg-brand-50'
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {onOpenHelp && (
            <button type="button" onClick={onOpenHelp} className="link text-[12px] inline-flex items-center gap-1">
              <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
              Help
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/** Thin tricolour rule. */
export const TricolorBar: React.FC<{ className?: string }> = ({ className }) => (
  <div className={clsx('h-[3px] w-full flex shrink-0', className)} aria-hidden="true">
    <span className="flex-1 bg-saffron" />
    <span className="flex-1 bg-white" />
    <span className="flex-1 bg-indiagreen" />
  </div>
);

// ==========================================
// 2. Brand block (original OneCheck identity)
// ==========================================

export const BrandBlock: React.FC<{ to?: string; compact?: boolean }> = ({ to = '/', compact = false }) => (
  <Link to={to} className="flex items-center gap-3 min-w-0 group" aria-label="OneCheck home">
    <img
      src="/assets/onecheck-logo.png"
      alt=""
      className={clsx('w-auto shrink-0 transition-transform group-hover:scale-105', compact ? 'h-9' : 'h-11 sm:h-12')}
    />
    <span className="min-w-0 leading-tight">
      <span className={clsx('block font-extrabold tracking-tight text-brand-900', compact ? 'text-lg' : 'text-xl sm:text-[23px]')}>
        One<span className="text-saffron">Check</span>
      </span>
      <span className="block truncate text-[12.5px] font-medium text-ink-soft">Regulatory Compliance &amp; Verification Platform</span>
      {!compact && (
        <span className="hidden sm:block truncate text-[11.5px] text-ink-faint">
          Decision support for AICTE Extension of Approval scrutiny
        </span>
      )}
    </span>
  </Link>
);

// ==========================================
// 3. Breadcrumbs
// ==========================================

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export const PageBreadcrumbs: React.FC<{ items: BreadcrumbItem[]; className?: string; homeHref?: string }> = ({
  items,
  className,
  homeHref,
}) => (
  <nav aria-label="Breadcrumb" className={clsx('text-meta text-ink-faint', className)}>
    <ol className="flex flex-wrap items-center gap-1">
      {homeHref && (
        <li>
          <Link to={homeHref} className="link">
            Home
          </Link>
        </li>
      )}
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <li key={idx} className="flex items-center gap-1">
            {(idx > 0 || homeHref) && (
              <ChevronRight className="h-3 w-3 text-line-strong" aria-hidden="true" />
            )}
            {isLast || !item.href ? (
              <span className={clsx(isLast && 'text-ink')} aria-current={isLast ? 'page' : undefined}>
                {item.label}
              </span>
            ) : (
              <Link to={item.href} className="link">
                {item.label}
              </Link>
            )}
          </li>
        );
      })}
    </ol>
  </nav>
);

// ==========================================
// 4. Page header
// ==========================================

export interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  className?: string;
  meta?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  badge,
  actions,
  breadcrumbs,
  className,
  meta,
}) => (
  <div className={clsx('mb-5 border-b border-line pb-4', className)}>
    {breadcrumbs && <PageBreadcrumbs items={breadcrumbs} className="mb-2" />}
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold text-brand-900 sm:text-[22px]">{title}</h1>
          {badge}
        </div>
        {description && <p className="mt-1 max-w-3xl text-sm text-ink-soft">{description}</p>}
        {meta && <div className="mt-2">{meta}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  </div>
);

// ==========================================
// 5. Buttons
// ==========================================

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'text';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  className,
  disabled,
  type = 'button',
  ...props
}) => {
  const base =
    'inline-flex items-center justify-center gap-1.5 rounded font-semibold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-55 select-none';

  const variants = {
    primary: 'bg-brand-700 text-white border border-brand-700 hover:bg-brand-800 hover:border-brand-800 focus-visible:ring-brand-600',
    secondary: 'bg-brand-900 text-white border border-brand-900 hover:bg-brand-950 focus-visible:ring-brand-600',
    outline: 'bg-white text-brand-800 border border-line-strong hover:bg-brand-50 hover:border-brand-300 focus-visible:ring-brand-600',
    danger: 'bg-bad text-white border border-bad hover:bg-[#8a1c16] focus-visible:ring-bad',
    text: 'bg-transparent text-brand-700 border border-transparent hover:bg-brand-50 focus-visible:ring-brand-600',
  };

  const sizes = {
    sm: 'h-8 px-2.5 text-[13px]',
    md: 'h-9 px-3.5 text-sm',
    lg: 'h-11 px-5 text-[15px]',
  };

  return (
    <button
      type={type}
      className={clsx(base, variants[variant], sizes[size], className)}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading && <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
};

export const PrimaryButton: React.FC<ButtonProps> = (props) => <Button variant="primary" {...props} />;
export const SecondaryButton: React.FC<ButtonProps> = (props) => <Button variant="secondary" {...props} />;

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  'aria-label': string;
  icon: React.ReactNode;
  size?: 'sm' | 'md';
}

export const IconButton: React.FC<IconButtonProps> = ({ icon, size = 'md', className, ...props }) => (
  <button
    type="button"
    title={props['aria-label']}
    className={clsx(
      'inline-flex items-center justify-center rounded border border-line-strong bg-white text-ink-soft hover:bg-brand-50 hover:text-brand-800 focus-visible:ring-2 focus-visible:ring-brand-600 disabled:opacity-50',
      size === 'sm' ? 'h-8 w-8' : 'h-9 w-9',
      className
    )}
    {...props}
  >
    {icon}
  </button>
);

// ==========================================
// 6. Form fields
// ==========================================

export interface FormFieldProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  helperText?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  htmlFor,
  required = false,
  error,
  helperText,
  children,
  className,
}) => {
  const errorId = htmlFor ? `${htmlFor}-error` : undefined;
  const helperId = htmlFor ? `${htmlFor}-helper` : undefined;
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="field-label">
        {label}
        {required && (
          <>
            <span className="ml-0.5 text-bad" aria-hidden="true">
              *
            </span>
            <span className="sr-only"> (required)</span>
          </>
        )}
      </label>
      {children}
      {error ? (
        <p id={errorId} role="alert" className="field-error flex items-center gap-1">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : helperText ? (
        <p id={helperId} className="field-help">
          {helperText}
        </p>
      ) : null}
    </div>
  );
};

export interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onClear?: () => void;
}

export const SearchInput: React.FC<SearchInputProps> = ({ value, onClear, className, ...props }) => (
  <div className="relative flex w-full items-center">
    <Search className="pointer-events-none absolute left-2.5 h-4 w-4 text-ink-faint" aria-hidden="true" />
    <input type="search" value={value} className={clsx('field-input pl-8 pr-8', className)} {...props} />
    {value && onClear && (
      <button
        type="button"
        onClick={onClear}
        className="absolute right-1.5 rounded p-1 text-ink-faint hover:text-ink"
        aria-label="Clear search"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    )}
  </div>
);

export interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

export const SelectField = React.forwardRef<HTMLSelectElement, SelectFieldProps>(({ options, className, ...props }, ref) => (
  <div className="relative">
    <select ref={ref} className={clsx('field-select cursor-pointer', className)} {...props}>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
    <ChevronDown
      className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
      aria-hidden="true"
    />
  </div>
));
SelectField.displayName = 'SelectField';

export interface FileUploadProps {
  onFilesSelected: (files: FileList) => void;
  accept?: string;
  maxSizeMB?: number;
  label?: string;
  helperText?: string;
  disabled?: boolean;
  multiple?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFilesSelected,
  accept = 'application/pdf,image/png,image/jpeg',
  label = 'Select a file to upload',
  helperText = 'Accepted formats: PDF, JPEG, PNG',
  disabled = false,
  multiple = false,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (!disabled && e.dataTransfer.files && e.dataTransfer.files.length > 0) onFilesSelected(e.dataTransfer.files);
  };

  return (
    <div
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      className={clsx(
        'rounded border border-dashed px-4 py-5 text-center',
        dragActive ? 'border-brand-600 bg-brand-50' : 'border-line-strong bg-[#fafbfc]',
        disabled && 'opacity-60'
      )}
    >
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          if (e.target.files && e.target.files.length) onFilesSelected(e.target.files);
          e.target.value = '';
        }}
      />
      <UploadCloud className="mx-auto mb-1.5 h-6 w-6 text-brand-600" aria-hidden="true" />
      <label htmlFor={id} className={clsx('link cursor-pointer text-sm font-semibold', disabled && 'pointer-events-none')}>
        {label}
      </label>
      <span className="text-sm text-ink-soft"> or drag it here</span>
      <p className="mt-1 text-meta text-ink-faint">{helperText}</p>
    </div>
  );
};

// ==========================================
// 7. Tabs (keyboard accessible)
// ==========================================

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
  idPrefix?: string;
  'aria-label'?: string;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onChange, className, idPrefix = 'tab', ...rest }) => {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: React.KeyboardEvent, idx: number) => {
    let next = idx;
    if (e.key === 'ArrowRight') next = (idx + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (idx - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    else return;
    e.preventDefault();
    onChange(tabs[next].id);
    refs.current[next]?.focus();
  };
  return (
    <div className={clsx('border-b border-line', className)}>
      <div role="tablist" aria-label={rest['aria-label']} className="-mb-px flex gap-0.5 overflow-x-auto">
        {tabs.map((tab, idx) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              ref={(el) => (refs.current[idx] = el)}
              id={`${idPrefix}-${tab.id}`}
              role="tab"
              type="button"
              aria-selected={isActive}
              aria-controls={`${idPrefix}-panel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onChange(tab.id)}
              onKeyDown={(e) => onKey(e, idx)}
              className={clsx(
                'flex shrink-0 items-center gap-1.5 whitespace-nowrap border px-3.5 py-2 text-[13.5px]',
                isActive
                  ? 'rounded-t border-line border-b-white bg-white font-semibold text-brand-900 shadow-[inset_0_3px_0_0_#174a85]'
                  : 'border-transparent text-ink-soft hover:text-brand-800 hover:underline'
              )}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && (
                <span className={clsx('rounded-sm px-1.5 text-[11.5px] tabular-nums', isActive ? 'bg-brand-50 text-brand-800' : 'bg-muted-bg text-ink-soft')}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export const TabPanel: React.FC<{ id: string; active: boolean; idPrefix?: string; children: React.ReactNode; className?: string }> = ({
  id,
  active,
  idPrefix = 'tab',
  children,
  className,
}) =>
  active ? (
    <div role="tabpanel" id={`${idPrefix}-panel-${id}`} aria-labelledby={`${idPrefix}-${id}`} className={className}>
      {children}
    </div>
  ) : null;

// ==========================================
// 8. Filter bar
// ==========================================

export interface ActiveFilterTag {
  id: string;
  label: string;
  onRemove: () => void;
}

export interface FilterBarProps {
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  onSearchClear?: () => void;
  searchPlaceholder?: string;
  searchLabel?: string;
  filtersSlot?: React.ReactNode;
  activeTags?: ActiveFilterTag[];
  onClearAll?: () => void;
  totalCount?: number;
  totalLabel?: string;
  className?: string;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  searchQuery,
  onSearchChange,
  onSearchClear,
  searchPlaceholder = 'Search',
  searchLabel = 'Search',
  filtersSlot,
  activeTags = [],
  onClearAll,
  totalCount,
  totalLabel = 'records',
  className,
}) => {
  const searchId = useId();
  return (
    <div className={clsx('border border-line bg-white px-3 py-2.5 rounded', className)}>
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-end">
        {onSearchChange && (
          <div className="w-full lg:max-w-sm">
            <label htmlFor={searchId} className="field-label">
              {searchLabel}
            </label>
            <SearchInput
              id={searchId}
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onClear={onSearchClear}
            />
          </div>
        )}
        {filtersSlot && <div className="flex flex-wrap items-end gap-2.5">{filtersSlot}</div>}
        {typeof totalCount === 'number' && (
          <div className="text-meta text-ink-soft lg:ml-auto lg:pb-2" aria-live="polite">
            <span className="font-semibold text-ink tabular-nums">{totalCount}</span> {totalLabel}
          </div>
        )}
      </div>
      {activeTags.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-line-soft pt-2 text-meta">
          <span className="text-ink-faint">Filters:</span>
          {activeTags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 rounded-sm border border-line bg-[#f4f6f9] py-0.5 pl-2 pr-1 text-ink"
            >
              {tag.label}
              <button
                type="button"
                onClick={tag.onRemove}
                className="rounded-sm p-0.5 text-ink-faint hover:bg-white hover:text-bad"
                aria-label={`Remove filter: ${tag.label}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {onClearAll && (
            <button type="button" onClick={onClearAll} className="link ml-1 text-meta">
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
};

/** Labelled select for use inside FilterBar. */
export const FilterSelect: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}> = ({ label, value, onChange, options, className }) => {
  const id = useId();
  return (
    <div className={clsx('min-w-[150px]', className)}>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <SelectField id={id} value={value} onChange={(e) => onChange(e.target.value)} options={options} />
    </div>
  );
};

// ==========================================
// 9. Pagination
// ==========================================

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalRecords: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalRecords,
  pageSize,
  onPageChange,
  onPageSizeChange,
  className,
}) => {
  if (totalRecords === 0) return null;
  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalRecords);
  const btn =
    'inline-flex h-8 w-8 items-center justify-center rounded border border-line-strong bg-white text-ink-soft hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-40';
  return (
    <nav
      aria-label="Pagination"
      className={clsx(
        'flex flex-col items-center justify-between gap-2 border-t border-line bg-white px-3 py-2.5 text-meta text-ink-soft sm:flex-row',
        className
      )}
    >
      <p aria-live="polite">
        Showing <span className="font-semibold text-ink tabular-nums">{start}</span>–
        <span className="font-semibold text-ink tabular-nums">{end}</span> of{' '}
        <span className="font-semibold text-ink tabular-nums">{totalRecords}</span>
      </p>
      <div className="flex items-center gap-2">
        {onPageSizeChange && (
          <label className="flex items-center gap-1.5">
            Rows per page
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-8 rounded border border-line-strong bg-white px-1.5 text-meta"
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="flex items-center gap-1">
          <button type="button" className={btn} disabled={currentPage <= 1} onClick={() => onPageChange(1)} aria-label="First page">
            <ChevronsLeft className="h-4 w-4" />
          </button>
          <button type="button" className={btn} disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)} aria-label="Previous page">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="px-2 tabular-nums text-ink">
            Page {currentPage} of {totalPages || 1}
          </span>
          <button type="button" className={btn} disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)} aria-label="Next page">
            <ChevronRight className="h-4 w-4" />
          </button>
          <button type="button" className={btn} disabled={currentPage >= totalPages} onClick={() => onPageChange(totalPages)} aria-label="Last page">
            <ChevronsRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </nav>
  );
};

// ==========================================
// 10. Data table
// ==========================================

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  isLoading?: boolean;
  emptyState?: React.ReactNode;
  className?: string;
  onRowClick?: (item: T) => void;
  caption?: string;
  rowClassName?: (item: T) => string | undefined;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  sortColumn,
  sortDirection,
  onSort,
  isLoading,
  emptyState,
  className,
  onRowClick,
  caption,
  rowClassName,
}: DataTableProps<T>) {
  return (
    <div className={clsx('overflow-x-auto bg-white', className)}>
      <table className="data-table">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((col) => {
              const isSorted = sortColumn === col.key;
              return (
                <th
                  key={col.key}
                  scope="col"
                  className={col.headerClassName}
                  aria-sort={isSorted ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  {col.sortable && onSort ? (
                    <button type="button" onClick={() => onSort(col.key)} className="inline-flex items-center gap-1 hover:underline">
                      {col.header}
                      {isSorted ? (
                        sortDirection === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 opacity-30" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={`sk-${i}`}>
                {columns.map((c) => (
                  <td key={c.key}>
                    <Skeleton className="h-4 w-full max-w-[160px]" />
                  </td>
                ))}
              </tr>
            ))
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="!p-0">
                {emptyState || <p className="p-6 text-center text-ink-soft">No records match the current criteria.</p>}
              </td>
            </tr>
          ) : (
            data.map((item) => (
              <tr
                key={keyExtractor(item)}
                className={clsx(onRowClick && 'row-link cursor-pointer', rowClassName?.(item))}
                onClick={onRowClick ? () => onRowClick(item) : undefined}
              >
                {columns.map((col) => (
                  <td key={col.key} className={col.className}>
                    {col.render ? col.render(item) : String((item as Record<string, unknown>)[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ==========================================
// 11. Panels, notices and summary strips
// ==========================================

export const Panel: React.FC<{
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  as?: 'section' | 'div' | 'aside';
  id?: string;
}> = ({ title, subtitle, actions, children, className, bodyClassName, as = 'section', id }) => {
  const Tag = as as any;
  const headingId = useId();
  return (
    <Tag className={clsx('panel', className)} aria-labelledby={title ? headingId : undefined} id={id}>
      {(title || actions) && (
        <div className="panel-header">
          <div className="min-w-0">
            {title && (
              <h2 id={headingId} className="panel-title">
                {title}
              </h2>
            )}
            {subtitle && <p className="panel-subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={clsx(bodyClassName ?? 'panel-body')}>{children}</div>
    </Tag>
  );
};

export const Notice: React.FC<{
  tone?: 'info' | 'warn' | 'bad' | 'ok' | 'muted';
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  onDismiss?: () => void;
  role?: 'status' | 'alert' | 'note';
}> = ({ tone = 'info', title, children, className, onDismiss, role }) => {
  const Icon = tone === 'ok' ? CheckCircle2 : tone === 'bad' ? AlertCircle : tone === 'warn' ? AlertTriangle : Info;
  const tones = {
    info: 'border-info-line bg-info-bg text-ink',
    warn: 'border-warn-line bg-warn-bg text-ink',
    bad: 'border-bad-line bg-bad-bg text-ink',
    ok: 'border-ok-line bg-ok-bg text-ink',
    muted: 'border-line bg-[#f6f8fa] text-ink',
  };
  const iconTones = { info: 'text-info', warn: 'text-warn', bad: 'text-bad', ok: 'text-ok', muted: 'text-ink-faint' };
  return (
    <div
      role={role ?? (tone === 'bad' ? 'alert' : 'status')}
      className={clsx('flex items-start gap-2.5 rounded border-l-[3px] border px-3 py-2.5 text-sm', tones[tone], className)}
    >
      <Icon className={clsx('mt-0.5 h-4 w-4 shrink-0', iconTones[tone])} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={clsx(title && 'mt-0.5', 'text-ink-soft')}>{children}</div>}
      </div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="rounded p-0.5 text-ink-faint hover:text-ink" aria-label="Dismiss">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

export interface StatItem {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: 'default' | 'bad' | 'warn' | 'ok' | 'info';
  to?: string;
}

/**
 * A single bordered strip of figures separated by rules. Values that the
 * server did not provide should be passed as `undefined` and render as "—".
 */
export const StatStrip: React.FC<{ items: StatItem[]; className?: string; isLoading?: boolean }> = ({
  items,
  className,
  isLoading,
}) => {
  const tones = { default: 'text-brand-900', bad: 'text-bad', warn: 'text-warn', ok: 'text-ok', info: 'text-info' };
  return (
    <dl
      className={clsx(
        'grid grid-cols-2 overflow-hidden rounded border border-line bg-white sm:grid-cols-3',
        ({ 1: 'lg:grid-cols-1', 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4', 5: 'lg:grid-cols-5' } as Record<number, string>)[items.length] ?? 'lg:grid-cols-6',
        className
      )}
    >
      {items.map((item) => {
        const content = (
          <>
            <dt className="text-meta text-ink-soft">{item.label}</dt>
            <dd className={clsx('mt-0.5 text-[22px] font-semibold leading-tight tabular-nums', tones[item.tone ?? 'default'])}>
              {isLoading ? <Skeleton className="h-6 w-12" /> : item.value ?? '—'}
            </dd>
            {item.hint && <dd className="mt-0.5 text-[11.5px] text-ink-faint">{item.hint}</dd>}
          </>
        );
        return (
          <div key={item.label} className="-mb-px -mr-px border-b border-r border-line-soft px-4 py-3">
            {item.to ? (
              <Link to={item.to} className="block hover:underline decoration-brand-200">
                {content}
              </Link>
            ) : (
              content
            )}
          </div>
        );
      })}
    </dl>
  );
};

// ==========================================
// 12. Empty, error, loading states
// ==========================================

export const EmptyState: React.FC<{
  title: string;
  description: React.ReactNode;
  actionText?: string;
  onAction?: () => void;
  className?: string;
  icon?: React.ReactNode;
}> = ({ title, description, actionText, onAction, className, icon }) => (
  <div data-testid="empty-state" className={clsx('px-6 py-10 text-center', className)}>
    <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-muted-bg text-ink-faint">
      {icon ?? <Inbox className="h-5 w-5" aria-hidden="true" />}
    </div>
    <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
    <p className="mx-auto mt-1 max-w-md text-sm text-ink-soft">{description}</p>
    {actionText && onAction && (
      <Button onClick={onAction} variant="primary" size="sm" className="mt-4">
        {actionText}
      </Button>
    )}
  </div>
);

export const ErrorState: React.FC<{
  title?: string;
  message?: string;
  error?: unknown;
  onRetry?: () => void;
  className?: string;
}> = ({ title, message, error, onRetry, className }) => {
  const info = error ? describeApiError(error, message) : undefined;
  return (
    <div data-testid="error-state" role="alert" className={clsx('rounded border border-bad-line bg-bad-bg/60 px-4 py-4', className)}>
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-bad" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-ink">{title ?? info?.title ?? 'This information could not be loaded'}</h3>
          <p className="mt-0.5 text-sm text-ink-soft">{info?.message ?? message ?? 'Please try again.'}</p>
          {(info?.code || info?.requestId) && (
            <p className="mt-1 text-[11.5px] text-ink-faint">
              {info?.code && <>Code: <span className="ident text-[11.5px]">{info.code}</span></>}
              {info?.requestId && <> · Request ID: <span className="ident text-[11.5px]">{info.requestId}</span></>}
            </p>
          )}
          {onRetry && (
            <Button onClick={onRetry} variant="outline" size="sm" className="mt-3">
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Try again
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export const LoadingState: React.FC<{ message?: string; className?: string }> = ({
  message = 'Loading…',
  className,
}) => (
  <div className={clsx('px-6 py-10 text-center text-ink-soft', className)} role="status" aria-live="polite">
    <RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin text-brand-600" aria-hidden="true" />
    <p className="text-sm">{message}</p>
  </div>
);

export const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div data-testid="skeleton" aria-hidden="true" className={clsx('animate-pulse rounded-sm bg-[#e3e8ee]', className)} />
);

/** Full-page loading skeleton used by top-level routes. */
export const PageSkeleton: React.FC<{ rows?: number }> = ({ rows = 2 }) => (
  <div className="page py-6 space-y-4" role="status" aria-label="Loading">
    <Skeleton className="h-3 w-48" />
    <Skeleton className="h-7 w-80" />
    <Skeleton className="h-20 w-full" />
    {Array.from({ length: rows }).map((_, i) => (
      <Skeleton key={i} className="h-56 w-full" />
    ))}
  </div>
);

// ==========================================
// 13. Modal & confirmation dialog (focus-managed)
// ==========================================

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
  description?: string;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer, maxWidth = 'md', description }) => {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastFocus = useRef<Element | null>(null);

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) return;
    lastFocus.current = document.activeElement;
    document.addEventListener('keydown', handleKey);
    const t = setTimeout(() => {
      const el = dialogRef.current?.querySelector<HTMLElement>('[data-autofocus], textarea, input, select, button');
      el?.focus();
    }, 0);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = prevOverflow;
      (lastFocus.current as HTMLElement | null)?.focus?.();
    };
  }, [isOpen, handleKey]);

  if (!isOpen) return null;

  const maxWidths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#0d1b2e]/55 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? `${titleId}-desc` : undefined}
        className={clsx('flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t border border-line bg-white shadow-xl sm:rounded', maxWidths[maxWidth])}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line bg-[#f6f8fa] px-5 py-3">
          <h2 id={titleId} className="text-[15px] font-semibold text-brand-900">
            {title}
          </h2>
          <button onClick={onClose} className="rounded p-1 text-ink-faint hover:bg-white hover:text-ink" aria-label="Close dialog" type="button">
            <X className="h-4 w-4" />
          </button>
        </div>
        {description && (
          <p id={`${titleId}-desc`} className="sr-only">
            {description}
          </p>
        )}
        <div className="flex-1 overflow-y-auto px-5 py-4 text-sm">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-[#f6f8fa] px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
};

export interface ConfirmationDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
  isLoading?: boolean;
  error?: React.ReactNode;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDangerous = false,
  isLoading = false,
  error,
}) => (
  <Modal
    isOpen={isOpen}
    onClose={onCancel}
    title={title}
    footer={
      <>
        <Button variant="outline" size="sm" onClick={onCancel} disabled={isLoading}>
          {cancelText}
        </Button>
        <Button variant={isDangerous ? 'danger' : 'primary'} size="sm" onClick={onConfirm} isLoading={isLoading} data-autofocus>
          {confirmText}
        </Button>
      </>
    }
  >
    <div className="space-y-3">
      <div className="text-ink-soft">{message}</div>
      {error && <Notice tone="bad">{error}</Notice>}
    </div>
  </Modal>
);

// ==========================================
// 14. Footer
// ==========================================

export const AppFooter: React.FC<{ compact?: boolean }> = ({ compact = false }) => (
  <footer className="mt-auto bg-brand-950 text-[13px] text-[#c9d3e0]">
    {!compact && (
      <div className="page grid gap-8 py-8 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <p className="text-[15px] font-semibold text-white">OneCheck</p>
          <p className="mt-2 max-w-md leading-relaxed">
            A decision-support prototype for scrutiny of AICTE Extension of Approval applications: document analysis,
            record reconciliation and evidence-linked findings for review by authorised officers.
          </p>
        </div>
        <div>
          <p className="font-semibold text-white">Portal</p>
          <ul className="mt-2 space-y-1.5">
            <li><Link to="/" className="hover:text-white hover:underline">Home</Link></li>
            <li><a href="/#how-it-works" className="hover:text-white hover:underline">How OneCheck works</a></li>
            <li><a href="/#statuses" className="hover:text-white hover:underline">Verification statuses</a></li>
            <li><Link to="/login" className="hover:text-white hover:underline">Sign in</Link></li>
          </ul>
        </div>
        <div>
          <p className="font-semibold text-white">About this project</p>
          <ul className="mt-2 space-y-1.5">
            <li><a href="/#about" className="hover:text-white hover:underline">Purpose and scope</a></li>
            <li><a href="/#oversight" className="hover:text-white hover:underline">Human oversight</a></li>
            <li><a href="/#disclaimer" className="hover:text-white hover:underline">Disclaimer</a></li>
          </ul>
        </div>
      </div>
    )}
    <div className="border-t border-white/10">
      <div className="page flex flex-col gap-1.5 py-3 text-[12px] text-[#a9b6c7] md:flex-row md:items-center md:justify-between">
        <p>OneCheck · Smart India Hackathon project. Not affiliated with, or endorsed by, AICTE or the Government of India.</p>
        <p>Automated findings are advisory and are for review by authorised officials.</p>
      </div>
    </div>
  </footer>
);
