import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { type MapViewApi } from '../notemap/useMapView.ts';
import { useControls } from '../state/useControls.ts';

import { MobileControls } from './MobileControls.tsx';

// MobileControls — the §10/§16 mobile controls surface: a one-tap SUMMARY BAR that
// opens a NON-MODAL bottom sheet (peek→expand) hosting the Root 4×3 grid + Scale +
// Refs + View rows. Tested IN ISOLATION (FINDING 3): jsdom applies no CSS media
// queries (and so no display:none-from-media), so the desktop card vs. mobile sheet
// can't be CSS-toggled apart. Mounting MobileControls ALONE keeps role queries
// unambiguous — the only radiogroups in the document are this surface's.
//
// The sheet's scrollable content region uses an INLINE display:none while closed
// (the U6 CSS transform is keyed off data-open separately) — jsdom DOES reflect an
// inline display:none into getComputedStyle, so dom-testing-library excludes the
// closed sheet's rows from the a11y tree exactly as it would in a browser. That is
// why "clicking reveals the rows" is a real assertion here, not a CSS no-op.

// A complete MapViewApi stub with spied setters (the View row only needs the
// stored modes + the setters; the sheet itself drives open/close via useDrawer).
function stubMapView(overrides: Partial<MapViewApi> = {}): MapViewApi {
  return {
    mode: 'auto',
    orientation: 'vertical',
    density: 'auto',
    handedness: 'right',
    setOrientation: vi.fn(),
    setDensity: vi.fn(),
    setHandedness: vi.fn(),
    ...overrides,
  };
}

// Render MobileControls with the REAL controls api (the integration seam the rows
// write) so the Root/Scale/Refs rows are genuinely wired, plus a stub mapView.
function MobileControlsHarness(props: { summaryText?: string; orientation?: 'horizontal' | 'vertical' }) {
  const controls = useControls();
  return (
    <MobileControls
      controls={controls}
      mapView={stubMapView()}
      orientation={props.orientation ?? 'vertical'}
      summaryText={props.summaryText ?? 'A Major'}
    />
  );
}

// The sheet container (the element whose id the summary bar's aria-controls points
// at) — scope sheet-internal role queries to it so they are unambiguous.
function sheet(): HTMLElement {
  const trigger = screen.getByRole('button', { name: /^scale controls:/i });
  const sheetId = trigger.getAttribute('aria-controls');
  if (sheetId === null) throw new Error('summary trigger has no aria-controls');
  const el = document.getElementById(sheetId);
  if (el === null) throw new Error(`no sheet with id ${sheetId}`);
  return el;
}

describe('MobileControls — summary bar trigger (§10/§16)', () => {
  it('shows the summary text and is collapsed (aria-expanded=false) initially', () => {
    render(<MobileControlsHarness summaryText="A Major · Tapes" />);
    const trigger = screen.getByRole('button', { name: /^scale controls:/i });
    expect(trigger).toHaveTextContent('A Major · Tapes');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    // The trigger controls the sheet by id.
    expect(trigger.getAttribute('aria-controls')).toBe(sheet().id);
  });

  it('does not expose the sheet rows while collapsed (closed content is out of the a11y tree)', () => {
    render(<MobileControlsHarness />);
    // Closed: the inline display:none on the content region excludes every row.
    expect(within(sheet()).queryByRole('radiogroup', { name: 'Root note' })).toBeNull();
    expect(within(sheet()).queryByRole('radiogroup', { name: 'Scale type' })).toBeNull();
    expect(within(sheet()).queryByRole('group', { name: 'Reference layers' })).toBeNull();
  });
});

describe('MobileControls — open reveals the rows (peek→expand)', () => {
  it('clicking the summary bar expands it and reveals Root, Scale, Refs, and the three View rows', () => {
    render(<MobileControlsHarness />);
    const trigger = screen.getByRole('button', { name: /^scale controls:/i });
    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const region = sheet();
    // The four controls rows, in the §9.1 order, scoped to the sheet (unambiguous).
    expect(within(region).getByRole('radiogroup', { name: 'Root note' })).toBeInTheDocument();
    expect(within(region).getByRole('radiogroup', { name: 'Scale type' })).toBeInTheDocument();
    expect(within(region).getByRole('group', { name: 'Reference layers' })).toBeInTheDocument();
    // The View row's three segmented radiogroups join the sheet on mobile.
    expect(within(region).getByRole('radiogroup', { name: 'Orientation' })).toBeInTheDocument();
    expect(within(region).getByRole('radiogroup', { name: 'Density' })).toBeInTheDocument();
    expect(within(region).getByRole('radiogroup', { name: 'Handedness' })).toBeInTheDocument();
  });

  it('renders the Root grid as the SAME radiogroup (one Root note radiogroup, 12 radios)', () => {
    render(<MobileControlsHarness />);
    fireEvent.click(screen.getByRole('button', { name: /^scale controls:/i }));
    const rootGroup = within(sheet()).getByRole('radiogroup', { name: 'Root note' });
    expect(within(rootGroup).getAllByRole('radio')).toHaveLength(12);
  });
});

describe('MobileControls — dismissal (useDrawer contract, non-modal)', () => {
  it('Escape closes the sheet and returns focus to the summary trigger', () => {
    render(<MobileControlsHarness />);
    const trigger = screen.getByRole('button', { name: /^scale controls:/i });
    act(() => {
      trigger.focus();
    });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    // useDrawer focus-return: focus lands back on the opener (the summary trigger).
    expect(document.activeElement).toBe(trigger);
  });

  it('the explicit close button closes the sheet', () => {
    render(<MobileControlsHarness />);
    const trigger = screen.getByRole('button', { name: /^scale controls:/i });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    // The close button lives inside the sheet (visible once expanded).
    fireEvent.click(within(sheet()).getByRole('button', { name: /close/i }));
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('is NON-MODAL: no role=dialog / aria-modal, and never locks body scroll', () => {
    render(<MobileControlsHarness />);
    // Non-modal: the sheet is not a dialog and carries no aria-modal.
    expect(sheet().getAttribute('role')).not.toBe('dialog');
    expect(sheet().getAttribute('aria-modal')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();

    // Opening must not impose a body-scroll lock (no body-scroll-lock, per useDrawer).
    fireEvent.click(screen.getByRole('button', { name: /^scale controls:/i }));
    expect(document.body.style.overflow).toBe('');
  });
});
