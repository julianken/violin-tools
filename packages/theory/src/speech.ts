// Spoken note names — the §13 plain-speech rendering of a spelled note name for
// assistive technology.
//
// DESIGN.md §13 is the source of truth and wins on any conflict (AGENTS.md):
// "Spoken note names (for assistive tech) are plain speech: 'C sharp', not 'C#'."
// `spell()` (spell.ts) produces the VISUAL glyph form (`C♯`, `B♭`, `B♭♭`); this
// module rewrites that glyph form into the words a screen reader should announce,
// so a note marker's accessible name reads "C sharp, root", not "C♯, root" (which
// a screen reader would mispronounce or skip). It is a pure, total function over
// the glyph strings `spell()` emits — no React/DOM/token dependency.
//
// The accidental glyphs are exactly the two the self-hosted Inter face covers and
// `spell()` emits (§3 / §13): U+266F `♯` (sharp) and U+266D `♭` (flat). Double
// accidentals are the doubled single glyphs (`♯♯` / `♭♭`), so "double sharp" /
// "double flat" must be matched BEFORE the single forms.

import { type NodeState, type Root, type ScaleType } from './classify.ts';
import { spell } from './spell.ts';

/** A spoken-form replacement for each accidental glyph run `spell()` can emit. */
const ACCIDENTAL_SPEECH: readonly { glyph: string; spoken: string }[] = [
  // Doubled signs first so `♯♯` is not consumed as two `♯` (§13 double-accidental).
  { glyph: '♯♯', spoken: ' double sharp' },
  { glyph: '♭♭', spoken: ' double flat' },
  { glyph: '♯', spoken: ' sharp' },
  { glyph: '♭', spoken: ' flat' },
];

/**
 * §13 — the plain-speech form of a spelled note name. Replaces the accidental
 * glyphs with their spoken words, leaving the bare letter as-is:
 *   "C♯"  → "C sharp"
 *   "B♭"  → "B flat"
 *   "B♭♭" → "B double flat"
 *   "G"   → "G"
 * An empty name (an off node, which carries no §13 name) speaks as the empty
 * string; callers suffix the classification state ("root" / "in scale" / "not in
 * scale") separately. Total: any input string returns a string.
 */
export function spokenName(spelled: string): string {
  let out = spelled;
  for (const { glyph, spoken } of ACCIDENTAL_SPEECH) {
    out = out.split(glyph).join(spoken);
  }
  return out;
}

/** The §11.3 spoken state suffix for each classification (verbatim from §11.3). */
const STATE_SUFFIX: Readonly<Record<NodeState, string>> = {
  root: 'root',
  'in-scale': 'in scale',
  off: 'not in scale',
};

/**
 * §11.3 — the accessible name a note marker exposes to assistive technology: the
 * §13 spoken note name suffixed with its §12.5 classification state, verbatim per
 * §11.3 — "C sharp, root", "E, in scale", "F, not in scale".
 *
 * An OFF node carries no §13 name (`spell()` returns ''), but it still announces
 * its pitch so a non-visual user can read the whole grid; so the spoken note name
 * is always computed from `spell(nodePc, root, 'chromatic')` (chromatic spells
 * EVERY pitch class, key-aware, per §13) and the state suffix is appended. The
 * result is pure and recomputes on every (root, scale) change, satisfying the
 * "accessible name updates to match its §12.5 classification" AC.
 */
export function noteMarkerName(
  nodePc: number,
  root: Root,
  scale: ScaleType,
  state: NodeState,
): string {
  // In-scale / root nodes spell within the selected key (§13); an off node has no
  // §13 name in that key, so fall back to the key-aware chromatic spelling so the
  // pitch is still spoken ("F, not in scale") rather than an empty, stateful name.
  const glyph = state === 'off' ? spell(nodePc, root, 'chromatic') : spell(nodePc, root, scale);
  return `${spokenName(glyph)}, ${STATE_SUFFIX[state]}`;
}
