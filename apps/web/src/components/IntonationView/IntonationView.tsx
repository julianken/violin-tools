// IntonationView — the Intonation drill surface (C11, #172).
//
// Wires useIntonationDrill into a working three-state drill surface:
//   idle/start · running · complete
// following DESIGN.md §18 and the TunerView.tsx pattern.
//
// The view owns the <main id="main"> region — the skip-link target #main resolves
// correctly on the Intonation view (§11.3 / §18.9).
//
// Three states: §18.1
//   - idle: permission states (unsupported / denied / idle / requesting) + Start affordance
//   - running: DrillMap + DrillMeter + RunHeader with real props
//   - complete: DrillSummary with Run again / New scale actions
//
// DESIGN.md §18 wins on any conflict (AGENTS.md). No red anywhere (§18.7).
// Reduced-motion honored by the child components (§18.8). aria-live announcer §18.9.

import { spell } from '@violin-tools/theory';
import { useEffect, useMemo, useRef, useState } from 'react';

import { DrillMap } from '../../intonation/DrillMap';
import { DrillMeter } from '../../intonation/DrillMeter';
import { DrillSummary } from '../../intonation/DrillSummary';
import type { DrillDot } from '../../intonation/drillTypes';
import type { NoteResult as SummaryNoteResult } from '../../intonation/intonation.types';
import { useIntonationDrill } from '../../intonation/useIntonationDrill';
import { axisOf } from '../../notemap/geometry';
import type { Handedness, Orientation, ResolvedDensity } from '../../notemap/mapView';
import type { MotionBuild } from '../../notemap/motion';
import type { ControlsApi } from '../../state/useControls';
import { useTuner } from '../../tuner/useTuner';

import { RunHeader } from './RunHeader';
import { buildDrillDots } from './drillDots';

// ── Motion build — mirrors the helper in Content.tsx (§7.1/§7.2) ──────────────
/** Resolve the §7 motion build from the query string; SSR-safe. */
function resolveMotionBuild(): MotionBuild {
  if (typeof window === 'undefined') return 'stateful';
  return new URLSearchParams(window.location.search).get('motion') === 'snappy'
    ? 'snappy'
    : 'stateful';
}

// ── ±5¢ in-tune threshold — §18.3 / AC6 ───────────────────────────────────────
/** The ±5¢ threshold for the in-tune state (§18.3). Shared only within C11 scope. */
const IN_TUNE_CENTS = 5;

// ── Settle heuristic constants (§18.9 / AC11) ─────────────────────────────────
/**
 * Number of consecutive frames where |liveCents| ≤ IN_TUNE_CENTS before we
 * consider the pitch "settled" and fire the note-settle announcement.
 * 8 frames ≈ 133ms at 60fps — long enough to confirm intent without lag.
 */
const SETTLE_FRAMES = 8;

/** Announcer debounce — §18.9 "~1.5–2s" matching §17.9 ANNOUNCE_DEBOUNCE_MS. */
const ANNOUNCE_DEBOUNCE_MS = 1800;

// ── Props ──────────────────────────────────────────────────────────────────────

export interface IntonationViewProps {
  /** The §13 spelled scale name (e.g. "B♭ Major") — passed from AppShell. */
  scaleName: string;
  /** The controls API — provides state.root / state.scale for spell derivation. */
  controls: ControlsApi;
  /** Map display config — orientation / handedness / density for DrillMap. */
  orientation: Orientation;
  handedness: Handedness;
  density: ResolvedDensity;
  /**
   * Navigate to a different view — used by DrillSummary's "New scale" action
   * to return the player to the scale-map view.
   */
  setView: (view: 'scale-map' | 'tuner' | 'intonation') => void;
}

// ── View component ────────────────────────────────────────────────────────────

/**
 * The Intonation drill view. Owns useIntonationDrill, branches on drillState.phase,
 * and renders the §18 three-state surface.
 */
