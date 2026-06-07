import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App.tsx';
// Design-token surface (DESIGN.md §0). tokens.css declares the 3-tier custom
// properties + the reduced-motion gate; typography.css declares the self-hosted
// @font-face faces + the type tokens. Imported here so the token layer loads
// once at the app root for every later surface (S3+) to consume by name.
import './styles/tokens.css';
import './styles/typography.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
