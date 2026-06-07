// The 52px topbar (DESIGN.md §9 tree, §4.2): a breadcrumb on the left and the
// inert "Share scale" ghost button on the right, space-between. The bar carries
// no own fill — it inherits {canvas} from the body. The breadcrumb's active
// segment is the §13 spelled current selection ("Scales / B♭ Major"), driven
// from real `(root, scale)` state — S14 replaced the hard-coded "A Major" with
// the same `spell()`-derived name the H1 and the map labels use.

interface TopbarProps {
  /**
   * The §13 spelled current selection (e.g. "A Major", "B♭ Major") — the active
   * breadcrumb segment. Comes from `scaleName(controls.state)` in AppShell so it
   * agrees with the H1 and the map labels (one `spell()` engine).
   */
  scaleName: string;
}

function shareScale(): void {
  // No-op in v1 (DESIGN.md §16): "Share scale" has no defined behavior yet. The
  // button ships visible and inert per §8.4.
}

export function Topbar({ scaleName }: TopbarProps) {
  return (
    <div className="topbar">
      <nav className="crumb" aria-label="Breadcrumb">
        <span className="crumb-seg">Scales</span>
        <span className="crumb-sep" aria-hidden="true">
          /
        </span>
        <span className="crumb-seg crumb-active" aria-current="page">
          {scaleName}
        </span>
      </nav>

      <button type="button" className="ghost" onClick={shareScale}>
        Share scale
      </button>
    </div>
  );
}
