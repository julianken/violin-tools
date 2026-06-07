// useControls — the React adapter over the pure controls reducers (controls.ts).
//
// One `useReducer` holds the single `(root, scale, refs)` source of truth; every
// control dispatches a typed action and the map re-derives + re-renders from the
// new state. Keeping the reducer pure (in controls.ts) means the state logic is
// unit-testable without React, and the hook is a thin binding.

import { type Root, type ScaleType } from '@violin-tools/theory';
import { useReducer } from 'react';

import {
  INITIAL_CONTROLS,
  setRoot,
  setScale,
  toggleRef,
  type ControlsState,
  type RefKey,
} from './controls.ts';

/** The discriminated action union the reducer accepts. */
type ControlsAction =
  | { type: 'setRoot'; root: Root }
  | { type: 'setScale'; scale: ScaleType }
  | { type: 'toggleRef'; key: RefKey };

function reducer(state: ControlsState, action: ControlsAction): ControlsState {
  switch (action.type) {
    case 'setRoot':
      return setRoot(state, action.root);
    case 'setScale':
      return setScale(state, action.scale);
    case 'toggleRef':
      return toggleRef(state, action.key);
  }
}

/** The hook's return shape: the current state plus the three typed mutators. */
export interface ControlsApi {
  state: ControlsState;
  selectRoot: (root: Root) => void;
  selectScale: (scale: ScaleType) => void;
  toggleRef: (key: RefKey) => void;
}

/**
 * Hold the controls state and expose narrow mutators. The mutators are stable
 * for the component's lifetime (the `dispatch` identity is), so passing them down
 * to the row components does not churn their referential identity.
 */
export function useControls(): ControlsApi {
  const [state, dispatch] = useReducer(reducer, INITIAL_CONTROLS);
  return {
    state,
    selectRoot: (root) => {
      dispatch({ type: 'setRoot', root });
    },
    selectScale: (scale) => {
      dispatch({ type: 'setScale', scale });
    },
    toggleRef: (key) => {
      dispatch({ type: 'toggleRef', key });
    },
  };
}
