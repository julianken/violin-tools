// RefsRow — the §9.1 Refs row: 4 INDEPENDENT toggle pills (`role="checkbox"`)
// inside one `role="group"` named "Reference layers" (§11.3, reconciled in this
// PR). DESIGN.md §9.1 / §11.3 / §8.1 win on any conflict (AGENTS.md).
//
// This row is NOT a radiogroup — the four refs are independent booleans, so it is
// a `group` of checkboxes: each pill is independently Tab-focusable, `aria-checked`
// reflects its own boolean, and Space toggles it WITHOUT touching any other ref
// (the radiogroup→checkbox distinction this PR reconciles into DESIGN.md §9.1 +
// §11.3). There is NO active-highlight element here (independent toggles, not a
// moving single selection). The §8.1 accent variant (`{tape}` vs `{teal}`) and
// the §9.1 dim logic (`opacity:.4; pointer-events:none`, never hidden) are driven
// by `accent` and `isRefDimmed`.

import { isRefDimmed, REF_PILLS, type RefKey, type RefsState } from '../state/controls.ts';

interface RefsRowProps {
  refs: RefsState;
  onToggle: (key: RefKey) => void;
}

export function RefsRow({ refs, onToggle }: RefsRowProps) {
  return (
    <div className="pill-track" role="group" aria-label="Reference layers">
      {REF_PILLS.map(({ key, label, accent }) => {
        const checked = refs[key];
        const dimmed = isRefDimmed(refs, key);
        const classes = [
          'pill',
          `pill-${accent}`, // §8.1 tape / landmark accent family
          checked ? 'is-active' : '',
          dimmed ? 'dim' : '', // §9.1 unavailable-in-combination (never hidden)
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <button
            key={key}
            type="button"
            role="checkbox"
            aria-checked={checked}
            // Each ref is independently focusable (no roving tabindex). A dimmed
            // pill is non-interactive (§8.1 `pointer-events:none` + this guard so
            // keyboard activation can't bypass the dim) but is announced, not
            // removed — `aria-disabled` carries the unavailable state to AT.
            aria-disabled={dimmed}
            className={classes}
            onClick={() => {
              if (dimmed) return;
              onToggle(key);
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
