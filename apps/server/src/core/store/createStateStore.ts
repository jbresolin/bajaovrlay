import { randomUUID } from 'node:crypto';

import {
  type CommandError,
  CommandSchema,
  type EventLogEntry,
  type SliceName,
  type Slices,
} from '@bajaovrlay/shared';

import {
  noSourceHostAllowlist,
  type SourceHostAllowlist,
} from '../../modules/dataSources/index.js';
import {
  saveCommandOutcome,
  saveCommandOutcomeWithoutEventLogRow,
} from '../db/commandOutcomeStorage.js';
import { appendToEventLogSlice } from '../events/eventLogSlice.js';
import { allowCommandForActorRole, type IsCommandAllowed } from './authorizeCommand.js';
import {
  buildEventLogPayloadOfCommand,
  describePayloadAsReceived,
  readCommandNameAsSent,
} from './commandEventLogPayload.js';
import { refuseCommandNotAllowed, refuseInvalidCommand } from './commandRefusals.js';
import {
  buildRowChangesOfDataSnapshots,
  type DataSnapshotChange,
  findChangedDataSnapshots,
} from './dataSnapshotChanges.js';
import { loadInitialSlices, type LoadInitialSlicesOptions } from './loadInitialSlices.js';
import { reduceCommand } from './reducers/reduceCommand.js';
import type { SlicesChangedByCommands } from './reducers/reducerTypes.js';
import {
  buildAllSlices,
  buildRowsOfChangedSlicesToSave,
  sliceNamesChangedByCommands,
} from './storeSliceSaving.js';

/** What a store needs. The last eight have production defaults; tests replace them. */
export type StateStoreOptions = Omit<LoadInitialSlicesOptions, 'readCurrentTime'> & {
  /** The authorisation step; defaults to allowCommandForActorRole (no login yet). */
  isCommandAllowed?: IsCommandAllowed | undefined;
  /** The clock used for every timestamp, at boot and per command; defaults to real time. */
  readCurrentTime?: (() => Date) | undefined;
  /** Makes the id of each new instance; defaults to a random UUID. */
  createInstanceId?: (() => string) | undefined;
  /** Makes the id of each new item (createItem); defaults to a random UUID. */
  createItemId?: (() => string) | undefined;
  /** Makes the id of each new quick-fire panel; defaults to a random UUID. */
  createQuickFirePanelId?: (() => string) | undefined;
  /** Makes the id of each new macro (createMacro); defaults to a random UUID. */
  createMacroId?: (() => string) | undefined;
  /** Makes the id of each new data source (createDataSource); defaults to a random UUID. */
  createDataSourceId?: (() => string) | undefined;
  /** Makes the id of each event the operator types (createManualEvent); a random UUID. */
  createEventId?: (() => string) | undefined;
  /** BAJAOVRLAY_SOURCE_ALLOWED_HOSTS as read at boot, for the reducers; no list by default. */
  sourceHostAllowlist?: SourceHostAllowlist | undefined;
};

/**
 * How applyCommand answers: ok, or the error the operator is shown. An accepted
 * createItem also names the item it made (`createdItemId`), so the page can take or
 * preview that item next ("Salvar e disparar", BAJAOVRLAY-37).
 */
export type CommandOutcome =
  { ok: true; createdItemId?: string } | { ok: false; error: CommandError };

/**
 * Called after every command that changed a slice or was refused, with the names of the
 * slices that changed (the event log among them, except after a routine data-source
 * poll or a recording's progress, which are left out of it), all slices, and, source by
 * source, the snapshots that changed (empty unless `dataSnapshots` is among the names).
 * The hub sends each of those as its own `dataSnapshot` message (BAJAOVRLAY-40).
 */
export type SliceChangeListener = (
  changedSliceNames: SliceName[],
  slices: Slices,
  changedDataSnapshots: DataSnapshotChange[],
) => void;

/** The store: the only holder of state and the only way to change it. */
export type StateStore = {
  /** Every slice as it is now. Treat the result as read-only. */
  readAllSlices: () => Slices;
  /** Runs one command through the single command path; see createStateStore. */
  applyCommand: (commandInput: unknown, actor: string) => CommandOutcome;
  /** Registers a listener for slice changes; returns a function that removes it. */
  subscribeToSliceChanges: (listener: SliceChangeListener) => () => void;
};

