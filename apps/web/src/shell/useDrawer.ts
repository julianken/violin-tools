// useDrawer — the mobile navigation drawer's open/close lifecycle and focus
// management (DESIGN.md §10 responsive reflow). DESIGN.md wins on any conflict
// (AGENTS.md). Below the §10 narrow breakpoint the 248px sidebar collapses to an
// off-canvas drawer; this hook owns its STATE (open/closed), its keyboard
// dismissal (Esc), and its focus contract (move focus into the panel on open,
// return it to the trigger on close) — the a11y contract S10 set for any
// off-canvas nav (focus trap-lite + Esc + focus-return + aria-expanded).
//
// Motion model — the transitions-dev panel-reveal (07) technique: the drawer is
// a translateX off-canvas panel whose `data-open` / `.is-open` class drives a
// CSS transform transition (shell.css), with the §7 motion values; NO motion
// library, and the §7.4 `prefers-reduced-motion` guard lives in CSS. Unlike the
// palette (which fully unmounts on close), the drawer panel stays MOUNTED at all
// widths — it IS the desktop sidebar above the breakpoint — so this hook is a
// pure boolean + focus side-effects, not a mount/unmount phase machine.
//
// Focus-return note: we capture the element that had focus when the drawer
// opened (normally the topbar trigger) and restore focus to it on close, so a
// keyboard user is never dumped at the top of the document after dismissing the
// drawer (WAI-ARIA dialog/drawer focus-return practice).

import { useCallback, useEffect, useRef, useState } from 'react';

export interface DrawerController {
  /** `true` while the drawer is open. */
  isOpen: boolean;
  /** Open the drawer (remembers the current focus for focus-return). */
  open: () => void;
  /** Close the drawer (returns focus to the opener). */
  close: () => void;
  /** Toggle open/closed (the topbar trigger calls this). */
  toggle: () => void;
  /**
   * Ref to attach to the drawer panel root. On open, focus moves to it (it is
   * `tabIndex={-1}` so it can receive focus) so the next Tab lands inside the
   * drawer, and AT announces the panel.
   */
  panelRef: React.RefObject<HTMLElement | null>;
}

/**
 * Wire the drawer's open/closed state plus its focus + keyboard contract. Esc
 * closes; opening moves focus into the panel; closing restores focus to whatever
 * was focused when it opened (the trigger). The hook attaches a `keydown`
 * listener only while open, so it never interferes with the rest of the app.
 */
export function useDrawer(): DrawerController {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLElement | null>(null);
  // The element focused when the drawer opened — focus returns here on close.
  const openerRef = useRef<HTMLElement | null>(null);

  const open = useCallback(() => {
    // Remember the opener so focus can return to it on close (focus-return).
    openerRef.current = (document.activeElement as HTMLElement | null) ?? null;
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((current) => {
      if (!current) {
        openerRef.current = (document.activeElement as HTMLElement | null) ?? null;
      }
      return !current;
    });
  }, []);

  // On open: move focus into the panel so the next Tab steps through the drawer
  // and a screen reader announces it. On close: return focus to the opener (the
  // trigger), the WAI-ARIA focus-return contract for a dismissible overlay.
  useEffect(() => {
    if (isOpen) {
      panelRef.current?.focus();
    } else if (openerRef.current !== null) {
      openerRef.current.focus();
      openerRef.current = null;
    }
  }, [isOpen]);

  // Esc closes the drawer (only while open, so it never shadows other Esc
  // handlers — e.g. the command palette's — when the drawer is shut).
  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsOpen(false);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  return { isOpen, open, close, toggle, panelRef };
}
