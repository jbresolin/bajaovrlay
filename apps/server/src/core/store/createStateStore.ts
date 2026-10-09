import { randomUUID } from 'node:crypto';

import {
  type CommandError,
  CommandSchema,
  type EventLogEntry,
  type SliceName,
  type Slices,
} from '@bajaovrlay/shared';

import { saveCommandOutcome } from '../db/commandOutcomeStorage.js';
import type { SliceRow } from '../db/tables.js';
import { appendToEventLogSlice } from '../events/eventLogSlice.js';
import { allowEveryCommand, type IsCommandAllowed } from './authorizeCommand.js';
import { refuseInvalidCommand, refuseUnauthorizedCommand } from './commandRefusals.js';
import { loadInitialSlices, type LoadInitialSlicesOptions } from './loadInitialSlices.js';
import { reduceCommand } from './reducers/reduceCommand.js';
import type { SlicesChangedByCommands } from './reducers/reducerTypes.js';

/** What a store needs. The last three have production defaults; tests replace them. */
export type StateStoreOptions = LoadInitialSlicesOptions & {
  /** The authorisation step; defaults to allowEveryCommand (no login in M0). */
  isCommandAllowed?: IsCommandAllowed | undefined;
  /** The clock used for timestamps; defaults to the real time. */
  readCurrentTime?: (() => Date) | undefined;
  /** Makes the id of each new instance; defaults to a random UUID. */
  createInstanceId?: (() => string) | undefined;
};

/** How applyCommand answers: ok, or the error the operator is shown. */
export type CommandOutcome = { ok: true } | { ok: false; error: CommandError };

/** Called after every command with the names of the slices that changed, and all slices. */
export type SliceChangeListener = (changedSliceNames: SliceName[], slices: Slices) => void;

/** The store: the only holder of state and the only way to change it. */
export type StateStore = {
  /** Every slice as it is now. Treat the result as read-only. */
  readAllSlices: () => Slices;
  /** Runs one command through the single command path; see createStateStore. */
  applyCommand: (commandInput: unknown, actor: string) => CommandOutcome;
  /** Registers a listener for slice changes; returns a function that removes it. */
  subscribeToSliceChanges: (listener: SliceChangeListener) => () => void;
};

// The slices a reducer may change, in the order changes are reported.
const sliceNamesChangedByCommands = ['layers', 'graphics', 'instances'] as const;

/**
 * Creates the store, loading its slices from the database (or seeding an empty one).
 * applyCommand is the single code path for every change, always in this order:
 * validate → authorise → apply the pure reducer → save the changed slices and the
 * event-log row (one transaction) → update memory → tell listeners what changed.
 * A command that fails any step is still written to the event log, as failed.
 */
export function createStateStore(options: StateStoreOptions): StateStore {
  const isCommandAllowed = options.isCommandAllowed ?? allowEveryCommand;
  const readCurrentTime = options.readCurrentTime ?? (() => new Date());
  const createInstanceId = options.createInstanceId ?? (() => randomUUID());
  const listeners = new Set<SliceChangeListener>();
  let currentSlices = loadInitialSlices(options);

  function applyCommand(commandInput: unknown, actor: string): CommandOutcome {
    const now = readCurrentTime().toISOString();

    // Step 1, validate: the command's shape, with the first bad field named.
    const validation = CommandSchema.safeParse(commandInput);
    if (!validation.success) {
      const badFieldPath = validation.error.issues[0]?.path ?? [];
      const error = refuseInvalidCommand(badFieldPath);
      recordOutcome({
        nextSlices: currentSlices,
        logEntry: {
          ts: now,
          actor,
          command: readCommandNameAsSent(commandInput),
          // undefined has no JSON form; null keeps the "nothing was sent" meaning.
          payload: commandInput ?? null,
          result: { status: 'failed', error },
        },
      });
      return { ok: false, error };
    }
    const command = validation.data;

    // Step 2, authorise: a hook that says yes to everything until login exists.
    if (!isCommandAllowed(command, actor)) {
      const error = refuseUnauthorizedCommand();
      recordOutcome({
        nextSlices: currentSlices,
        logEntry: {
          ts: now,
          actor,
          command: command.type,
          payload: command,
          result: { status: 'failed', error },
        },
      });
      return { ok: false, error };
    }

    // Step 3, apply: the pure reducer, given the id and time it may need.
    const reducerOutcome = reduceCommand(currentSlices, command, {
      newInstanceId: createInstanceId(),
      now,
    });
    if (reducerOutcome.status === 'refused') {
      const error = reducerOutcome.error;
      recordOutcome({
        nextSlices: currentSlices,
        logEntry: {
          ts: now,
          actor,
          command: command.type,
          payload: command,
          result: { status: 'failed', error },
        },
      });
      return { ok: false, error };
    }

    // Steps 4 to 6: save, append to the event log, tell listeners.
    recordOutcome({
      nextSlices: reducerOutcome.slices,
      logEntry: {
        ts: now,
        actor,
        command: command.type,
        payload: command,
        result: { status: 'ok' },
      },
    });
    return { ok: true };
  }

  /**
   * Saves the slices that changed and the event-log row in one transaction, then (only
   * once that succeeded) updates memory and tells listeners. If saving throws, memory
   * is left as it was, so it never runs ahead of the database.
   */
  function recordOutcome(outcome: {
    nextSlices: SlicesChangedByCommands;
    logEntry: Omit<EventLogEntry, 'id'>;
  }): void {
    // A reducer returns an unchanged slice as the very same array.
    const changedSliceNames = sliceNamesChangedByCommands.filter(
      (sliceName) => outcome.nextSlices[sliceName] !== currentSlices[sliceName],
    );
    const changedSliceRows: SliceRow[] = changedSliceNames.map((sliceName) => ({
      name: sliceName,
      json: outcome.nextSlices[sliceName],
      updatedAt: outcome.logEntry.ts,
    }));

    const eventLogId = saveCommandOutcome(options.database, {
      changedSliceRows,
      eventLogRow: outcome.logEntry,
    });

    const savedLogEntry: EventLogEntry = { id: eventLogId, ...outcome.logEntry };
    currentSlices = {
      layers: outcome.nextSlices.layers,
      graphics: outcome.nextSlices.graphics,
      instances: outcome.nextSlices.instances,
      eventLog: appendToEventLogSlice(currentSlices.eventLog, savedLogEntry),
    };
    tellListeners([...changedSliceNames, 'eventLog']);
  }

  /** Calls every listener; one that throws is logged and does not stop the others. */
  function tellListeners(changedSliceNames: SliceName[]): void {
    for (const listener of listeners) {
      try {
        listener(changedSliceNames, currentSlices);
      } catch (listenerError) {
        options.logger.error({ err: listenerError }, 'a slice change listener failed');
      }
    }
  }

  return {
    readAllSlices: () => currentSlices,
    applyCommand,
    subscribeToSliceChanges: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** The `type` of whatever was sent, for the event log; `unknown` when it had none. */
function readCommandNameAsSent(commandInput: unknown): string {
  const isObjectWithType =
    typeof commandInput === 'object' && commandInput !== null && 'type' in commandInput;
  if (isObjectWithType && typeof commandInput.type === 'string' && commandInput.type !== '') {
    return commandInput.type;
  }
  return 'unknown';
}
