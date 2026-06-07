// The 52px topbar (DESIGN.md §9 tree, §4.2): a breadcrumb on the left and the
// inert "Share scale" ghost button on the right, space-between. The bar carries
// no own fill — it inherits {canvas} from the body. The breadcrumb segments are
// placeholder content ("Scales / A Major") matching the §9 tree; S6 will drive
// the active segment from real state.

function shareScale(): void {
  // No-op in v1 (DESIGN.md §16): "Share scale" has no defined behavior yet. The
  // button ships visible and inert per §8.4.
}

export function Topbar() {
  return (
    <div className="topbar">
      <nav className="crumb" aria-label="Breadcrumb">
        <span className="crumb-seg">Scales</span>
        <span className="crumb-sep" aria-hidden="true">
          /
        </span>
        <span className="crumb-seg crumb-active" aria-current="page">
          A Major
        </span>
      </nav>

      <button type="button" className="ghost" onClick={shareScale}>
        Share scale
      </button>
    </div>
  );
}
