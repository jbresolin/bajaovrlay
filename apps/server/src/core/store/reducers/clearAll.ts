import type { ReducerOutcome, SlicesChangedByCommands } from './reducerTypes.js';

/**
 * clearAll: the panic button. Removes every instance on every layer and output,
 * including layers marked persistent: when the operator asks for a clean screen, the
 * screen must be clean.
 */
export function reduceClearAll(slices: SlicesChangedByCommands): ReducerOutcome {
  return { status: 'applied', slices: { ...slices, instances: [] } };
}
