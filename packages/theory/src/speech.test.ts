import { describe, expect, it } from 'vitest';

import { ROOT_PITCH_CLASS, SCALE_INTERVALS, classify, nodePitchClass } from './index.ts';
import { noteMarkerName, spokenName } from './speech.ts';

// §13 / §11.3 spoken-note-name suite. `spokenName` rewrites the glyph form
// `spell()` emits into plain speech ("C sharp", not "C#"); `noteMarkerName` joins
// that with the §12.5 classification suffix to produce the verbatim §11.3
// accessible name a screen-reader user hears ("C sharp, root"). These pin the
// exact strings §11.3 lists "so a reproducer does not invent them".

describe('§13 spokenName — glyph → plain speech (for assistive tech)', () => {
  it('rewrites the sharp glyph to the word "sharp"', () => {
    expect(spokenName('C♯')).toBe('C sharp');
    expect(spokenName('F♯')).toBe('F sharp');
  });

  it('rewrites the flat glyph to the word "flat"', () => {
    expect(spokenName('B♭')).toBe('B flat');
    expect(spokenName('E♭')).toBe('E flat');
  });

  it('leaves a bare natural letter untouched', () => {
    expect(spokenName('E')).toBe('E');
    expect(spokenName('G')).toBe('G');
  });

  it('rewrites the doubled glyphs to "double flat" / "double sharp" (not two singles)', () => {
    // §13 double accidentals are the DOUBLED single signs; the doubled rule must
    // win over the single one (B♭♭ → "B double flat", never "B flat flat").
    expect(spokenName('B♭♭')).toBe('B double flat');
    expect(spokenName('F♯♯')).toBe('F double sharp');
  });

  it('speaks an empty (off-node) name as the empty string', () => {
    expect(spokenName('')).toBe('');
  });

  it('never leaves a raw accidental glyph in the spoken output (no ♯ / ♭ survives)', () => {
    for (const glyph of ['A♯', 'D♭', 'G♯♯', 'C♭♭', 'B']) {
      const spoken = spokenName(glyph);
      expect(spoken.includes('♯')).toBe(false);
      expect(spoken.includes('♭')).toBe(false);
    }
  });
});

describe('§11.3 noteMarkerName — the verbatim per-marker accessible name', () => {
  it('names a root marker "<spoken note>, root" (e.g. "C sharp, root")', () => {
    // C♯ as the root of C♯ major (pc 1). The spec's own example string.
    expect(noteMarkerName(1, 'Db', 'major', 'root')).toBe('D flat, root'); // Db root spelling
    // A as the root of A major.
    expect(noteMarkerName(9, 'A', 'major', 'root')).toBe('A, root');
  });

  it('names an in-scale marker "<spoken note>, in scale" (e.g. "E, in scale")', () => {
    // E (pc 4) is the 5th of A major → in scale.
    expect(noteMarkerName(4, 'A', 'major', 'in-scale')).toBe('E, in scale');
    // C♯ (pc 1) is the 3rd of A major → in scale, spoken "C sharp".
    expect(noteMarkerName(1, 'A', 'major', 'in-scale')).toBe('C sharp, in scale');
  });

  it('names an off marker "<spoken note>, not in scale" (e.g. "F, not in scale")', () => {
    // F (pc 5) is not in A major → off; still spoken with its pitch.
    expect(noteMarkerName(5, 'A', 'major', 'off')).toBe('F, not in scale');
  });

  it('spells off markers key-aware: B♭ Major speaks an off pc with a flat, never a sharp', () => {
    // In B♭ major, pc 6 is off (G♭ on the flat side); it must speak "G flat",
    // never "F sharp" — the chromatic fallback is key-aware (§13).
    const name = noteMarkerName(6, 'Bb', 'major', 'off');
    expect(name).toBe('G flat, not in scale');
    expect(name.includes('sharp')).toBe(false);
  });

  it('recomputes the suffix to match §12.5 classification when the key changes', () => {
    // Open G3 (pc 7): off in A major, but root in G major — the same pc, two
    // different accessible names, proving the name tracks classification.
    const aMajorSet = SCALE_INTERVALS.major;
    const offState = classify(ROOT_PITCH_CLASS.A, aMajorSet, nodePitchClass(7, 0));
    const rootState = classify(ROOT_PITCH_CLASS.G, aMajorSet, nodePitchClass(7, 0));
    expect(noteMarkerName(7, 'A', 'major', offState)).toBe('G, not in scale');
    expect(noteMarkerName(7, 'G', 'major', rootState)).toBe('G, root');
  });

  it('always ends with one of the three §11.3 suffixes, for every pc/root/scale', () => {
    const suffixes = [', root', ', in scale', ', not in scale'];
    for (const root of Object.keys(ROOT_PITCH_CLASS) as (keyof typeof ROOT_PITCH_CLASS)[]) {
      for (const scale of Object.keys(SCALE_INTERVALS) as (keyof typeof SCALE_INTERVALS)[]) {
        const rootPc = ROOT_PITCH_CLASS[root];
        const set = SCALE_INTERVALS[scale];
        for (let pc = 0; pc < 12; pc++) {
          const state = classify(rootPc, set, pc);
          const name = noteMarkerName(pc, root, scale, state);
          expect(suffixes.some((s) => name.endsWith(s))).toBe(true);
          // The name always has a spoken pitch before the comma.
          expect(name.split(',')[0]?.length).toBeGreaterThan(0);
        }
      }
    }
  });
});
