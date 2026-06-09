// TunerView — the live Tuner surface (DESIGN.md §17). DESIGN.md §17 wins on any
// conflict (AGENTS.md). This is the capstone (S18 ph6, epic #90): it OWNS the
// `useTuner()` audio hook and renders the §17 surface from what it exposes — the
// kicker/H1, the dot-echo meter (TunerMeter), the numeric readout, the four
// open-string chips, the A4 control, and every permission state (idle / listening /
// denied / unsupported). It is the ONLY tuner component that touches the hook; the
// meter, chips, and A4 control below are pure/presentational so they unit-test with
// no audio (§17 testability seam).
//
// Voice is §13 teacher-tone throughout — factual, no marketing. No red anywhere
// (§17.7 / §2.6): the only two pitch colours are {mint} (in tune) and neutral grey
// (seeking); direction is always backed by the ♯/♭ word, never hue. The Start
// affordance is a {mint}-OUTLINE pill (no second solid fill, §17.6 / §2.4).
//
// a11y (§17.9 / §11.3): a visually-hidden role="status" aria-live="polite"
// aria-atomic="true" announcer exists EMPTY at load (so the first announcement is
// heard), is DECOUPLED from the per-frame meter, and speaks only on note-change +
// first in-tune, debounced ~1.8s — never every frame. Colour is never the only
// signal (mint + the `in tune ✓` word + the dot's size/glow).

import { spokenName } from '@violin-tools/theory';
import { useEffect, useRef, useState } from 'react';

import { A4Calibration } from './A4Calibration.tsx';
import { TunerMeter } from './TunerMeter.tsx';
import './tuner.css';
import { type Readout } from './smoothing.ts';
import { useTuner } from './useTuner.ts';

/** The four violin open strings, low→high, as §8.1 chips (§17.4). */
const OPEN_STRING_CHIPS = ['G3', 'D4', 'A4', 'E5'] as const;

/** Announcer debounce — §17.9 "~1.5–2s" so rapid pitch movement doesn't flood AT. */
const ANNOUNCE_DEBOUNCE_MS = 1800;

export function TunerView() {
  const tuner = useTuner();
  const { status, readout, paused, start, stop, a4, setA4 } = tuner;

  return (
    <main id="main" className="content tuner-view">
      <div className="kicker">Tuner</div>
      <div className="toolhead">
        <h1 className="h1">Chromatic tuner</h1>
        <div className="formula" />
      </div>

      {/* The single visually-hidden polite announcer (§17.9 / §11.3). It exists
          EMPTY at load — rendered unconditionally so the live region is present
          before its first write — and is fed by the throttled effect below, NOT
          the per-frame meter. */}
      <TunerAnnouncer status={status} readout={readout} />

      {status === 'unsupported' ? (
        <UnsupportedState />
      ) : status === 'denied' ? (
        <DeniedState onRetry={stop} />
      ) : status === 'idle' || status === 'requesting' ? (
        <IdleState
          onStart={() => {
            // `start()` is async; the UI doesn't await it (the status state machine
            // drives the render), so fire-and-forget with a void wrapper.
            void start();
          }}
          requesting={status === 'requesting'}
        />
      ) : (
        <ListeningState
          readout={readout}
          paused={paused}
          a4={a4}
          onA4Change={setA4}
          onStop={stop}
        />
      )}
    </main>
  );
}

// ── States ───────────────────────────────────────────────────────────────────

/** Idle / start (§17.6): the ◎ glyph, the rationale, the {mint}-outline Start pill. */
function IdleState({ onStart, requesting }: { onStart: () => void; requesting: boolean }) {
  return (
    <section className="tuner-panel tuner-idle" aria-label="Start tuning">
      <div className="tuner-idle-glyph" aria-hidden="true">
        ◎
      </div>
      <h2 className="tuner-idle-h">Tune your violin</h2>
      <p className="tuner-idle-rationale">
        This tuner listens to your violin through the microphone and shows the
        nearest note, its octave, and how many cents sharp or flat you are. Your
        browser will ask permission to use the microphone.
      </p>
      <button
        type="button"
        className="tuner-start"
        onClick={onStart}
        aria-disabled={requesting || undefined}
      >
        {requesting ? 'Starting…' : 'Start tuning'}
      </button>
      <p className="tuner-privacy">
        The audio is processed entirely in your browser. Nothing is recorded,
        stored, or sent anywhere.
      </p>
    </section>
  );
}

