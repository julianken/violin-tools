import { AppShell } from './shell/AppShell';
import { ErrorBoundary } from './shell/ErrorBoundary';
import './shell/shell.css';

// The application root: the §9 app shell, wrapped in a top-level error boundary
// so a render/runtime error shows a minimal fallback instead of a blank page.
// The shell is the structural frame every later v1 surface plugs into (S5 fills
// the note-map plate, S6 the controls rows, etc.) — S3 ships the empty, ordered,
// accessible frame only. Tokens come from tokens.css / typography.css (imported
// in main.tsx); shell.css consumes them by name.
export default function App() {
  return (
    <ErrorBoundary>
      <AppShell />
    </ErrorBoundary>
  );
}
