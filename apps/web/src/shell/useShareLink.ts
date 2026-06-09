// useShareLink — the "Share scale" action behind the topbar ghost button
// (DESIGN.md §16 deep-linking, §8.4 ghost button, §2.6 status colors, §11.3 live
// regions). It owns three things and nothing else: the share URL, the CALL-TIME
// adaptive branch (native share vs clipboard copy), and the small status machine
// the button + caption render from.
//
// Announcement honesty (load-bearing — §11.3, AC 7):
//   • share branch — `navigator.share({url})` opens the OS sheet, which owns the
//     outcome. A bare resolve CANNOT confirm a share happened, so we announce
//     NOTHING and show no caption. `AbortError` (the user dismissed the sheet) is
//     a SILENT no-op. A NON-Abort rejection shows the neutral {text2} caption
//     "Couldn't share — link is in the address bar" (the URL is already synced
//     there by AppShell's replaceState, so the fallback is real).
//   • copy branch — `navigator.clipboard.writeText(url)` announces "Link copied
//     to clipboard" via the polite region and shows the ✓ + "Link copied"
//     caption; a rejection shows "Couldn't copy — link is in the address bar".
//
// The ghost button never recolors its border and grows no second accent (§8.4):
// feedback is the in-button label swap + the inline caption beside it, never a
// status-color change ({danger} stays reserved, §2.6).

import { useCallback, useEffect, useRef, useState } from 'react';

/** How long the success/failure feedback persists before reverting to rest. */
const REVERT_MS = 1500;

/**
 * The visual phase the button + caption render from. `copying` is the brief
 * busy state (label → "Copying…", copy branch only — the OS share sheet is its
 * own busy surface). `copied` shows the ✓ + caption; `error` shows the neutral
 * failure caption. `idle` is the resting button with no caption.
 */
export type SharePhase = 'idle' | 'copying' | 'copied' | 'error';

/** What `useShareLink` exposes to the Topbar. */
export interface ShareLink {
  /** The current visual phase (drives the label swap + caption). */
  phase: SharePhase;
  /** The visible caption text for the current phase ('' when idle/copying). */
  caption: string;
  /**
   * The text to ANNOUNCE in the polite `data-live="share"` region. Copy success
   * only — '' for every share-branch outcome and for idle/copying/error, so the
   * share branch never claims an unconfirmable success (§11.3 / AC 7).
   */
  announcement: string;
  /** Activate Share — the call-time adaptive branch. Wired to the ghost button. */
  share: () => void;
}

/**
 * Detect a usable Web Share target AT CALL TIME (never cached at module load).
 * `navigator.canShare` is optional in real browsers (some ship `share` without
 * it) even though the DOM lib types it as required — so we feature-detect it as a
 * function before calling, and a browser with `share()` but no `canShare()` still
 * takes the share branch (the spec's `canShare?.({url}) ?? true` semantics).
 */
function canNativeShare(url: string): boolean {
  const nav: Navigator & { canShare?: (data?: ShareData) => boolean } = navigator;
  if (typeof nav.share !== 'function') return false;
  if (typeof nav.canShare !== 'function') return true;
  return nav.canShare({ url });
}

/**
 * The Share action + its feedback machine. `buildUrl` defaults to the live
 * `window.location.href` (so the already-synced `?r=&s=` deep link is what gets
 * shared); it is injectable for tests. Feature detection runs INSIDE `share()`
 * so the native sheet opens within the user-activation gesture.
 */
export function useShareLink(buildUrl: () => string = () => window.location.href): ShareLink {
  const [phase, setPhase] = useState<SharePhase>('idle');
  const [caption, setCaption] = useState('');
  const [announcement, setAnnouncement] = useState('');
  // A single revert timer; cleared on unmount and before each re-arm so a rapid
  // re-click never leaves a stale timeout to snap a fresh feedback back early.
  const revertRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearRevert = useCallback(() => {
    if (revertRef.current !== null) {
      clearTimeout(revertRef.current);
      revertRef.current = null;
    }
  }, []);

  useEffect(() => clearRevert, [clearRevert]);

  const armRevert = useCallback(() => {
    clearRevert();
    revertRef.current = setTimeout(() => {
      setPhase('idle');
      setCaption('');
      // The announcement is one-shot: blanking it lets the same message
      // re-announce on a later copy (a polite region re-speaks on text change).
      setAnnouncement('');
      revertRef.current = null;
    }, REVERT_MS);
  }, [clearRevert]);

  const share = useCallback(() => {
    const url = buildUrl();

    if (canNativeShare(url)) {
      // Share branch — the OS sheet owns the outcome. Announce NOTHING on a bare
      // resolve; AbortError is silent; a non-Abort rejection shows the caption.
      clearRevert();
      setPhase('idle');
      setCaption('');
      setAnnouncement('');
      navigator.share({ url }).then(
        () => {
          // Resolved: a share MAY have happened, but we cannot confirm it — so
          // no caption and no announcement (AC 7). Intentionally a no-op.
        },
        (err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') return; // silent
          setPhase('error');
          setCaption("Couldn't share — link is in the address bar");
          armRevert();
        },
      );
      return;
    }

    // Copy branch — desktop / unsupported. Busy → success/failure, announced.
    // Guard the API itself: in a context with NEITHER share NOR clipboard (an
    // insecure HTTP origin, or a very old browser) `navigator.clipboard` is
    // undefined, and a bare `.writeText()` would throw synchronously — stranding
    // phase on 'copying' forever (the `.then()` never attaches). The DOM lib types
    // `clipboard` as always-present, so we re-type it optional and feature-detect
    // (mirroring `canNativeShare`), routing an absent clipboard to the same §8.4
    // failure caption the rejection path already shows.
    const nav = navigator as Omit<Navigator, 'clipboard'> & { clipboard?: Clipboard };
    if (typeof nav.clipboard?.writeText !== 'function') {
      setPhase('error');
      setCaption("Couldn't copy — link is in the address bar");
      setAnnouncement('');
      armRevert();
      return;
    }
    setPhase('copying');
    setCaption('');
    setAnnouncement('');
    nav.clipboard.writeText(url).then(
      () => {
        setPhase('copied');
        setCaption('Link copied');
        setAnnouncement('Link copied to clipboard');
        armRevert();
      },
      () => {
        setPhase('error');
        setCaption("Couldn't copy — link is in the address bar");
        setAnnouncement('');
        armRevert();
      },
    );
  }, [buildUrl, clearRevert, armRevert]);

  return { phase, caption, announcement, share };
}