/** Permission denied (§17.6): settings-recovery guidance — NOT a no-op retry. */
function DeniedState({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="tuner-panel tuner-denied" aria-label="Microphone blocked">
      <div className="tuner-idle-glyph" aria-hidden="true">
        ◎
      </div>
      <h2 className="tuner-idle-h">Microphone blocked</h2>
      <p className="tuner-idle-rationale">
        The microphone is blocked for this site, so the tuner cannot listen. A
        blocked microphone can only be re-enabled in your browser or system
        settings — usually via the lock or camera icon in the address bar, where
        you can allow the microphone for this page, then reload.
      </p>
      {/* Not a "retry mic" button (it cannot succeed while permission is blocked,
          §17.6) — it returns to the start screen so a re-grant in settings + reload
          lands back at a working Start. */}
      <button type="button" className="tuner-start" onClick={onRetry}>
        Back to start
      </button>
    </section>
  );
}

/** Unsupported (§17.6): a graceful message, NO dead Start control. */
function UnsupportedState() {
  return (
    <section className="tuner-panel tuner-unsupported" aria-label="Tuner unavailable">
      <div className="tuner-idle-glyph" aria-hidden="true">
        ◎
      </div>
      <h2 className="tuner-idle-h">Tuner unavailable here</h2>
      <p className="tuner-idle-rationale">
        This browser does not provide the microphone audio capability the tuner
        needs, so it cannot run here. Opening the site in a current desktop or
        mobile browser over a secure (https) connection will enable it.
      </p>
    </section>
  );
}

/** Listening (§17.6): the live meter, readout, chips, A4 control. */
function ListeningState({
  readout,
  paused,
  a4,
  onA4Change,
  onStop,
}: {
  readout: Readout | null;
  paused: boolean;
  a4: number;
  onA4Change: (a4: number) => void;
  onStop: () => void;
}) {
  const hasSignal = readout !== null;
  const inTune = hasSignal && readout.inTune;

  return (
    <section className="tuner-panel tuner-listening" aria-label="Listening">
      <Readout readout={readout} inTune={inTune} />

      <TunerMeter
        cents={readout?.cents ?? 0}
        inTune={inTune}
        note={readout?.note ?? ''}
        octave={readout?.octave ?? 0}
        nearestString={readout?.nearestString ?? null}
        hasSignal={hasSignal}
      />

      <StringChips nearestString={hasSignal ? readout.nearestString : null} inTune={inTune} />

      <A4Calibration a4={a4} onChange={onA4Change} />

      {paused && (
        <p className="tuner-paused" role="status">
          Paused while this tab is in the background.
        </p>
      )}

      <button type="button" className="tuner-stop" onClick={onStop}>
        Stop
      </button>
    </section>
  );
}

// ── Readout (§17.3) ───────────────────────────────────────────────────────────

/**
 * The numeric readout (§17.3): note + octave + signed cents, all Geist-Mono (NOT
 * Inter — only the in-DOT label is Inter, §17.2). A direction word `sharp ♯` /
 * `flat ♭` backs the sign with language (§17.7). In tune the readout resolves to
 * {mint} and shows `IN TUNE ✓` — the ✓ glyph is the redundant non-colour cue
 * (§11.1 / §17.3).
 */
function Readout({ readout, inTune }: { readout: Readout | null; inTune: boolean }) {
  if (readout === null) {
    return (
      <div className="tuner-readout tuner-readout-empty" aria-hidden="true">
        <span className="tuner-note">—</span>
        <span className="tuner-cents">listening…</span>
      </div>
    );
  }

  const { note, octave, cents } = readout;
  const rounded = Math.round(cents);
  const direction = inTune ? null : rounded > 0 ? 'sharp ♯' : 'flat ♭';

  return (
    <div className={`tuner-readout${inTune ? ' is-in-tune' : ''}`} aria-hidden="true">
      <span className="tuner-note">
        {note}
        {octave}
      </span>
      <span className="tuner-cents">{formatSignedCents(rounded)}</span>
      {inTune ? (
        <span className="tuner-intune">IN TUNE ✓</span>
      ) : (
        <span className="tuner-dir-word">{direction}</span>
      )}
    </div>
  );
}

