import { expect, test } from '@playwright/test';

// motion.spec — the Playwright (real Chromium) half of the §7 motion verification
// (DESIGN.md §7 wins on conflict, AGENTS.md). jsdom (the Vitest layer) cannot
// compute CSS transitions or run keyframes; THIS suite asserts the LIVE motion
// contract the unit layer cannot:
//   • the left→right per-column stagger, read as COMPUTED transition-delay
//     (stateful) / animation-delay (snappy) on column 0 vs column 14 — col 14
//     differs from col 0 by 14× the per-column stagger (NOT a render-timestamp
//     race, which is flaky — the plan-review IMPORTANT this closes);
//   • the dotPop reflow-replay firing on an off→in-scale change (snappy);
//   • the tape +4→+3 slide (the panel-reveal hook driven by data-open);
//   • that under emulated prefers-reduced-motion: reduce no transition/keyframe
//     runs while the static {mint} sounding stroke remains.
//
// Build selection is the `?motion=` query param (the single data-motion root
// toggle); the default (no param) is the stateful build.

const STATEFUL = '/';
const SNAPPY = '/?motion=snappy';

/** Parse a CSS time token ("84ms" / "0.084s" / "0s") to milliseconds. */
function ms(value: string): number {
  const v = value.trim();
  if (v.endsWith('ms')) return parseFloat(v);
  if (v.endsWith('s')) return parseFloat(v) * 1000;
  return parseFloat(v);
}

test.describe('§7.1 stateful — per-column transition-delay stagger', () => {
  test('col 14 transition-delay = col 0 + 14 × 6ms (computed, not a timing race)', async ({
    page,
  }) => {
    await page.goto(STATEFUL);
    await expect(page.locator('svg#board[data-motion="stateful"]')).toBeVisible();

    // The delay lives on the .dot (it reads --col from the parent .note via
    // inheritance). Read the COMPUTED transition-delay per column.
    const delayAt = async (col: number) =>
      ms(
        await page
          .locator(`g.note[data-col="${String(col)}"] circle.dot`)
          .first()
          .evaluate((el) => getComputedStyle(el).transitionDelay),
      );

    const d0 = await delayAt(0);
    const d14 = await delayAt(14);
    // Stateful stagger is 6ms/column → col 14 holds back 14 × 6 = 84ms more.
    expect(d0).toBeCloseTo(0, 1);
    expect(d14 - d0).toBeCloseTo(84, 1);
  });
});

test.describe('§7.2 snappy — per-column animation-delay stagger + dotPop', () => {
  test('col 14 animation-delay = col 0 + 14 × 10ms (computed)', async ({
    page,
  }) => {
    await page.goto(SNAPPY);
    await expect(page.locator('svg#board[data-motion="snappy"]')).toBeVisible();

    // The animation-delay lives on the .dot-anim (the .note <g> itself) for the
    // in-scale dots. Read it on an in-scale node at col 0 and col 14.
    const delayAt = async (col: number) =>
      ms(
        await page
          .locator(`g.note.dot-anim[data-col="${String(col)}"]`)
          .first()
          .evaluate((el) => getComputedStyle(el).animationDelay),
      );

    const d0 = await delayAt(0);
    const d14 = await delayAt(14);
    // Snappy stagger is 10ms/column → col 14 holds back 14 × 10 = 140ms more.
    expect(d0).toBeCloseTo(0, 1);
    expect(d14 - d0).toBeCloseTo(140, 1);
  });

  test('the in-scale dots carry the dotPop animation (animation-name resolves)', async ({
    page,
  }) => {
    await page.goto(SNAPPY);
    const name = await page
      .locator('g.note.dot-anim')
      .first()
      .evaluate((el) => getComputedStyle(el).animationName);
    expect(name).toBe('dotPop');
  });

  test('an off→in-scale change re-runs dotPop via the reflow-replay (same element)', async ({
    page,
  }) => {
    await page.goto(SNAPPY);
    // A Major default: open G3 (string 4, col 0) is OFF (the §12.5 worked check).
    // Switching root to G makes G3 the root → it enters the scale and must re-pop.
    const g3Open = page.locator('g.note[data-col="0"]').nth(3); // 4th string, col 0
    await expect(g3Open).toHaveClass(/is-off/);

    // Capture the element handle to prove it is the SAME node (re-classed, not
    // re-mounted — Principle 5 / §7.2).
    const handleBefore = await g3Open.elementHandle();

    await page.getByRole('radio', { name: 'G', exact: true }).click();
    await expect(g3Open).toHaveClass(/is-root/);
    await expect(g3Open).toHaveClass(/dot-anim/); // it now pops

    const handleAfter = await page
      .locator('g.note[data-col="0"]')
      .nth(3)
      .elementHandle();
    // Same DOM node before and after (re-classed in place).
    expect(
      await page.evaluate(
        ([a, b]) => a === b,
        [handleBefore, handleAfter] as const,
      ),
    ).toBe(true);
  });
});

