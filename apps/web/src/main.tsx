import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App.tsx';
// Design-token surface (DESIGN.md §0). tokens.css declares the 3-tier custom
// properties + the reduced-motion gate; typography.css declares the self-hosted
// @font-face faces + the type tokens. Imported here so the token layer loads
// once at the app root for every later surface (S3+) to consume by name.
import './styles/tokens.css';
import './styles/typography.css';
// §8 / §11 accessibility layer (S10): the custom {mint} :focus-visible ring, the
// 44px touch-target hit-padding, and the .sr-only / live-region visual hiding.
// Loaded at the root so the focus/hit-padding contract applies to every surface.
import './styles/a11y.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
