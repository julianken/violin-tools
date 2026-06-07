// usePaletteController — the command palette's open/close lifecycle and global
// keyboard entry (DESIGN.md §9, §7.3, §7.5). DESIGN.md wins on any conflict
// (AGENTS.md). This owns the palette's OWN motion orchestration — S8 explicitly
// disowns the palette timelines (they belong to this component, §2 of the issue).
//
// State model — the transitions-dev modal `06` recipe, values from §7.3/§7.5:
//   - `phase` is `closed | open | closing`.
//   - Opening sets `phase = 'open'` → the modal carries `.is-open`.
//   - Closing sets `phase = 'closing'` → the modal swaps `.is-open` for
//     `.is-closing`, then a `setTimeout` keyed to the LONGER of the two close
//     durations removes `.is-closing` (back to `closed`, the element unmounts).
//
// MUST-APPLY timing boundary (§7.3/§7.5): the close runs TWO concurrent
// timelines — transform `160ms` (`--modal-out`) and opacity `150ms`
// (`--palette-out`). The cleanup timeout is keyed to the LONGER one, `160ms`
// (`--modal-out`), NOT `150ms`. Keying to 150 would strip `.is-closing` 10ms
// early and snap the element to its resting `scale(.96)` mid-transition. We read
// the live `--modal-out` custom property (falling back to 160) so the timeout
// always tracks the §0 token, never a hand-inlined literal.

import { useCallback, useEffect, useRef, useState } from 'react';

/** The three lifecycle phases (drive `.is-open` / `.is-closing`). */
export type PalettePhase = 'closed' | 'open' | 'closing';

export interface PaletteController {
  /** Current lifecycle phase. */
  phase: PalettePhase;
  /** `true` while the modal is mounted (open OR animating closed). */
  isMounted: boolean;
  /** Open the palette (idempotent; cancels an in-flight close). */
  open: () => void;
  /** Begin the close animation (swaps `.is-open` → `.is-closing`). */
  close: () => void;
}

/**
 * Read the close TRANSFORM duration (`--modal-out`) from `:root` in ms. This is
 * the longer of the two close timelines (transform 160ms vs opacity 150ms), so
 * the cleanup timeout keys to it (the MUST-APPLY boundary above). Falls back to
 * 160 when the var is absent (e.g. jsdom without the stylesheet applied).
 */
function readModalOutMs(): number {
  if (typeof window === 'undefined') return 160;
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--modal-out').trim();
  const parsed = Number.parseFloat(raw); // "160ms" → 160
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 160;
}

/**
 * Wire the palette lifecycle plus the global ⌘K / Ctrl-K toggle (§9). The chord
 * toggles: open when closed/closing, close when open. Returns the phase the
 * component renders from and the `open`/`close` the trigger + Esc/backdrop call.
 */
export function usePaletteController(): PaletteController {
  const [phase, setPhase] = useState<PalettePhase>('closed');
  // Holds the pending `.is-closing` cleanup timer so open() can cancel it.
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseTimer = useCallback(() => {
    if (closeTimer.current !== null) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const open = useCallback(() => {
    // Cancel any in-flight close so re-opening starts cleanly from `.is-open`
    // (the recipe's `classList.remove('is-closing'); add('is-open')`).
    clearCloseTimer();
    setPhase('open');
  }, [clearCloseTimer]);

  const close = useCallback(() => {
    setPhase((current) => {
      if (current !== 'open') return current; // already closed/closing — no-op
      clearCloseTimer();
      // Keyed to the LONGER close duration (`--modal-out`, 160ms) so the scale
      // transform finishes before `.is-closing` is removed (MUST-APPLY).
      closeTimer.current = setTimeout(() => {
        closeTimer.current = null;
        setPhase('closed');
      }, readModalOutMs());
      return 'closing';
    });
  }, [clearCloseTimer]);

  // Global ⌘K / Ctrl-K toggle (§9): the chord opens the palette from anywhere
  // and toggles it closed when open. metaKey covers macOS ⌘; ctrlKey covers
  // Windows/Linux Ctrl. We read the latest phase via the functional updater so
  // the listener never goes stale across renders.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPhase((current) => {
          if (current === 'open') {
            // Toggle closed: same close path (start the `.is-closing` timer).
            clearCloseTimer();
            closeTimer.current = setTimeout(() => {
              closeTimer.current = null;
              setPhase('closed');
            }, readModalOutMs());
            return 'closing';
          }
          // closed OR closing → open (cancel any pending cleanup first).
          clearCloseTimer();
          return 'open';
        });
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [clearCloseTimer]);

  // Clear a pending timer on unmount so it never fires into a gone component.
  useEffect(() => clearCloseTimer, [clearCloseTimer]);

  return {
    phase,
    isMounted: phase !== 'closed',
    open,
    close,
  };
}
