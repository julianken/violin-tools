// IntonationView — the frame for the Intonation drill surface (C9, intonation epic).
//
// This is the mount point for the Intonation view's child surfaces (C6–C8). It owns
// the `<main id="main">` region — matching TunerView.tsx and Content.tsx — so the
// skip-link target `#main` resolves correctly on the Intonation view (§11.3), with
// no divergent skip-target id needed. The `id="main"` stays on this element because
// the skip-link in AppShell is `href="#main"` whenever `isIntonation` is true.
//
// Contents:
//   - <RunHeader /> — the run summary bar (scale · "2 octaves" · "target n/total").
//     Stubbed with static props (targetIndex=0, targetCount=29) here; real wiring
//     arrives when C5 (useIntonationDrill) is merged and plumbed in.
//   - Three placeholder slots for C6 (drill map), C7 (cents meter), C8 (summary
//     panel). These are intentionally just comments — the C6–C8 components mount
//     here without requiring a file-change to IntonationView when they land.
//
// DESIGN.md §13 voice, §1 "one subject, no rivals", §8.2 active nav treatment all
// govern this view's wiring (enforced by the C9 acceptance criteria).

import { RunHeader } from './RunHeader';

interface IntonationViewProps {
  /**
   * The §13 spelled scale name (e.g. "B♭ Major") — passed from AppShell so this
   * dumb view doesn't need to import controls state directly.
   */
  scaleName: string;
}

/**
 * The Intonation view's mount point. Renders the run header and empty placeholder
 * slots for the drill surfaces (C6–C8). The `useIntonationDrill` hook (C5) will
 * supply the real props when it is merged and wired.
 */
export function IntonationView({ scaleName }: IntonationViewProps) {
  return (
    <main id="main" className="content">
      {/* Run header — scale name · "2 octaves" · "target n/total".
          targetIndex and targetCount are stubbed with placeholder values (0, 29)
          until C5 (useIntonationDrill) is merged and plumbed into AppShell. */}
      <RunHeader scaleName={scaleName} targetIndex={0} targetCount={29} />

      {/* drill map slot — C6 mounts here */}
      {/* cents meter slot — C7 mounts here */}
      {/* summary panel slot — C8 mounts here */}
    </main>
  );
}
