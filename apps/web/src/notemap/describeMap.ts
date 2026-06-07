// describeMap — the §11.3 string-by-string text description of the note map for
// the polite map-description live region. DESIGN.md §11.3 / §13 win on any
// conflict (AGENTS.md).
//
// §11.3 requires "a full string-by-string text description of the map, refreshed
// on each scale change", living in an EXTERNAL element (not the SVG `<desc>`). A
// non-visual user can't see the 60-dot grid, so this names the scale and then,
// per open string (top-to-bottom E5 · A4 · D4 · G3), lists the in-scale (and
// root) notes found along that string in pitch order — the spoken (§13) names, so
// a flat key reads "B flat", never "A sharp". Off notes are omitted (they are the
// silence between scale degrees); the description is what is IN the scale.
//
// Pure: a function of `(root, scale)` through @violin-tools/theory; no DOM. The
// renderer (NoteMap) and the shell (AppShell live region) consume the string.

import {
  classify,
  noteMarkerName,
  nodePitchClass,
  spell,
  spokenName,
  ROOT_PITCH_CLASS,
  SCALE_INTERVALS,
  type Root,
  type ScaleType,
} from '@violin-tools/theory';

import { COLUMN_OFFSETS, STRINGS } from './geometry.ts';

/** The full spoken scale name for the description lead ("A Major", "B flat …"). */
function spokenScaleName(root: Root, scale: ScaleType, displayName: string): string {
  // Spell the root within the key (degree 0), then speak its glyph, then join the
  // full scale display name — so "Bb" reads "B flat Major", matching the H1.
  const rootGlyph = spell(ROOT_PITCH_CLASS[root], root, scale);
  return `${spokenName(rootGlyph)} ${displayName}`;
}

/**
 * §11.3 — the string-by-string description of the current map. `displayName` is
 * the §13 full scale name (passed in so this module doesn't duplicate the §13
 * SCALE_DISPLAY_NAME table the state layer owns). Returns one sentence naming the
 * scale, then one clause per string listing its in-scale notes in pitch order.
 */
export function describeMap(root: Root, scale: ScaleType, displayName: string): string {
  const rootPc = ROOT_PITCH_CLASS[root];
  const scaleSet = SCALE_INTERVALS[scale];

  const perString = STRINGS.map((string) => {
    const names = COLUMN_OFFSETS.flatMap((columnOffset) => {
      const nodePc = nodePitchClass(string.pc, columnOffset);
      const state = classify(rootPc, scaleSet, nodePc);
      // Only the scale notes (root + in-scale) are described; off notes are the
      // gaps between them and would make the description unreadably long.
      if (state === 'off') return [];
      // Reuse the per-marker spoken name (without the suffix) so the description
      // and the markers speak the SAME §13 pitch names.
      const marker = noteMarkerName(nodePc, root, scale, state);
      const [pitch = ''] = marker.split(', ');
      return [pitch];
    });
    return `${string.name}: ${names.join(', ')}`;
  });

  return `${spokenScaleName(root, scale, displayName)}. ${perString.join('. ')}.`;
}
