/**
 * Ambient declarations for plain CSS side-effect imports (e.g.
 * `import './styles/tokens.css'` in main.tsx).
 *
 * `tsconfig.base.json` sets `noUncheckedSideEffectImports`, which requires every
 * side-effect import to resolve to a known module type. Vite handles the runtime
 * (it bundles the CSS), but `tsc --noEmit` needs an ambient `*.css` module so the
 * gate doesn't fail on a stylesheet import. Declared project-locally rather than
 * relying on `vite/client`'s internal type layout.
 */
declare module '*.css';
