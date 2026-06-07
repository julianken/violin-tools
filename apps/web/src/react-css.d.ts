/**
 * Module augmentation for CSS custom properties written via inline `style`.
 *
 * React 19's `@types/react` removed the `CSSProperties` index signature, so a
 * `--foo` custom property in a JSX `style` object must be declared explicitly by
 * module augmentation (the upstream-recommended path; see the comment on
 * `CSSProperties` in `@types/react`). Kept in its OWN module (not `css.d.ts`,
 * which must stay a global ambient file for `declare module '*.css'`).
 *
 * `--col` is the §7 note-map per-column stagger index (0…14 column offset, §12.1)
 * the motion layer reads as `calc(var(--col) * var(--stagger-per-column))` to
 * sweep a (root, scale) change left → right up the neck (§7.1 / §7.2).
 */
import 'react';

declare module 'react' {
  interface CSSProperties {
    '--col'?: number;
  }
}