export function IntonationView({
  scaleName,
  controls,
  orientation,
  handedness,
  density,
  setView,
}: IntonationViewProps) {
  // IntonationView self-owns the tuner (same pattern as TunerView self-owning
  // useTuner). The view seam is exclusive — TunerView and IntonationView are
  // never simultaneously active — so two independent useTuner instances do not
  // race for the mic. Each view's hook cleans up on unmount.
  const tuner = useTuner();
  const drillState = useIntonationDrill(controls, tuner);
  const { phase, tunerStatus, plan, currentTargetIndex, results, liveCents, startDrill, resetDrill } = drillState;

  // ── §12.1 layout (viewBox) + §7 motion build ──────────────────────────────
  // Mirrors the Content.tsx pattern: axisOf gives the coordinate space the
  // DrillMap dots are drawn in; the SVG must declare the same viewBox or the
  // 760-wide chrome renders into the SVG default 300×150 viewport (clipped).
  // resolveMotionBuild is cheap (URL read) but stable within a render cycle.
  const layout = useMemo(
    () => axisOf({ orientation, handedness, density }),
    [orientation, handedness, density],
  );
  const motion = resolveMotionBuild();

  // ── inTune derivation — §18.3 ±5¢ rule (AC6) ─────────────────────────────
  const inTune = liveCents !== null && Math.abs(liveCents) <= IN_TUNE_CENTS;

  // ── targetLetter derivation — spell from theory, NOT plan[i].letter (AC6) ─
  // DrillTarget has no .letter field; derive via spell(midiNote % 12, root, scale)
  // as specified in §R5. Guard for out-of-bounds index at phase transitions.
  const { root, scale } = controls.state;
  const currentTarget = plan[currentTargetIndex];
  const targetLetter =
    currentTarget !== undefined
      ? spell(currentTarget.midiNote % 12, root, scale)
      : '';

  // ── DrillDot mapper — plan + results → DrillDot[] (AC5 / §R3) ─────────────
  const dots = buildDrillDots(plan, results, currentTargetIndex, root, scale);

  // ── runLabel for DrillSummary ─────────────────────────────────────────────
  // Clamp the 1-based ordinal to plan.length: at completion the tracker's terminal
  // state is currentTargetIndex === plan.length, which would otherwise render an
  // out-of-range "target 30/29" in DrillSummary's header (#177). The tracker's
  // terminal index is legitimate; this is a display-layer clamp.
  const runLabel = `${scaleName} · 2 octaves · target ${String(Math.min(currentTargetIndex + 1, plan.length))}/${String(plan.length)}`;

  return (
    <main id="main" className="content">
      {/* §9-tree page title (kicker · toolhead › H1), the same block every view
          opens with — Content.tsx (scale map) and TunerView (§17). It renders in
          all three phases so the Intonation surface carries a page title like the
          others, not just the Topbar breadcrumb. The interval-formula slot stays
          empty (§18 has no formula). */}
      <div className="kicker">Intonation</div>
      <div className="toolhead">
        <h1 className="h1">Intonation drill</h1>
        <div className="formula" />
      </div>

      {/* §18.9 aria-live announcer — present only when the Intonation view is
          active; exists EMPTY at mount so the first announcement is heard.
          data-live="intonation" scopes it away from the tuner/share live regions. */}
      <IntonationAnnouncer
        phase={phase}
        currentTargetIndex={currentTargetIndex}
        planLength={plan.length}
        targetLetter={targetLetter}
        liveCents={liveCents}
      />

      {phase === 'idle' && (
        <IdleState
          tunerStatus={tunerStatus}
          onStart={() => {
            void startDrill();
          }}
        />
      )}

      {phase === 'running' && (
        <RunningState
          scaleName={scaleName}
          targetIndex={currentTargetIndex}
          targetCount={plan.length}
          dots={dots}
          orientation={orientation}
          handedness={handedness}
          density={density}
          viewBox={layout.viewBox}
          motion={motion}
          liveCents={liveCents}
          inTune={inTune}
          targetLetter={targetLetter}
        />
      )}

      {phase === 'complete' && (
        <DrillSummary
          results={normalizeSummaryResults(results)}
          plan={plan}
          runLabel={runLabel}
          onRunAgain={resetDrill}
          onNewScale={() => {
            setView('scale-map');
          }}
        />
      )}
    </main>
  );
}

// ── Idle states ───────────────────────────────────────────────────────────────

/** Idle/start state — all four permission branches (§18.1 / §17.6 pattern). */
function IdleState({
  tunerStatus,
  onStart,
}: {
  tunerStatus: string;
  onStart: () => void;
}) {
  if (tunerStatus === 'unsupported') {
    return <UnsupportedState />;
  }
  if (tunerStatus === 'denied') {
    return <DeniedState />;
  }
  // idle or requesting — show the Start affordance
  return (
    <StartState
      onStart={onStart}
      requesting={tunerStatus === 'requesting'}
    />
  );
}

/** Unsupported (AC2): no Start control, a graceful message. */
function UnsupportedState() {
  return (
    <section className="tuner-panel tuner-unsupported" aria-label="Tuner unavailable">
      <div className="tuner-idle-glyph" aria-hidden="true">
        ◴
      </div>
      <h2 className="tuner-idle-h">Tuner unavailable here</h2>
      <p className="tuner-idle-rationale">
        This browser does not provide the microphone audio capability the
        intonation drill needs, so it cannot run here. Opening the site in a
        current desktop or mobile browser over a secure (https) connection will
        enable it.
      </p>
    </section>
  );
}

