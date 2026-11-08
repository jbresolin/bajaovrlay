import type {
  ReducerOutcome,
  SlicesChangedByCommands,
} from '../../../core/store/reducers/reducerTypes.js';

/**
 * recordBackup: a zip the backup download sent whole. It changes no slice: its event-log
 * row is the record of the copy, and "Última cópia" reads it from there, so it asks the
 * store to write the row although nothing changed. The command itself is not read here:
 * everything it carries goes into that row as its payload.
 */
export function reduceRecordBackup(slices: SlicesChangedByCommands): ReducerOutcome {
  return { status: 'applied', slices, isLoggedWithoutAChange: true };
}