/**
 * Creates the store, loading its slices from the database (or seeding an empty one).
 * Its applyCommand is the single code path for every change; see the steps inside.
 */
export function createStateStore(options: StateStoreOptions): StateStore {
  const isCommandAllowed = options.isCommandAllowed ?? allowCommandForActorRole;
  const readCurrentTime = options.readCurrentTime ?? (() => new Date());
  const createInstanceId = options.createInstanceId ?? (() => randomUUID());
  const createItemId = options.createItemId ?? (() => randomUUID());
  const createQuickFirePanelId = options.createQuickFirePanelId ?? (() => randomUUID());
  const createMacroId = options.createMacroId ?? (() => randomUUID());
  const createDataSourceId = options.createDataSourceId ?? (() => randomUUID());
  const createEventId = options.createEventId ?? (() => randomUUID());
  const sourceHostAllowlist = options.sourceHostAllowlist ?? noSourceHostAllowlist;
  const listeners = new Set<SliceChangeListener>();
  let currentSlices = loadInitialSlices({ ...options, readCurrentTime });

  // Always in this order: validate → authorise → apply the pure reducer → save the
  // changed slices and the event-log row (one transaction) → update memory → tell
  // listeners what changed. A command that fails any step is still logged, as failed.
  // An accepted command that changes nothing skips the save, the log and the listeners;
  // a routine data-source poll, a recording's progress and a routine refresh of bound
  // fields skip only the log (see the exception below).
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
        payload: buildEventLogPayloadOfCommand(command),
        error: refuseCommandNotAllowed(),
      });
    }

    // Step 3, apply: the pure reducer, given the ids, time and boot facts it may need.
    const reducerContext = {
      newInstanceId: createInstanceId(),
      now,
      actor,
      newItemId: createItemId(),
      newQuickFirePanelId: createQuickFirePanelId(),
      newMacroId: createMacroId(),
      newDataSourceId: createDataSourceId(),
      newEventId: createEventId(),
      sourceHostAllowlist,
    };
    const reducerOutcome = reduceCommand(currentSlices, command, reducerContext);
    if (reducerOutcome.status === 'refused') {
      return recordRefusal({
        now,
        actor,
        commandName: command.type,
        payload: buildEventLogPayloadOfCommand(command),
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
    // A step the command's new data no longer has was moved by the reducer itself: the
    // event-log row names only the command, so this line says which step moved and why.
    for (const stepBroughtBack of reducerOutcome.stepsBroughtBack ?? []) {
      options.logger.info(
        {
          command: command.type,
          instance_id: stepBroughtBack.instanceId,
          step_before: stepBroughtBack.stepBefore,
          step_after: stepBroughtBack.stepAfter,
        },
        'instance brought back to the last step its data has',
      );
    }

    // The one exception to "every command is logged" (decision D11): a data-source poll
    // that left its source's health as it was (the reducer says so) is saved and
    // broadcast, but writes no event-log row. A poll arrives every two seconds per
    // source; logging each would bury the operator's history under thousands of rows a
    // day. What could go wrong: the log cannot say when each routine poll happened; the
    // source's status (lastOkAtMs) and the server's own log lines carry that instead.
    // The recorder's count of written lines (recordRecordingProgress) follows each poll
    // of a recording source, so it is left out the same way (gate 2 on PR #16), and so is
    // a refresh of an instance's live bound fields, which follows a poll (BAJAOVRLAY-20).
    // A refresh of bound fields that begins a spell of refusals (part of it, or all of
    // it, refused by the graphic's schema) is applied as far as it fits and logged as
    // failed, once per spell: the spell is the refused keys on the instance's entry of
    // instanceBindings, so it survives a restart (gate 2 of PR #18).
    if (reducerOutcome.refusalWrittenToTheEventLog !== undefined) {
      recordOutcome({
        nextSlices: reducerOutcome.slices,
        logEntry: {
          ts: now,
          actor,
          command: command.type,
          payload: buildEventLogPayloadOfCommand(command),
          result: { status: 'failed', error: reducerOutcome.refusalWrittenToTheEventLog },
        },
      });
      return { ok: true };
    }
    if (reducerOutcome.isLeftOutOfTheEventLog === true) {
      recordOutcomeWithoutEventLogRow(reducerOutcome.slices, now);
      return { ok: true };
    }

    // Steps 4 to 6: save, append to the event log, tell listeners.
    recordOutcome({
      nextSlices: reducerOutcome.slices,
      logEntry: {
        ts: now,
        actor,
        command: command.type,
        payload: buildEventLogPayloadOfCommand(command),
        result: { status: 'ok' },
      },
    });
    // A createItem that was applied made exactly one item, with the id it was handed.
    if (command.type === 'createItem') {
      return { ok: true, createdItemId: reducerContext.newItemId };
    }
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
   * Saves the slices that changed, the rows of the snapshots that changed and the
   * event-log row in one transaction, then (only once that succeeded) updates memory and
   * tells listeners. If saving throws, memory is left as it was, so it never runs ahead
   * of the database. A slice kept in memory only (previewClearedLayerIds, macroRuns,
   * recordings) is not saved, but its change is still logged and broadcast.
   */
  function recordOutcome(outcome: {
    nextSlices: SlicesChangedByCommands;
    logEntry: Omit<EventLogEntry, 'id'>;
  }): void {
    const changedSliceNames = findNamesOfChangedSlices(outcome.nextSlices);
    const changedSliceRows = buildRowsOfChangedSlicesToSave(
      outcome.nextSlices,
      changedSliceNames,
      outcome.logEntry.ts,
    );
    const changedDataSnapshots = findChangedDataSnapshots(
      currentSlices.dataSnapshots,
      outcome.nextSlices.dataSnapshots,
    );

    const eventLogId = saveCommandOutcome(options.database, {
      changedSliceRows,
      dataSnapshotRowChanges: buildRowChangesOfDataSnapshots(
        changedDataSnapshots,
        outcome.logEntry.ts,
      ),
      eventLogRow: outcome.logEntry,
    });

    const savedLogEntry: EventLogEntry = { id: eventLogId, ...outcome.logEntry };
    const eventLog = appendToEventLogSlice(currentSlices.eventLog, savedLogEntry);
    currentSlices = buildAllSlices(outcome.nextSlices, eventLog);
    tellListeners([...changedSliceNames, 'eventLog'], changedDataSnapshots);
  }

  /**
   * Like recordOutcome, for a routine data-source poll or a recording's progress: saves
   * the changed slices (none for a progress: `recordings` is kept in memory only) in one
   * transaction with no event-log row, then (only once that succeeded) updates memory and
   * tells listeners, without 'eventLog' because it did not change.
   */
  function recordOutcomeWithoutEventLogRow(nextSlices: SlicesChangedByCommands, now: string): void {
    const changedSliceNames = findNamesOfChangedSlices(nextSlices);
    const changedSliceRows = buildRowsOfChangedSlicesToSave(nextSlices, changedSliceNames, now);
    const changedDataSnapshots = findChangedDataSnapshots(
      currentSlices.dataSnapshots,
      nextSlices.dataSnapshots,
    );
    saveCommandOutcomeWithoutEventLogRow(options.database, {
      changedSliceRows,
      dataSnapshotRowChanges: buildRowChangesOfDataSnapshots(changedDataSnapshots, now),
    });
    currentSlices = buildAllSlices(nextSlices, currentSlices.eventLog);
    tellListeners(changedSliceNames, changedDataSnapshots);
  }

  /**
   * Names the slices a reducer changed. A reducer hands back an unchanged slice as the
   * very same array, so comparing the two arrays themselves is enough.
   * What could go wrong: a reducer that builds a new array with equal contents counts as
   * a change here, so it would be saved, logged and broadcast although nothing on screen
   * moves. Each reducer therefore compares by content where a command can repeat what is
   * already there (updateInstanceData, updateItemFields) and hands back the same slices.
   */
  function findNamesOfChangedSlices(
    nextSlices: SlicesChangedByCommands,
  ): Array<keyof SlicesChangedByCommands> {
    return sliceNamesChangedByCommands.filter(
      (sliceName) => nextSlices[sliceName] !== currentSlices[sliceName],
    );
  }

  /** Calls every listener; one that throws is logged and does not stop the others. */
  function tellListeners(
    changedSliceNames: SliceName[],
    changedDataSnapshots: DataSnapshotChange[],
  ): void {
    for (const listener of listeners) {
      try {
        listener(changedSliceNames, currentSlices, changedDataSnapshots);
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
