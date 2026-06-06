import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App.tsx';

// Day-one non-vacuous test: render the placeholder app and assert visible text.
// This proves the React render path and the jsdom Vitest environment work end to
// end, so the `test` gate exercises a real suite from the foundation onward.
describe('App', () => {
  it('renders the Violin Tools heading', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: 'Violin Tools' })).toBeInTheDocument();
  });
});
