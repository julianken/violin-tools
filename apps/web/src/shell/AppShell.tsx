import { useEffect, useState } from 'react';

import { CommandPalette } from '../components/CommandPalette/CommandPalette';
import { usePaletteController } from '../components/CommandPalette/usePaletteController';
import { describeMap } from '../notemap/describeMap';
import { resolveDensity } from '../notemap/mapView';
import { useMapView } from '../notemap/useMapView';
import {
  buildShareParams,
  parseShareParams,
  scaleName,
  SCALE_DISPLAY_NAME,
} from '../state/controls';
import { useControls } from '../state/useControls';
import { useView } from '../state/useView';
import { TunerView } from '../tuner/TunerView';

import { Content } from './Content';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useShareLink } from './useShareLink';

// §16 deep-linking — resolve the deep-linked `(root, scale)` ONCE, before the
// first render, from the live query. Computed at module-eval-free call time so
// jsdom (no real `?r=&s=`) yields the A/major default. This precedes the
// sync-effect's first run, so a deep-linked URL is applied — then written back
// identically — never clobbered (AC 4).
const initialSelection =
  typeof window === 'undefined' ? undefined : parseShareParams(window.location.search);

// The §9 app shell: a flex row of `.side` (the fixed rail) and `.main` (the
// fluid column). The DOM matches the §9 tree exactly — `.app` → `.side` /
// `.main`, with `.main` → `.topbar` / `.content` (DESIGN.md §9). No CSS grid is
// used anywhere in the layout (§4); the only `inline-grid` in the product is the
// theme toggle's single-glyph icon slot (`.t-icon-swap`, see shell.css).
//
// S9 wires the command palette here, where the sidebar trigger and the modal can
// share one controller, and where the single `(root, scale, refs)` state (lifted
// from Content) is reachable by BOTH the controls card and the palette: choosing
// a Scales row sets `(root, scale)` and the note map re-renders from the same
// state (§9). The palette overlay is a sibling of `.app` so its `z-index 50`
// scrim sits above the whole shell (§9 tree, §7.3).