test.describe('§7.1/§7.5 tape +4→+3 slide (panel-reveal hook)', () => {
  test('toggling "low 2" flips data-open and translates the tape band left', async ({
    page,
  }) => {
    await page.goto(STATEFUL);
    // Turn tapes on, then read tape 2's transform at +4 (open) and +3 (low 2).
    await page.getByRole('checkbox', { name: 'Tapes', exact: true }).click();

    const tape2 = page.locator('g.tape g.tape-band.t-panel-slide');
    await expect(tape2).toHaveAttribute('data-open', 'true');

    // Read the computed transform matrix translateX at the open (+4) state.
    const txAt = async () =>
      tape2.evaluate((el) => {
        const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
        return m.m41; // translateX in px
      });
    const openTx = await txAt();

    await page.getByRole('checkbox', { name: 'low 2', exact: true }).click();
    await expect(tape2).toHaveAttribute('data-open', 'false');
    // Wait for the slide to settle, then read the closed (+3) translateX.
    await page.waitForTimeout(400); // > the 230ms tape-slide
    const closedTx = await txAt();

    // +3 is one column (44px) LEFT of +4: the band translates by −44px.
    expect(closedTx - openTx).toBeCloseTo(-44, 0);
  });
});

test.describe('§7.4/§11.4 reduced motion — no transition/keyframe runs; sounding stroke stays', () => {
  test('the §7.4 gate kills the stateful transitions under reduce (both builds)', async ({
    page,
  }) => {
    // emulateMedia is the reliable way to set the media feature for the page
    // (asserted true via matchMedia below) — set it BEFORE navigation.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(STATEFUL);
    await expect(page.locator('svg#board')).toBeVisible();
    expect(
      await page.evaluate(
        () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      ),
    ).toBe(true);

    // Stateful: the build rule normally sets r/fill/stroke transitions; under the
    // §7.4 gate the board-scoped reset wins and zeroes them.
    const dot = await page
      .locator('g.note circle.dot')
      .first()
      .evaluate((el) => {
        const cs = getComputedStyle(el);
        return { prop: cs.transitionProperty, delay: cs.transitionDelay };
      });
    expect(dot.prop).toBe('none');
    expect(dot.delay).toBe('0s'); // the per-column stagger is gone
  });

  test('the §7.4 gate kills the snappy dotPop keyframe under reduce', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(SNAPPY);
    await expect(page.locator('svg#board[data-motion="snappy"]')).toBeVisible();
    const popAnim = await page
      .locator('g.note.dot-anim')
      .first()
      .evaluate((el) => getComputedStyle(el).animationName);
    expect(popAnim).toBe('none');
  });

  test('the static {mint} sounding stroke remains the sole cue under reduce (stroke-width 3)', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(STATEFUL);
    // The .sound child exists on every node; its static stroke-width:3 ring is the
    // motion-free cue in ALL modes (§7.5 / §11.4). It is opacity 0 at rest.
    const sound = page.locator('g.note circle.sound').first();
    await expect(sound).toHaveCount(1);
    const strokeWidth = await sound.evaluate(
      (el) => getComputedStyle(el).strokeWidth,
    );
    expect(strokeWidth).toBe('3px');
  });
});
