import { Content } from './Content';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

// The §9 app shell: a flex row of `.side` (the fixed rail) and `.main` (the
// fluid column). The DOM matches the §9 tree exactly — `.app` → `.side` /
// `.main`, with `.main` → `.topbar` / `.content` (DESIGN.md §9). No CSS grid is
// used anywhere in the layout (§4); the only `inline-grid` in the product is the
// theme toggle's single-glyph icon slot (`.t-icon-swap`, see shell.css).

export function AppShell() {
  return (
    <div className="app">
      {/* Skip link to the map slot (DESIGN.md §11.3). Visually hidden until
          focused; the UA focus ring is preserved (S10 styles the {mint} ring). */}
      <a className="skip-link" href="#board">
        Skip to note map
      </a>
      <Sidebar />
      <div className="main">
        <Topbar />
        <Content />
      </div>
    </div>
  );
}
