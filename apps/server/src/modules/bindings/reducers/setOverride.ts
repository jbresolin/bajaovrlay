import {
  doesOverrideHaveKey,
  findProblemInOverrideValue,
  type Override,
  type SetOverrideCommand,
} from '@bajaovrlay/shared';

import { ptBR } from '../../../core/messages/ptBR.js';
import type {
  ReducerContext,
  ReducerOutcome,
  SlicesChangedByCommands,
} from '../../../core/store/reducers/reducerTypes.js';

/**
 * setOverride ("Corrigir valor…", "Corrigir valor da fonte…"): stores an operator's
 * correction of one value of a source, signed with the actor and the command's moment,
 * in place of a correction of the same key (source, scope, field, car), or at the end
 * when it is new. Refused when the source does not exist (DATA_SOURCE_NOT_FOUND) or the
 * value does not fit the canonical field (INVALID_OVERRIDE_VALUE, naming the field), so a
 * correction can only put on air what a source could have sent. The refresher then
 * rewrites every bound instance on air at once (modules/bindings/liveRefresher.ts).
 * Deliberate: the slice is kept in the order corrections were first set, so a page lists
 * them in a stable order while one is corrected again.
 */
export function reduceSetOverride(
  slices: SlicesChangedByCommands,
  command: SetOverrideCommand,
  context: ReducerContext,
): ReducerOutcome {
  const sourceExists = slices.dataSources.some((dataSource) => dataSource.id === command.sourceId);
  if (!sourceExists) {
    return {
      status: 'refused',
      error: {
        code: 'DATA_SOURCE_NOT_FOUND',
        message: ptBR.dataSourceErrors.dataSourceNotFound(command.sourceId),
      },
    };
  }
  const problemInValue = findProblemInOverrideValue(command.scope, command.field, command.value);
  if (problemInValue !== undefined) {
    return {
      status: 'refused',
      error: { code: 'INVALID_OVERRIDE_VALUE', message: problemInValue },
    };
  }

  const override = buildOverrideFromCommand(command, context);
  const isReplacingOne = slices.overrides.some((stored) => doesOverrideHaveKey(stored, command));
  const overridesAfter = isReplacingOne
    ? slices.overrides.map((stored) => (doesOverrideHaveKey(stored, command) ? override : stored))
    : [...slices.overrides, override];
  return { status: 'applied', slices: { ...slices, overrides: overridesAfter } };
}

/**
 * The stored override of a command. The command schema already checked that a car
 * correction names a car field and its car, and a session one a session field and no car.
 */
function buildOverrideFromCommand(command: SetOverrideCommand, context: ReducerContext): Override {
  const signature = { setBy: context.actor, setAt: context.now };
  if (command.scope === 'car') {
    return {
      sourceId: command.sourceId,
      scope: 'car',
      carNumber: command.carNumber ?? 0,
      field: command.field as Extract<Override, { scope: 'car' }>['field'],
      value: command.value,
      reason: command.reason,
      ...signature,
    };
  }
  return {
    sourceId: command.sourceId,
    scope: 'session',
    field: command.field as Extract<Override, { scope: 'session' }>['field'],
    value: command.value,
    reason: command.reason,
    ...signature,
  };
}