/**
 * The four open-string chips (§17.4): §8.1 pills, Geist-Mono note names; the string
 * nearest the detected pitch is the active pill, and the active chip gains a glow
 * ONLY when in tune (§17.4). No red — an unmatched chip is just the default pill.
 */
function StringChips({
  nearestString,
  inTune,
}: {
  nearestString: string | null;
  inTune: boolean;
}) {
  return (
    <div className="tuner-chips" role="group" aria-label="Open strings">
      {OPEN_STRING_CHIPS.map((name) => {
        const active = name === nearestString;
        return (
          <span
            key={name}
            className={`pill tuner-chip${active ? ' is-active' : ''}${
              active && inTune ? ' is-in-tune' : ''
            }`}
            data-active={active ? 'true' : 'false'}
          >
            {name}
          </span>
        );
      })}
    </div>
  );
}

// ── Announcer (§17.9) ─────────────────────────────────────────────────────────

/**
 * The visually-hidden polite live region (§17.9 / §11.3). It is rendered EMPTY at
 * load (the element exists before its first write, so the first announcement is
 * heard), DECOUPLED from the per-frame meter, and updated by a debounced effect:
 * it announces on note-change and on first in-tune, throttled ~1.8s, so rapid
 * pitch movement never floods the screen reader. Uses `spokenName` for the
 * plain-speech note (§13 / §11.3).
 */
function TunerAnnouncer({
  status,
  readout,
}: {
  status: string;
  readout: Readout | null;
}) {
  const [message, setMessage] = useState('');
  // What was last announced — so we only re-announce on a genuine note-change or
  // the first in-tune, never on every frame's cents jitter. Reset when the session
  // ends so a fresh listen starts from an empty region again.
  const lastAnnouncedRef = useRef<{ note: string; octave: number; inTune: boolean } | null>(
    null,
  );

  useEffect(() => {
    // Leaving the listening state ends the session: clear the dedupe ref so the
    // NEXT listen announces from scratch. The displayed message is forced empty at
    // render time below (no setState here — that would be a cascading-render
    // effect; the render derivation is the single source of the empty region).
    if (status !== 'listening' || readout === null) {
      lastAnnouncedRef.current = null;
      return;
    }

    const last = lastAnnouncedRef.current;
    const noteChanged = last?.note !== readout.note || last.octave !== readout.octave;
    const firstInTune = readout.inTune && !last?.inTune;

    // Only a note-change or the first in-tune for the held note is worth speaking.
    if (!noteChanged && !firstInTune) return;

    // Debounce: coalesce a burst of changes into one announcement ~1.8s apart. The
    // setMessage lives in this async timer (it responds to the external mic signal
    // settling, not a synchronous render), and the cleanup cancels a pending one.
    const timer = setTimeout(() => {
      const spoken = spokenName(readout.note); // "C♯" → "C sharp", "G" → "G"
      const suffix = readout.inTune
        ? ', in tune'
        : `, ${Math.abs(Math.round(readout.cents))} cents ${readout.cents > 0 ? 'sharp' : 'flat'}`;
      // A space before the octave so AT reads "C sharp 4", not "C sharp4".
      setMessage(`${spoken} ${String(readout.octave)}${suffix}`);
      lastAnnouncedRef.current = {
        note: readout.note,
        octave: readout.octave,
        inTune: readout.inTune,
      };
    }, ANNOUNCE_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [status, readout]);

  // The region is forced empty whenever we're not actively listening, so it always
  // STARTS empty (the §17.9 "empty at load" contract) and re-empties between
  // sessions — derived at render, never via a setState-in-effect.
  const liveText = status === 'listening' ? message : '';

  return (
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true" data-live="tuner">
      {liveText}
    </div>
  );
}

// ── Formatting ────────────────────────────────────────────────────────────────

/** Signed cents with a leading sign and the ¢ glyph (e.g. `+4¢`, `−7¢`, `0¢`). */
function formatSignedCents(rounded: number): string {
  if (rounded === 0) return '0¢';
  // U+2212 MINUS for the flat sign (matches the §17.3 readout copy `−7¢`).
  return rounded > 0 ? `+${String(rounded)}¢` : `−${String(Math.abs(rounded))}¢`;
}
