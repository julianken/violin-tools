// ViewRow — the §16 View row: three labeled segmented controls (Orientation ·
// Density · Handedness) wired to the useMapView setters. DESIGN.md §10/§16 win on
// any conflict (AGENTS.md).
//
// Mounted in BOTH the mobile sheet and the desktop controls card (the desktop View
// row shipped in S16 ph4 — the same component, no desktop-only variant). Each
// control is a `role="radiogroup"` of
// `role="radio"` `.pill`s with the SAME roving-tabindex + arrow-key
// keyboard contract the Root/Scale rows use (useRovingRadiogroup — §9.1 / §11.3,
// no new custom a11y). The active segment reflects the user's STORED choice, not
// the resolved value: Orientation highlights `mapView.mode` ('auto' stays selected
// even when it resolved to 'vertical'), Density highlights `mapView.density`, and
// Handedness highlights `mapView.handedness`. Clicking a segment calls the matching
// hook setter, which persists + re-resolves for free (persistence + the auto
// override live in useMapView/mapView, U1/U2). Density renders the full tri-state
// (Auto/Fit/Comfort) so it mirrors orientation's Auto/Vertical/Horizontal and the
// §16 reconciliation is honest about the auto default.

import { useId } from 'react';

import {
  type Density,
  type Handedness,
  type OrientationMode,
} from '../notemap/mapView.ts';
import { type MapViewApi } from '../notemap/useMapView.ts';

import { useRovingRadiogroup } from './useRovingRadiogroup.ts';

interface ViewRowProps {
  /** The whole map-view api — the View row reads the stored modes + calls setters. */
  mapView: MapViewApi;
}

// One captioned segmented control (S17): a `.view-subrow` pairing a VISIBLE caption
// (`label`) with a `role="radiogroup"` `.pill-track` of `role="radio"` `.pill`s. The
// radiogroup is named by the caption via `aria-labelledby` (not a hidden `aria-label`)
// so sighted and AT users get the SAME name — the shipped build named the group only
// via `aria-label`, leaving three unlabeled tracks (two reading "Auto") with nothing
// to tell Orientation from Density from Handedness. The pill matching `selected`
// carries aria-checked=true + the `.is-active` highlight class; a click invokes
// `onSelect`. Reuses the existing `.pill-track` / `.pill` primitives.
//
// The §9.1 / §11.3 radiogroup keyboard contract is shared with the Root/Scale rows
// via useRovingRadiogroup: a roving tabindex (exactly one pill — the selected one —
// is tabbable), arrow keys move selection in the left-to-right option order with
// selection-following-focus, Home/End jump to the ends, Tab exits the group. No
// active-highlight tween here (the View segments use the static `.is-active` class,
// not the sliding `.pill-highlight` element the single-select Root/Scale rows do).
function Segmented<T extends string>({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  selected: T;
  onSelect: (value: T) => void;
}) {
  const captionId = useId();
  const values = options.map((option) => option.value);
  const { isSelected, tabIndexFor, registerPill, onKeyDown } = useRovingRadiogroup(
    values,
    selected,
    onSelect,
  );
  return (
    <div className="view-subrow">
      <span className="view-cap" id={captionId}>
        {label}
      </span>
      <div className="pill-track" role="radiogroup" aria-labelledby={captionId}>
        {options.map(({ value, label: optionLabel }, index) => {
          const active = isSelected(value);
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={tabIndexFor(value)}
              ref={registerPill(index)}
              className={`pill${active ? ' is-active' : ''}`}
              onClick={() => {
                onSelect(value);
              }}
              onKeyDown={onKeyDown}
            >
              {optionLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const ORIENTATION_OPTIONS: readonly { value: OrientationMode; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'vertical', label: 'Vertical' },
  { value: 'horizontal', label: 'Horizontal' },
];

const DENSITY_OPTIONS: readonly { value: Density; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'fit', label: 'Fit' },
  { value: 'comfort', label: 'Comfort' },
];

const HANDEDNESS_OPTIONS: readonly { value: Handedness; label: string }[] = [
  { value: 'right', label: 'Right' },
  { value: 'left', label: 'Left' },
];

// The three captioned controls stack as `.view-subrow`s inside `.view-rows`, which
// owns the inter-control gap (the §4.2 controls rhythm) — the shipped build dropped
// them as a bare fragment into the `.ctrl-slot`, so the tracks butted together with
// no gap. The outer `View` `.lab` + `.ctrl-row` wrapper (Controls / MobileControls)
// is unchanged, so the group still aligns with the Root/Scale/Refs rows.
export function ViewRow({ mapView }: ViewRowProps) {
  return (
    <div className="view-rows">
      <Segmented
        label="Orientation"
        options={ORIENTATION_OPTIONS}
        selected={mapView.mode}
        onSelect={mapView.setOrientation}
      />
      <Segmented
        label="Density"
        options={DENSITY_OPTIONS}
        selected={mapView.density}
        onSelect={mapView.setDensity}
      />
      <Segmented
        label="Handedness"
        options={HANDEDNESS_OPTIONS}
        selected={mapView.handedness}
        onSelect={mapView.setHandedness}
      />
    </div>
  );
}
