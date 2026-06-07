import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { NoteMapLegend } from './NoteMapLegend';

// The §12.4 legend is the always-present key: all five swatches render even
// though two of them (beginner tape, landmark) point at S7 overlays not yet
// built (§7.5 "static, always rendered").
describe('NoteMapLegend (§12.4)', () => {
  it('renders all five swatch labels', () => {
    const { container } = render(<NoteMapLegend />);
    const labels = Array.from(container.querySelectorAll('.legend-label')).map(
      (el) => el.textContent,
    );
    expect(labels).toEqual([
      'root',
      'in scale',
      'not in scale',
      'beginner tape',
      'landmark',
    ]);
  });

  it('renders a swatch element per item with its shape class', () => {
    const { container } = render(<NoteMapLegend />);
    expect(container.querySelectorAll('.legend-swatch')).toHaveLength(5);
    for (const shape of [
      'lg-root',
      'lg-scale',
      'lg-off',
      'lg-tape',
      'lg-landmark',
    ]) {
      expect(container.querySelector(`.${shape}`)).not.toBeNull();
    }
  });
});
