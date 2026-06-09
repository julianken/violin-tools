// The 52px topbar (DESIGN.md §9 tree, §4.2): a breadcrumb on the left and the
// inert "Share scale" ghost button on the right, space-between. The bar carries
// no own fill — it inherits {canvas} from the body. The breadcrumb's active
// segment is the §13 spelled current selection ("Scales / B♭ Major"), driven
// from real `(root, scale)` state — S14 replaced the hard-coded "A Major" with
// the same `spell()`-derived name the H1 and the map labels use.
//
// S16 Phase 3 (U7) drops the mobile off-canvas drawer. The topbar no longer
// carries the hamburger; instead it carries a MOBILE-ONLY search trigger (the
// `.topbar-search` magnifier) that opens the command palette (`onOpenPalette` →
// palette.open()). It is `display:none` at/above the §10 breakpoint and revealed
// only in the narrow media block (the exact `.topbar-menu` precedent it replaces)
// so it NEVER coexists with the retained sidebar search on desktop — keeping the
// single "Search scales and tools" button at the default desktop viewport (and
// the desktop snapshot byte-stable). It carries a 44px hit target and an
// accessible name so it is keyboard-operable and announced (S10 a11y contract).
//
// §16 — the "Share scale" ghost button is now wired (was inert in v1). It
// consumes `useShareLink` (the call-time adaptive native-share / copy branch);
// the copy branch swaps the label to "Copying…" then shows a `currentColor` ✓
// and an inline `.ghost-status` caption beside the button (NOT a fill, NOT a
// second accent, border never recolored — §8.4). The caption is `aria-hidden`;
// the spoken outcome is the polite `data-live="share"` region in AppShell.

import { IcCheck, IcSearch } from './icons';
import type { ShareLink } from './useShareLink';

interface TopbarProps {
  /**
   * The §13 spelled current selection (e.g. "A Major", "B♭ Major") — the active
   * breadcrumb segment. Comes from `scaleName(controls.state)` in AppShell so it
   * agrees with the H1 and the map labels (one `spell()` engine).
   */
  scaleName: string;
  /**
   * Open the command palette — the mobile top-bar search trigger calls this
   * (§8.3, §9). On desktop the search is CSS-hidden; the sidebar search stays the
   * desktop palette opener.
   */
  onOpenPalette: () => void;
  /**
   * The Share action + its feedback machine (§16, §8.4). `phase` drives the
   * label/check swap, `caption` the inline `.ghost-status` text, `share` the
   * ghost button's click. The announcement is consumed by AppShell's live region.
   */
  shareLink: ShareLink;
}

export function Topbar({ scaleName, onOpenPalette, shareLink }: TopbarProps) {
  const { phase, caption, share } = shareLink;
  // The copy branch swaps the in-button label to "Copying…" while busy (the
  // §04 text-states-swap technique, CSS-driven via .is-busy); every other phase
  // keeps the resting "Share scale" label. The OS share sheet has no busy label —
  // it is its own surface — so only `copying` swaps.
  const busy = phase === 'copying';
  const showCheck = phase === 'copied';

  return (
    <div className="topbar">
      <div className="topbar-left">
        {/* Mobile-only search trigger — CSS-hidden at/above the §10 breakpoint, so
            the desktop topbar is unchanged and the sidebar search stays the sole
            "Search scales and tools" button on desktop. Below the breakpoint this
            opens the command palette. Keyboard-operable + announced: the accessible
            name names the action; a 44px hit target meets WCAG 2.5.5 (shell.css). */}
        <button
          type="button"
          className="topbar-search"
          aria-label="Search scales and tools"
          onClick={onOpenPalette}
        >
          <span className="topbar-search-ic" aria-hidden="true">
            <IcSearch />
          </span>
        </button>

        <nav className="crumb" aria-label="Breadcrumb">
          <span className="crumb-seg">Scales</span>
          <span className="crumb-sep" aria-hidden="true">
            /
          </span>
          <span className="crumb-seg crumb-active" aria-current="page">
            {scaleName}
          </span>
        </nav>
      </div>

      {/* The right cluster groups the ghost button with its inline status caption
          so the topbar's two-end `space-between` is preserved — the `.ghost` was a
          direct child of `.topbar`, and a third child would break the layout. */}
      <div className="topbar-right">
        {/* The ✓ + caption sit BEFORE the button (lead side) so they don't shift
            the button as they appear/revert. Both are aria-hidden — the single
            spoken source is the polite live region in AppShell. */}
        <span className="ghost-status" aria-hidden="true">
          <span
            className="ghost-check"
            data-state={showCheck ? 'in' : 'out'}
          >
            <IcCheck />
          </span>
          <span className="ghost-status-text">{caption}</span>
        </span>
        <button
          type="button"
          className="ghost"
          onClick={share}
          aria-label={busy ? 'Copying link' : 'Share scale'}
        >
          {/* The §04 label swap: one element, two states. The resting label is
              "Share scale"; while busy it reads "Copying…". The blurred swap is
              CSS-driven (.is-busy), never a hand-rolled tween. */}
          <span className="ghost-label" data-busy={busy ? 'true' : 'false'}>
            {busy ? 'Copying…' : 'Share scale'}
          </span>
        </button>
      </div>
    </div>
  );
}
