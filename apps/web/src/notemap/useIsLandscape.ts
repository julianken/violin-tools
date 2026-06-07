// Subscribe to the viewport orientation via matchMedia, with a synchronous initial
// read so the first render is correct (no post-paint flip). useSyncExternalStore is
// the React-19-correct way to read an external (media-query) source.

import { useSyncExternalStore } from 'react';

const QUERY = '(orientation: landscape)';

function noop(): void {
  return;
}

function subscribe(onChange: () => void): () => void {
  if (typeof matchMedia !== 'function') return noop;
  const mql = matchMedia(QUERY);
  mql.addEventListener('change', onChange);
  return () => { mql.removeEventListener('change', onChange); };
}

function getSnapshot(): boolean {
  return typeof matchMedia === 'function' ? matchMedia(QUERY).matches : false;
}

/** `true` when the viewport is landscape; updates on device rotation / resize. */
export function useIsLandscape(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
