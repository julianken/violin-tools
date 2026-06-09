// CommandPalette — the §8.5 / §9 keyboard-searchable scale/tool jump modal.
// DESIGN.md §8.5 / §9 / §7.3 / §7.4 / §7.5 / §11.3 / §15.2 win on any conflict
// (AGENTS.md). This is a self-contained chrome surface: open via ⌘K / Ctrl-K or
// the sidebar search trigger, type to filter, arrow through grouped results,
// Enter on a Scales row to set the shared `(root, scale)` (S6) and re-render the
// map, Esc / backdrop to dismiss. It OWNS its motion (S8 disowns the palette
// timelines) via the transitions-dev modal `06` state model, with motion values
// from §7 (palette.css).
//
// Structure mirrors the §9 tree exactly: `.overlay` scrim → `.palette` modal →
// `.psearch` (icon + input + "esc" chip) · `.presults` (grouped listbox) ·
// `.pfoot` (the shortcut legend). The selected row is the shared `{raised}` fill
// for BOTH keyboard selection and pointer hover (§8.5) — no focus ring inside
// the modal.

import { type Root, type ScaleType } from '@violin-tools/theory';
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';

import { IcSearch } from '../../shell/icons.tsx';

import './palette.css';
import { filterGroups, metaGlyph, selectableRows, type PaletteTarget } from './palette-data.ts';
import { type PalettePhase } from './usePaletteController.ts';
import { useRovingListbox } from './useRovingListbox.ts';

interface CommandPaletteProps {
  /** Lifecycle phase from `usePaletteController` (drives `.is-open`/`.is-closing`). */
  phase: PalettePhase;
  /** Begin the close animation (Esc, backdrop click, or a chosen row). */
  onClose: () => void;
  /** Set the shared `(root, scale)` selection when a Scales row is chosen (S6). */
  onSelectScale: (root: Root, scale: ScaleType) => void;
  /**
   * Set the §17.1 view seam when an `open` Tools row is chosen — the Tuner row
   * (`tool:tuner`) opens the Tuner surface, the Scale Map row (`tool:scale-map`)
   * returns to the note map (S18 ph6). Receives the row's stable id.
   */
  onSelectTool: (toolId: string) => void;
}

/**
 * The palette modal. Mounted only while `phase !== 'closed'` (the parent gates
 * mounting on `controller.isMounted`); the `.is-open` / `.is-closing` classes
 * derive from `phase` so the CSS transitions in §7.3/§7.5 run.
 */
