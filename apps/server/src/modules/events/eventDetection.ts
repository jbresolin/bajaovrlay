// The event detection: watches every accepted poll, compares each source's new snapshot
// with the one before it, and records what the detectors found through the one command
// path, as the actor sistema:eventos.
import type { DataSnapshotShapes, DataSource, DetectedEvent } from '@bajaovrlay/shared';

import type { ServerLogger } from '../../core/logger/createLogger.js';
import { eventInboxActor } from '../../core/store/commandActors.js';
import type { StateStore } from '../../core/store/createStateStore.js';
import { detectEventsBetweenSnapshots } from './detectors/detectEventsBetweenSnapshots.js';

/** What the detection needs: the store, the logger, and timers a test can run by hand. */
export type EventDetectionOptions = {
  stateStore: StateStore;
  logger: ServerLogger;
  startTimer?: ((onTimeIsUp: () => void, delayInMilliseconds: number) => unknown) | undefined;
  cancelTimer?: ((timerHandle: unknown) => void) | undefined;
};

/** The running detection; stop() stops watching and drops what was not sent yet. */
export type EventDetection = { stop: () => void };

/**
 * Starts the detection. It remembers, in memory only, each source's last snapshot since
 * it started watching it. The baseline rule: the first snapshot it sees of a source after
 * the server starts, after the source is turned on, or of a new source, is only
 * remembered, and fires nothing. It says what had already happened: a restart mid-race,
 * or a source turned on mid-race, must not replay the day's penalties. Every later
 * snapshot is compared with the remembered one (detectEventsBetweenSnapshots), dated by
 * its own receivedAtMs, and becomes the remembered one.
 * The events found are sent from a 0 ms timer, one recordDetectedEvents each (so each
 * writes its own event-log row), never from inside the store's listener: a command sent
 * while the store is still telling its listeners would run inside the one that changed
 * the snapshot. The inbox skips an id it already holds, so an event detected again after
 * a restart is never listed twice (the events slice is saved).
 * What could go wrong: a no-op poll (the same data on a healthy source) changes no
 * snapshot and is not seen; the next change is still compared with the last one seen.
 */
export function startEventDetection(options: EventDetectionOptions): EventDetection {
  const { stateStore, logger } = options;
  const startTimer = options.startTimer ?? startNodeTimer;
  const cancelTimer = options.cancelTimer ?? cancelNodeTimer;
  const lastShapesSeenBySourceId = new Map<string, DataSnapshotShapes>();
  let enabledSourceIds = listEnabledSourceIds(stateStore.readAllSlices().dataSources);
  let eventsToSend: DetectedEvent[] = [];
  let sendTimerHandle: unknown;

  /** Forgets the last snapshot of each source just turned on, so its next one is a baseline. */
  function forgetSourcesTurnedOn(dataSources: DataSource[]): void {
    const enabledSourceIdsNow = listEnabledSourceIds(dataSources);
    for (const sourceId of enabledSourceIdsNow) {
      if (!enabledSourceIds.has(sourceId)) {
        lastShapesSeenBySourceId.delete(sourceId);
      }
    }
    enabledSourceIds = enabledSourceIdsNow;
  }

  /** Records each event waiting, one command each; a refusal is logged, never thrown. */
  function sendTheEventsFound(): void {
    sendTimerHandle = undefined;
    const events = eventsToSend;
    eventsToSend = [];
    for (const event of events) {
      try {
        const outcome = stateStore.applyCommand(
          { type: 'recordDetectedEvents', events: [event] },
          eventInboxActor,
        );
        if (!outcome.ok) {
          logger.warn({ event_id: event.eventId, error: outcome.error }, 'detected event refused');
        }
      } catch (sendError) {
        logger.error({ err: sendError, event_id: event.eventId }, 'detected event not recorded');
      }
    }
  }

  const stopWatchingTheStore = stateStore.subscribeToSliceChanges(
    (changedSliceNames, slices, changedDataSnapshots) => {
      if (changedSliceNames.includes('dataSources')) {
        forgetSourcesTurnedOn(slices.dataSources);
      }
      for (const change of changedDataSnapshots) {
        if (change.snapshot === null) {
          lastShapesSeenBySourceId.delete(change.sourceId);
          continue;
        }
        const previousShapes = lastShapesSeenBySourceId.get(change.sourceId);
        lastShapesSeenBySourceId.set(change.sourceId, change.snapshot.shapes);
        if (previousShapes === undefined) {
          continue;
        }
        const events = detectEventsBetweenSnapshots(previousShapes, change.snapshot.shapes, {
          sourceId: change.sourceId,
          detectedAtMs: change.snapshot.receivedAtMs,
        });
        eventsToSend.push(...events);
      }
      if (eventsToSend.length > 0 && sendTimerHandle === undefined) {
        sendTimerHandle = startTimer(sendTheEventsFound, 0);
      }
    },
  );

  return {
    stop: () => {
      stopWatchingTheStore();
      if (sendTimerHandle !== undefined) {
        cancelTimer(sendTimerHandle);
      }
      eventsToSend = [];
    },
  };
}

/** The ids of the sources that are on, as a set. */
function listEnabledSourceIds(dataSources: DataSource[]): Set<string> {
  return new Set(
    dataSources.filter((dataSource) => dataSource.isEnabled).map((dataSource) => dataSource.id),
  );
}

/** The default startTimer: Node's setTimeout. */
function startNodeTimer(onTimeIsUp: () => void, delayInMilliseconds: number): unknown {
  return setTimeout(onTimeIsUp, delayInMilliseconds);
}

/** The default cancelTimer: Node's clearTimeout. */
function cancelNodeTimer(timerHandle: unknown): void {
  clearTimeout(timerHandle as ReturnType<typeof setTimeout>);
}
