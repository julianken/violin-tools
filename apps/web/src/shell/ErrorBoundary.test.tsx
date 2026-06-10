import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ErrorBoundary } from './ErrorBoundary.tsx';

// ErrorBoundary is the app-level crash net: its whole job is preventing a
// whole-app white screen when a JS runtime error escapes a child's render. jsdom
// DOES catch a render throw and renders the class boundary's fallback (it just
// doesn't paint, and these assertions don't need paint), so the fallback path is
// exercisable as a plain unit test — no e2e, no monkey-patching React.

/** A child that throws on render — the realistic bundle/runtime failure. */
function ThrowingChild(): never {
  throw new Error('boom');
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ErrorBoundary', () => {
  it('renders its children unchanged on the happy path (no error)', () => {
    render(
      <ErrorBoundary>
        <p>all good</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('all good')).toBeInTheDocument();
    // No crash fallback when nothing threw.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders the role="alert" crash fallback when a child throws on render', () => {
    // React logs the caught error to console.error; suppress that expected noise so
    // the test output stays clean, and assert componentDidCatch's own log fired.
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    // The crash <main> carries the heading + the reload guidance paragraph.
    expect(
      screen.getByRole('heading', { level: 1, name: 'Something went wrong' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/reload the page to try again/i)).toBeInTheDocument();

    // componentDidCatch surfaced the crash to the console (its diagnostic log).
    expect(errorSpy).toHaveBeenCalledWith(
      'Violin Tools crashed:',
      expect.any(Error),
      expect.anything(),
    );
  });

  it('getDerivedStateFromError flips hasError so the next render shows the fallback', () => {
    expect(ErrorBoundary.getDerivedStateFromError()).toEqual({ hasError: true });
  });
});