/** Denied (AC3): settings-recovery guidance — NOT a no-op retry. */
function DeniedState() {
  return (
    <section className="tuner-panel tuner-denied" aria-label="Microphone blocked">
      <div className="tuner-idle-glyph" aria-hidden="true">
        ◴
      </div>
      <h2 className="tuner-idle-h">Microphone blocked</h2>
      <p className="tuner-idle-rationale">
        The microphone is blocked for this site, so the intonation drill cannot
        listen. A blocked microphone can only be re-enabled in your browser or
        system settings — usually via the lock or camera icon in the address
        bar, where you can allow the microphone for this page, then reload.
      </p>
    </section>
  );
}

/** Idle / requesting (AC4): Start affordance. aria-disabled during requesting. */
function StartState({
  onStart,
  requesting,
}: {
  onStart: () => void;
  requesting: boolean;
}) {
  return (
    <section className="tuner-panel tuner-idle" aria-label="Start intonation drill">
      <div className="tuner-idle-glyph" aria-hidden="true">
        ◴
      </div>
      {/* Distinct from the §9 page H1 ("Intonation drill") so the idle screen
          doesn't print the same words twice — the §17.6 idle-heading pattern,
          where the Tuner's centered idle heading ("Tune your violin") differs
          from its page H1 ("Chromatic tuner"). */}
      <h2 className="tuner-idle-h">Drill your intonation</h2>
      <p className="tuner-idle-rationale">
        The drill listens to your violin through the microphone and tracks your
        intonation across a two-octave Flesch scale. Each degree is scored as
        you play it; your results are painted back onto the note map. Your
        browser will ask permission to use the microphone.
      </p>
      <button
        type="button"
        className="tuner-start"
        onClick={onStart}
        aria-disabled={requesting || undefined}
      >
        {requesting ? 'Starting…' : 'Start drill'}
      </button>
      <p className="tuner-privacy">
        The audio is processed entirely in your browser. Nothing is recorded,
        stored, or sent anywhere.
      </p>
    </section>
  );
}

// ── Running state ─────────────────────────────────────────────────────────────

/** Running state (AC5 / AC6 / AC7): DrillMap + DrillMeter + live RunHeader. */
function RunningState({
  scaleName,
  targetIndex,
  targetCount,
  dots,
  orientation,
  handedness,
  density,
  viewBox,
  motion,
  liveCents,
  inTune,
  targetLetter,
}: {
  scaleName: string;
  targetIndex: number;
  targetCount: number;
  dots: readonly DrillDot[];
  orientation: Orientation;
  handedness: Handedness;
  density: ResolvedDensity;
  /** §12.1 coordinate space — from axisOf({orientation,handedness,density}).viewBox. */
  viewBox: string;
  /** §7 motion build — drives data-motion on the board SVG (§18.8 re-frame guards). */
  motion: MotionBuild;
  liveCents: number | null;
  inTune: boolean;
  targetLetter: string;
}) {
  return (
    <section className="intonation-running" aria-label="Intonation drill running">
      {/* Live RunHeader — real props from the hook (AC7). */}
      <RunHeader
        scaleName={scaleName}
        targetIndex={targetIndex}
        targetCount={targetCount}
      />

      {/* DrillMap must be inside <svg id="board"> (§R3 / AC5).
          §12.1 — viewBox sets the coordinate space the DrillMap dots are drawn
          in (matches Content.tsx exactly: horizontal='0 0 760 264', vertical=
          '0 0 352 850'). Without viewBox the SVG defaults to 300×150 and clips.
          §11.3 — role="group" exposes the per-dot aria-label markers to AT
          (the §18.9 text-redundancy backing no-color-only). aria-hidden on the
          note-map in Content is for the full fingerboard (NoteMap), not for the
          drill dots which carry individual semantic labels.
          §18.8 — data-motion enables the §18.8 re-frame motion hooks
          (.board[data-motion] .fingerboard-window selector).
          §10/§12.1 — data-orientation drives the shell.css min-width rule so
          the vertical SVG shrinks to fit on mobile. */}
      <svg
        id="board"
        className="board"
        viewBox={viewBox}
        role="group"
        aria-label="Intonation drill fingerboard"
        data-motion={motion}
        data-orientation={orientation}
      >
        <DrillMap
          dots={dots}
          orientation={orientation}
          handedness={handedness}
          density={density}
        />
      </svg>

      {/* DrillMeter with DERIVED props — ±5¢ inTune + spelled targetLetter (AC6). */}
      <DrillMeter
        liveCents={liveCents}
        inTune={inTune}
        targetLetter={targetLetter}
        isRunning={true}
      />
    </section>
  );
}

// ── Result normalizer ─────────────────────────────────────────────────────────

