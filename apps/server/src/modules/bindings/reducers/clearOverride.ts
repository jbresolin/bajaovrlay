import { type ClearOverrideCommand, doesOverrideHaveKey } from '@bajaovrlay/shared';

import type {
  ReducerOutcome,
  SlicesChangedByCommands,
} from '../../../core/store/reducers/reducerTypes.js';

/**
 * clearOverride ("Remover correção"): removes the correction of its key, so the source's
 * own value goes back on air at once wherever it is bound (the refresher rewrites the
 * instances). Clearing a correction that is not there hands back the same slices: it is
 * answered ok and leaves no trace, as a second press by another operator would.
 */
export function reduceClearOverride(
  slices: SlicesChangedByCommands,
  command: ClearOverrideCommand,
): ReducerOutcome {
  const overridesKept = slices.overrides.filter((stored) => !doesOverrideHaveKey(stored, command));
  if (overridesKept.length === slices.overrides.length) {
    return { status: 'applied', slices };
  }
  return { status: 'applied', slices: { ...slices, overrides: overridesKept } };
}
