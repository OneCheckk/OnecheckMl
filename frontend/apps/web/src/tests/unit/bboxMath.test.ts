import { describe, it, expect } from 'vitest';
import { calculateBBoxPercentages } from '../../components/evidence/BBoxOverlay';
import type { BBox } from '@contracts';

describe('Evidence Bounding Box Percentage Calculation', () => {
  it('correctly maps [x0, y0, x1, y1] normalized coordinates to percentage CSS properties', () => {
    // Area finding fixture: [0.18, 0.42, 0.52, 0.46]
    const bbox: BBox = [0.18, 0.42, 0.52, 0.46];
    const style = calculateBBoxPercentages(bbox);

    expect(style.left).toBe('18%');
    expect(style.top).toBe('42%');
    // width = (0.52 - 0.18) * 100 = 34%
    expect(parseFloat(style.width)).toBeCloseTo(34, 1);
    // height = (0.46 - 0.42) * 100 = 4%
    expect(parseFloat(style.height)).toBeCloseTo(4, 1);
  });

  it('clamps coordinates cleanly between 0% and 100%', () => {
    const fullPageBBox: BBox = [0, 0, 1, 1];
    const style = calculateBBoxPercentages(fullPageBBox);

    expect(style.left).toBe('0%');
    expect(style.top).toBe('0%');
    expect(style.width).toBe('100%');
    expect(style.height).toBe('100%');
  });
});
