import type { ReducerOutcome, SlicesChangedByCommands } from './reducerTypes.js';

/**
 * clearAll: the panic button. Removes every instance on every layer and output,
 * including layers marked persistent: when the operator asks for a clean screen, the
 * screen must be clean.
 */
export function reduceClearAll(slices: SlicesChangedByCommands): ReducerOutcome {
  // Nothing on air: hand back the same array, so nothing is saved or broadcast.
  if (slices.instances.length === 0) {
    return { status: 'applied', slices };
  }
  return { status: 'applied', slices: { ...slices, instances: [] } };
}
