import React from 'react';
import clsx from 'clsx';
import type { BBox } from '@contracts';

export interface BBoxPercentageStyle {
  left: string;
  top: string;
  width: string;
  height: string;
}

/**
 * Calculates percentage-based position and dimensions for bounding box overlays.
 * Coordinates are normalized from 0 to 1 with origin at top-left.
 * bbox: [x0, y0, x1, y1]
 */
export function calculateBBoxPercentages(bbox: BBox): BBoxPercentageStyle {
  const [x0, y0, x1, y1] = bbox;
  return {
    left: `${Math.max(0, Math.min(1, x0)) * 100}%`,
    top: `${Math.max(0, Math.min(1, y0)) * 100}%`,
    width: `${Math.max(0, Math.min(1, x1 - x0)) * 100}%`,
    height: `${Math.max(0, Math.min(1, y1 - y0)) * 100}%`,
  };
}

/**
 * True when a bbox carries a usable region. The backend defaults unknown regions
 * to [0,0,1,1] (whole page); such boxes are not drawn so that a page-wide
 * rectangle is never mistaken for a located piece of evidence.
 */
export function isDrawableBBox(bbox?: number[] | null): bbox is BBox {
  if (!Array.isArray(bbox) || bbox.length !== 4 || bbox.some((n) => typeof n !== 'number' || Number.isNaN(n))) return false;
  const [x0, y0, x1, y1] = bbox;
  if (x1 - x0 <= 0 || y1 - y0 <= 0) return false;
  if (x0 === 0 && y0 === 0 && x1 === 1 && y1 === 1) return false;
  return true;
}

interface BBoxOverlayProps {
  bbox: BBox;
  title: string;
  isSelected?: boolean;
  onClick?: () => void;
  className?: string;
  index?: number;
}

export const BBoxOverlay: React.FC<BBoxOverlayProps> = ({ bbox, title, isSelected = false, onClick, className, index }) => {
  const style = calculateBBoxPercentages(bbox);
  return (
    <button
      type="button"
      data-testid="evidence-bbox-overlay"
      aria-label={`Cited evidence region: ${title}`}
      aria-pressed={isSelected}
      title={title}
      onClick={onClick}
      style={style}
      className={clsx(
        'absolute z-20 cursor-pointer border-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-1',
        isSelected ? 'evidence-selected border-bad bg-bad/15' : 'border-warn bg-warn/10 hover:bg-warn/20',
        className
      )}
    >
      {typeof index === 'number' && (
        <span
          aria-hidden="true"
          className={clsx(
            'absolute -left-[2px] -top-[18px] rounded-t-sm px-1 text-[10.5px] font-semibold leading-[16px] text-white',
            isSelected ? 'bg-bad' : 'bg-warn'
          )}
        >
          {index}
        </span>
      )}
      <span className="sr-only">{title}</span>
    </button>
  );
};