export function CommandPalette({
  phase,
  onClose,
  onSelectScale,
  onSelectTool,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const selectedRowRef = useRef<HTMLLIElement | null>(null);

  // The visible groups + the flat selectable list (Scales then live tools,
  // `soon` stubs skipped) — recomputed only when the query changes (§8.5).
  const groups = useMemo(() => filterGroups(query), [query]);
  const rows = useMemo(() => selectableRows(groups), [groups]);
  const hasResults = rows.length > 0 || groups.length > 0;

  // Pre-map each actionable row's id → its index in the flat selectable list, so
  // the render below stays pure (no counter mutation during render). `soon` rows
  // are absent from `rows`, so they get no index and can never be selected (§8.5).
  const rowIndexById = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((row, index) => map.set(row.id, index));
    return map;
  }, [rows]);

  // The query is the roving reset key: a new query re-filters, so selection snaps
  // back to the top match (Enter stays meaningful) (§8.5).
  const roving = useRovingListbox(rows.length, query);
  const { selectedIndex, moveDown, moveUp, setSelectedIndex } = roving;

  // Focus the input on open so the user can type immediately (§9 — the palette
  // is "the primary way to move"). This is a genuine DOM side effect (focus
  // management), not derived state. The query starts empty without a reset here:
  // the parent unmounts the palette when it reaches `closed`, so each fresh open
  // remounts the component with `useState('')` already blank.
  useEffect(() => {
    if (phase === 'open') {
      inputRef.current?.focus();
    }
  }, [phase]);

  // Keep the selected row scrolled into view as ↑/↓ cross the `48vh` viewport.
  // `scrollIntoView` is a browser API absent in jsdom (the test gate) — guard it
  // so the effect is a no-op there rather than throwing (the same guarding the
  // controls' useActiveHighlight applies to ResizeObserver).
  useEffect(() => {
    const row = selectedRowRef.current;
    if (row !== null && typeof row.scrollIntoView === 'function') {
      row.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Activate the selected row: a Scales row sets `(root, scale)`; an `open` Tools
  // row sets the §17.1 view seam (Tuner → the Tuner surface, Scale Map → the note
  // map); both then close. `soon` rows are excluded from `rows`, so Enter can never
  // land on one (§8.5 non-actionable).
  const activate = useCallback(
    (target: PaletteTarget | undefined) => {
      if (target === undefined) return;
      if (target.kind === 'scale') {
        onSelectScale(target.root, target.scale);
      } else if (target.meta === 'open') {
        onSelectTool(target.id);
      }
      onClose();
    },
    [onSelectScale, onSelectTool, onClose],
  );

  // Keyboard inside the modal (§11.3): ↑/↓ rove selection across groups, Enter
  // activates, Esc closes. All other keys (typing) fall through to the input.
  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          moveDown();
          break;
        case 'ArrowUp':
          event.preventDefault();
          moveUp();
          break;
        case 'Enter':
          event.preventDefault();
          activate(rows[selectedIndex]);
          break;
        case 'Escape':
          event.preventDefault();
          onClose();
          break;
        default:
          break;
      }
    },
    [moveDown, moveUp, activate, rows, selectedIndex, onClose],
  );

  // The state class drives the §7.3/§7.5 motion: `.is-open` while open,
  // `.is-closing` while the close animation runs (then the parent unmounts).
  const stateClass = phase === 'open' ? ' is-open' : phase === 'closing' ? ' is-closing' : '';
  const className = `palette${stateClass}`;

  return (
    // The scrim. A click on the backdrop (but not bubbled from the modal) closes
    // the palette (§9). The overlay carries its own opacity timeline (§7.5).
    <div
      className="overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={className}
        role="dialog"
        aria-modal="true"
        aria-label="Scale search"
        onKeyDown={onKeyDown}
      >
        {/* .psearch — leading magnifier + input + "esc" dismiss chip (§9). The
            icon is the shared ic-search glyph, rendered larger and at {text2}
            here per §8.3 (the .psearch .search-ic rule sizes/colors it). */}
        <div className="psearch">
          <span className="psearch-ic" aria-hidden="true">
            <IcSearch />
          </span>
          <input
            ref={inputRef}
            type="text"
            className="pinput"
            aria-label="Search scales and tools"
            placeholder="Search scales and tools"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="esc">esc</kbd>
        </div>

        {/* .presults — the grouped listbox (§8.5/§11.3). max-height 48vh in CSS;
            no rule of its own (the dividers live on .psearch / .pfoot). */}
        <ul className="presults" role="listbox" aria-label="Results">
          {!hasResults && (
            // Empty state (§8.5): a single centered, non-selectable "No matches"
            // line in Inter (NOT Geist Mono), no icon, headers suppressed.
            <li className="pempty" role="presentation">
              No matches
            </li>
          )}

          {groups.map((group) => (
            <li key={group.heading} role="presentation" className="pgroup">
              {/* Group header — mono uppercase spacing only, not ruled (§8.5). */}
              <div className="pgroup-h" aria-hidden="true">
                {group.heading}
              </div>
              <ul className="pgroup-list" role="presentation">
                {group.items.map((item) => {
                  const isSoon = item.meta === 'soon';
                  // The pre-computed flat selectable index (undefined for soon
                  // rows, which are excluded from `rows` and so never selectable).
                  const rowIndex = rowIndexById.get(item.id) ?? -1;
                  const selected = !isSoon && rowIndex === selectedIndex;
                  return (
                    <li
                      key={item.id}
                      ref={selected ? selectedRowRef : null}
                      role="option"
                      aria-selected={selected}
                      aria-disabled={isSoon || undefined}
                      className={`pitem${selected ? ' sel' : ''}${isSoon ? ' soon' : ''}`}
                      onMouseMove={
                        isSoon
                          ? undefined
                          : () => {
                              setSelectedIndex(rowIndex);
                            }
                      }
                      onClick={
                        isSoon
                          ? undefined
                          : () => {
                              activate(item);
                            }
                      }
                    >
                      <span className="pico" aria-hidden="true">
                        {item.glyph}
                      </span>
                      <span className="plabel">{item.label}</span>
                      <span className={`pmeta${isSoon ? ' palette-soon' : ''}`}>
                        {metaGlyph(item.meta)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>

        {/* .pfoot — the shortcut legend (§9). border-top {hairline} in CSS. */}
        <div className="pfoot" aria-hidden="true">
          <span className="pfoot-seg">
            <kbd className="pfoot-key">↑↓</kbd> navigate
          </span>
          <span className="pfoot-seg">
            <kbd className="pfoot-key">↵</kbd> open
          </span>
          <span className="pfoot-seg">
            <kbd className="pfoot-key">⌘K</kbd> toggle
          </span>
        </div>
      </div>
    </div>
  );
}
