// useView — the single "which tool fills the main panel" seam (S18 ph6, epic #90).
//
// The product is "one subject, no rivals" (DESIGN.md §1 / §17.1): the Tuner is not
// a pane BESIDE the note map but the OTHER value of one view seam — selecting it
// SWAPS the `.main` content, it never splits the layout. There is deliberately NO
// router (§1): the two surfaces are one piece of state, lifted to AppShell exactly
// like `useControls` / `useMapView` / `usePaletteController` already are, so the
// sidebar nav, the command palette, and the topbar title all read and write the
// same source of truth.
//
// `'scale-map'` is the default (the shipped first tool); `'tuner'` is the new
// capstone surface. This is intentionally a plain `useState` — the view is session
// state, not a deep link (the address bar mirrors `(root, scale)`, §16, not the
// active tool), so there is no persistence or URL mirroring here.

import { useState } from 'react';

/** The tool currently filling `.main` (§17.1). `'scale-map'` is the default. */
export type View = 'scale-map' | 'tuner';

/** The view seam's api: the current view plus a setter. */
export interface ViewApi {
  /** The tool currently shown in the main panel (§1 — one subject, no rivals). */
  view: View;
  /** Switch the main panel to a different tool (the nav item / palette row write). */
  setView: (view: View) => void;
}

/**
 * The view seam. Construct once in AppShell and thread `view` into the `.main`
 * branch + the topbar title, and `setView` into the sidebar nav item and the
 * palette Tuner row. Defaults to `'scale-map'` (the shipped tool).
 */
export function useView(initial: View = 'scale-map'): ViewApi {
  const [view, setView] = useState<View>(initial);
  return { view, setView };
}