/**
 * Normalize noteTracker's NoteResult (medianCents: number | null) to the
 * DrillSummary-compatible shape (medianCents: number). Null medianCents —
 * a degenerate but safe edge case per noteTracker contract — maps to 0.
 */
function normalizeSummaryResults(
  results: readonly { targetIndex: number; intendedHz: number; medianCents: number | null; frameCount: number }[],
): readonly SummaryNoteResult[] {
  return results.map((r) => ({
    targetIndex: r.targetIndex,
    intendedHz: r.intendedHz,
    medianCents: r.medianCents ?? 0,
    frameCount: r.frameCount,
  }));
}

// ── Announcer (§18.9 / AC11) ─────────────────────────────────────────────────

/**
 * The visually-hidden polite live region (§18.9 / §11.3).
 * Present only when the Intonation view is active (conditionally rendered by the
 * parent — this component is always mounted here, so "present" means this view
 * is active). Exists EMPTY at mount.
 *
 * Two triggers:
 *   1. target-change: debounced ~1800ms, speaks "Target n of total — <note>"
 *   2. note-settle: liveCents stable within ±5¢ for SETTLE_FRAMES consecutive
 *      frames, then debounced ~1800ms — "+n cents — slightly sharp/flat"
 *
 * null liveCents values reset the settle window.
 * Never fires per-frame.
 */
function IntonationAnnouncer({
  phase,
  currentTargetIndex,
  planLength,
  targetLetter,
  liveCents,
}: {
  phase: string;
  currentTargetIndex: number;
  planLength: number;
  targetLetter: string;
  liveCents: number | null;
}) {
  const [message, setMessage] = useState('');

  // ── Target-change announcer ───────────────────────────────────────────────
  const lastAnnouncedTargetRef = useRef<number | null>(null);

  useEffect(() => {
    if (phase !== 'running') {
      lastAnnouncedTargetRef.current = null;
      return;
    }

    if (lastAnnouncedTargetRef.current === currentTargetIndex) return;

    const timer = setTimeout(() => {
      const displayIndex = currentTargetIndex + 1;
      setMessage(`Target ${String(displayIndex)} of ${String(planLength)} — ${targetLetter}`);
      lastAnnouncedTargetRef.current = currentTargetIndex;
    }, ANNOUNCE_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [phase, currentTargetIndex, planLength, targetLetter]);

  // ── Note-settle announcer (§R4 / AC11) ───────────────────────────────────
  // Track consecutive frames where |liveCents| ≤ IN_TUNE_CENTS.
  const settleCountRef = useRef(0);
  const settleAnnouncedRef = useRef(false);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (phase !== 'running') {
      settleCountRef.current = 0;
      settleAnnouncedRef.current = false;
      return;
    }

    if (liveCents === null) {
      // Signal lost — reset settle window
      settleCountRef.current = 0;
      settleAnnouncedRef.current = false;
      if (settleTimerRef.current !== null) {
        clearTimeout(settleTimerRef.current);
        settleTimerRef.current = null;
      }
      return;
    }

    const stable = Math.abs(liveCents) <= IN_TUNE_CENTS;
    if (stable) {
      settleCountRef.current += 1;
    } else {
      settleCountRef.current = 0;
      settleAnnouncedRef.current = false;
      if (settleTimerRef.current !== null) {
        clearTimeout(settleTimerRef.current);
        settleTimerRef.current = null;
      }
    }

    // Once we've accumulated SETTLE_FRAMES of stable readings and haven't
    // announced yet for this settled position, fire the debounced announcement.
    if (settleCountRef.current >= SETTLE_FRAMES && !settleAnnouncedRef.current) {
      settleAnnouncedRef.current = true;

      if (settleTimerRef.current !== null) {
        clearTimeout(settleTimerRef.current);
      }
      const centsSnapshot = liveCents;
      settleTimerRef.current = setTimeout(() => {
        const rounded = Math.round(centsSnapshot);
        if (rounded === 0) {
          setMessage('In tune');
        } else {
          const direction = rounded > 0 ? 'sharp' : 'flat';
          setMessage(`${rounded > 0 ? '+' : ''}${String(Math.abs(rounded))} cents — slightly ${direction}`);
        }
        settleTimerRef.current = null;
      }, ANNOUNCE_DEBOUNCE_MS);
    }
  }, [phase, liveCents]);

  // Cleanup settle timer on unmount
  useEffect(() => {
    return () => {
      if (settleTimerRef.current !== null) {
        clearTimeout(settleTimerRef.current);
      }
    };
  }, []);

  // Force empty when not running — the live region always starts and re-starts empty.
  const liveText = phase === 'running' ? message : '';

  return (
    <div
      className="sr-only"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-live="intonation"
    >
      {liveText}
    </div>
  );
}
