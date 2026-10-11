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
import { allowCommandForActorRole, type IsCommandAllowed } from './authorizeCommand.js';
import { refuseCommandNotAllowed, refuseInvalidCommand } from './commandRefusals.js';
import { loadInitialSlices, type LoadInitialSlicesOptions } from './loadInitialSlices.js';
import { reduceCommand } from './reducers/reduceCommand.js';
import type { SlicesChangedByCommands } from './reducers/reducerTypes.js';

/** What a store needs. The last three have production defaults; tests replace them. */
export type StateStoreOptions = Omit<LoadInitialSlicesOptions, 'readCurrentTime'> & {
  /** The authorisation step; defaults to allowCommandForActorRole (no login yet). */
  isCommandAllowed?: IsCommandAllowed | undefined;
  /** The clock used for every timestamp, at boot and per command; defaults to real time. */
  readCurrentTime?: (() => Date) | undefined;
  /** Makes the id of each new instance; defaults to a random UUID. */
  createInstanceId?: (() => string) | undefined;
};

/** How applyCommand answers: ok, or the error the operator is shown. */
export type CommandOutcome = { ok: true } | { ok: false; error: CommandError };

/**
 * Called after every command that changed a slice or was refused (so the event log
 * changed), with the names of the slices that changed, and all slices.
 */
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
 * Its applyCommand is the single code path for every change; see the steps inside.
 */
export function createStateStore(options: StateStoreOptions): StateStore {
  const isCommandAllowed = options.isCommandAllowed ?? allowCommandForActorRole;
  const readCurrentTime = options.readCurrentTime ?? (() => new Date());
  const createInstanceId = options.createInstanceId ?? (() => randomUUID());
  const listeners = new Set<SliceChangeListener>();
  let currentSlices = loadInitialSlices({ ...options, readCurrentTime });

  // Always in this order: validate → authorise → apply the pure reducer → save the
  // changed slices and the event-log row (one transaction) → update memory → tell
  // listeners what changed. A command that fails any step is still logged, as failed.
  // An accepted command that changes nothing skips the save, the log and the listeners.
  function applyCommand(commandInput: unknown, actor: string): CommandOutcome {
    const now = readCurrentTime().toISOString();

    // Step 1, validate: the command's shape, with the first bad field named.
    const validation = CommandSchema.safeParse(commandInput);
    if (!validation.success) {
      const badFieldPath = validation.error.issues[0]?.path ?? [];
      return recordRefusal({
        now,
        actor,
        commandName: readCommandNameAsSent(commandInput),
        payload: describePayloadAsReceived(commandInput),
        error: refuseInvalidCommand(badFieldPath),
      });
    }
    const command = validation.data;

    // Step 2, authorise: the hook decides whether this actor may run this command.
    if (!isCommandAllowed(command, actor)) {
      return recordRefusal({
        now,
        actor,
        commandName: command.type,
        payload: command,
        error: refuseCommandNotAllowed(),
      });
    }

    // Step 3, apply: the pure reducer, given the id and time it may need.
    const reducerOutcome = reduceCommand(currentSlices, command, {
      newInstanceId: createInstanceId(),
      now,
    });
    if (reducerOutcome.status === 'refused') {
      return recordRefusal({
        now,
        actor,
        commandName: command.type,
        payload: command,
        error: reducerOutcome.error,
      });
    }

    // An accepted command that changed nothing (a second renderer reporting the same
    // instance on air, a clear of a stage that is already empty) stops here: nothing is
    // saved, no event-log row is written and no listener is told, so nothing is
    // broadcast. The sender still gets its ok. João's ruling, 2026-10-10.
    // What could go wrong: the event log no longer shows that such a command was sent
    // at all, so "did the second renderer ever report?" cannot be answered from it.
    const isAnySliceChanged = findNamesOfChangedSlices(reducerOutcome.slices).length > 0;
    if (!isAnySliceChanged) {
      return { ok: true };
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
   * Logs a refused command as failed, leaving every slice as it was, and returns the
   * answer the operator is shown. Used by the validate, authorise and apply steps.
   */
  function recordRefusal(refusal: {
    now: string;
    actor: string;
    commandName: string;
    payload: unknown;
    error: CommandError;
  }): CommandOutcome {
    recordOutcome({
      nextSlices: currentSlices,
      logEntry: {
        ts: refusal.now,
        actor: refusal.actor,
        command: refusal.commandName,
        payload: refusal.payload,
        result: { status: 'failed', error: refusal.error },
      },
    });
    return { ok: false, error: refusal.error };
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
    const changedSliceNames = findNamesOfChangedSlices(outcome.nextSlices);
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

  /**
   * Names the slices a reducer changed. A reducer hands back an unchanged slice as the
   * very same array, so comparing the two arrays themselves is enough.
   * What could go wrong: a reducer that builds a new array with equal contents (an
   * updateInstanceData that sends the values already on air) counts as a change, so it is
   * saved, logged and broadcast although nothing on screen moves.
   */
  function findNamesOfChangedSlices(
    nextSlices: SlicesChangedByCommands,
  ): Array<keyof SlicesChangedByCommands> {
    return sliceNamesChangedByCommands.filter(
      (sliceName) => nextSlices[sliceName] !== currentSlices[sliceName],
    );
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

/**
 * What the event log stores as the payload of an invalid command: what was sent, or a
 * marker when nothing was. event_log.payload is NOT NULL and Drizzle writes a JS null as
 * SQL NULL, so storing null or undefined would make the save throw and lose the row.
 */
function describePayloadAsReceived(commandInput: unknown): unknown {
  if (commandInput === null || commandInput === undefined) {
    return { commandWasMissing: true };
  }
  return commandInput;
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
