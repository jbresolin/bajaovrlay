import type { CommandError, Slices } from '@bajaovrlay/shared';

/**
 * The slices a command may change. The event log is not among them: the store appends
 * to it itself, after a command that changed one of these slices or was refused. A
 * command that is accepted and changes nothing leaves no entry.
 */
export type SlicesChangedByCommands = Pick<
  Slices,
  'layers' | 'graphics' | 'instances' | 'rundowns' | 'items'
>;

/**
 * Everything a reducer needs that is not pure: made by the store before calling it, so
 * a reducer never reads the clock or generates ids itself.
 */
export type ReducerContext = {
  /** The id to give an instance the command creates. */
  newInstanceId: string;
  /** The current time, as an ISO 8601 timestamp. */
  now: string;
  /** The id to give an item the command creates (createItem). */
  newItemId: string;
};

/**
 * What a reducer decides: the new slices (a slice it did not change is returned as the
 * very same array, so the store can tell what changed), or a refusal with its reason.
 */
export type ReducerOutcome =
  | { status: 'applied'; slices: SlicesChangedByCommands }
  | { status: 'refused'; error: CommandError };
