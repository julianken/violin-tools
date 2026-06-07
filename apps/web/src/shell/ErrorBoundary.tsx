import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

// Top-level React error boundary. The realistic failure for a no-network static
// client app is a JS bundle/runtime error, which otherwise white-screens the
// whole page; DESIGN.md's per-component coverage does not address the app-level
// net. A boundary must be a class component — React has no hook equivalent for
// componentDidCatch / getDerivedStateFromError. The fallback is intentionally
// minimal and token-styled (no shell chrome, since the shell itself may be the
// thing that threw).

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface the error to the console so a crash is diagnosable rather than
    // silent. `console.error` is allowed by the no-console rule (only log/info
    // are banned in app src).
    console.error('Violin Tools crashed:', error, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <main className="crash" role="alert">
          <h1>Something went wrong</h1>
          <p>Violin Tools hit an unexpected error. Reload the page to try again.</p>
        </main>
      );
    }
    return this.props.children;
  }
}