export function AppShell() {
  // The single app state every control AND the palette writes; the map renders
  // from it (§9.1). Lifted to the shell so the palette (a sidebar/global surface)
  // and the controls card (in Content) drive one source of truth. The optional
  // `initialSelection` seeds it from a `?r=&s=` deep link (§16, parse-on-init).
  const controls = useControls(initialSelection);
  // §12.1 — the resolved note-map view. useMapView reads matchMedia at first paint
  // (no flash), so `mapView.orientation` is already concrete ('horizontal' on a
  // desktop-like landscape viewport, 'vertical' on portrait/mobile — and 'vertical'
  // under jsdom, which has no matchMedia). Density flows through `resolveDensity`
  // (the U1 policy): an explicit stored 'fit'/'comfort' persists and WINS, while
  // the default 'auto' derives from the resolved orientation — horizontal → 'fit'
  // (the byte-identical §12.1 desktop neck), vertical → 'comfort' (the wider mobile
  // neck). The result is a `ResolvedDensity` (never 'auto'), so the render path is
  // type-safe (U1) and a manual setDensity now reaches the board. We pass the
  // RESOLVED orientation (never mapView.mode, which can be 'auto' that axisOf
  // rejects and dotCenter needs resolved). The resolved {orientation, handedness,
  // density} flows into <Content>, which forwards the SAME config to the board
  // <svg> and <NoteMap> so the parent box and the dot centers never disagree.
  const mapView = useMapView();
  const density = resolveDensity(mapView.density, mapView.orientation);
  // The palette open/close lifecycle + the global ⌘K / Ctrl-K toggle (§9).
  const palette = usePaletteController();
  // §17.1 — the view seam: which tool fills `.main`. "One subject, no rivals" (§1):
  // the Tuner is the OTHER value of this seam, not a pane beside the note map. No
  // router — it's plain lifted state like the three above. Selecting Tuner (the
  // sidebar nav item or the palette row) sets `view='tuner'`; the `.main` content,
  // the topbar title, and the skip-link target all branch on it.
  const { view, setView } = useView();
  const isTuner = view === 'tuner';

  // §11.3 polite live regions: one announces the current sounding note name
  // (Enter/Space over a map marker), one carries the string-by-string map text
  // description, refreshed whenever (root, scale) changes, and a third (§16,
  // below) carries the Share-scale copy outcome. All live in EXTERNAL DOM
  // elements (not the SVG), as §11.3 requires — SVG `<desc>` doesn't update
  // reliably across screen-reader/browser pairs.
  const [soundingNote, setSoundingNote] = useState('');
  const mapDescription = describeMap(
    controls.state.root,
    controls.state.scale,
    SCALE_DISPLAY_NAME[controls.state.scale],
  );

  // §16 deep-linking — mirror the current scale in the address bar so the URL is
  // always a shareable deep link. Keyed PRECISELY on (root, scale): a `refs`
  // toggle (or a View-pref change) does NOT rewrite the URL (AC 3). We merge into
  // the LIVE `window.location.search` (buildShareParams upserts r/s), so a
  // pre-existing `?motion=` survives — it is read every render by Content's
  // `resolveMotionBuild`, and a fresh write would drop it and flip the motion
  // build (this is what keeps the e2e motion specs green). `replaceState`, not
  // `pushState`: selection is state, not navigation — Back never walks a
  // scale-clicking session. The first run writes the already-applied (possibly
  // deep-linked) state back identically, so it never clobbers the initial URL.
  const { root, scale } = controls.state;
  useEffect(() => {
    const params = buildShareParams(window.location.search, { root, scale });
    const query = params.toString();
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}?${query}${window.location.hash}`,
    );
  }, [root, scale]);

  // §16 / §8.4 — the "Share scale" action behind the topbar ghost button: the
  // call-time adaptive native-share / copy branch + its feedback machine. The
  // announcement (copy-success only) feeds the third §11.3 polite live region
  // below; the rest (phase/caption/share) drives the button + its inline caption.
  const shareLink = useShareLink();

  return (
    <div className="app">
      {/* Skip link to the main slot (DESIGN.md §11.3). Visually hidden until
          focused; S10 styles the {mint} :focus-visible ring (§8). View-aware
          (§17.1): on the note-map view it lands the SVG board group (`#board`); on
          the Tuner view the board doesn't exist, so it lands the `.main` content
          region (`#main`, which both surfaces render). */}
      <a className="skip-link" href={isTuner ? '#main' : '#board'}>
        {isTuner ? 'Skip to tuner' : 'Skip to note map'}
      </a>
      <Sidebar onOpenPalette={palette.open} view={view} onSelectView={setView} />
      <div className="main">
        {/* The breadcrumb's active segment is the §13 spelled selection (note-map
            view) or the tool name (Tuner view), shared with the H1 via the same
            seam. The topbar also carries the mobile-only search trigger that opens
            the palette (§8.3, §10); the desktop topbar is unchanged. */}
        <Topbar
          scaleName={isTuner ? 'Tuner' : scaleName(controls.state)}
          onOpenPalette={palette.open}
          shareLink={shareLink}
        />
        {/* §17.1 — the view branch: the existing scale-map <Content> vs the new
            <TunerView>. "One subject, no rivals" (§1) — one of the two fills
            `.main`, never both. */}
        {isTuner ? (
          <TunerView />
        ) : (
          <Content
            controls={controls}
            mapView={mapView}
            orientation={mapView.orientation}
            handedness={mapView.handedness}
            density={density}
            onSoundNote={setSoundingNote}
          />
        )}
      </div>

      {/* §11.3 live regions — both `polite`, never `assertive`. Visually hidden
          (`.sr-only`) but read by assistive tech. The sounding region speaks the
          last sounded note; the description region re-reads the scale layout. */}
      <div className="sr-only" aria-live="polite" data-live="sounding">
        {soundingNote === '' ? '' : `Sounding ${soundingNote}`}
      </div>
      <div className="sr-only" aria-live="polite" data-live="map-description">
        {mapDescription}
      </div>
      {/* §11.3 third polite live region (§16 Share scale): the COPY branch's
          single spoken outcome ("Link copied to clipboard"). It stays '' for
          every share-branch result — a bare `navigator.share()` resolve cannot
          confirm a share, and an AbortError is silent — so this never claims an
          unconfirmable success. The visible `.ghost-status` caption is
          aria-hidden, making this the single spoken source for the action. */}
      <div className="sr-only" aria-live="polite" data-live="share">
        {shareLink.announcement}
      </div>

      {/* The command palette overlay — mounted only while open or animating
          closed (the `.is-open`/`.is-closing` lifecycle, §7.3/§7.5). Choosing a
          Scales row sets `(root, scale)` on the shared state and closes (§9). */}
      {palette.isMounted && (
        <CommandPalette
          phase={palette.phase}
          onClose={palette.close}
          onSelectScale={(root, scale) => {
            controls.selectRoot(root);
            controls.selectScale(scale);
            // Choosing a Scales row jumps to (or stays on) the note-map view (§17.1)
            // — a scale jump implies the Scales tool. The palette then closes.
            setView('scale-map');
          }}
          // §17.1 — a Tools row sets the view seam: the Tuner row opens the Tuner
          // surface; the live Scale Map row returns to the note map. The palette
          // closes after either (handled in CommandPalette).
          onSelectTool={(toolId) => {
            if (toolId === 'tool:tuner') setView('tuner');
            else if (toolId === 'tool:scale-map') setView('scale-map');
          }}
        />
      )}
    </div>
  );
}
