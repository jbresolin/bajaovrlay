// The event detection: watches every accepted poll, compares each source's new snapshot
// with the one before it, and records what the detectors found through the one command
// path, as the actor sistema:eventos.
import type { DataSnapshotShapes, DataSource, DetectedEvent } from '@bajaovrlay/shared';

import type { ServerLogger } from '../../core/logger/createLogger.js';
import { eventInboxActor } from '../../core/store/commandActors.js';
import type { StateStore } from '../../core/store/createStateStore.js';
import {
  detectEventsBetweenSnapshots,
  detectEventsInAFirstSnapshot,
} from './detectors/detectEventsBetweenSnapshots.js';

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
 * Starts the detection. It remembers, in memory, each source's last snapshot, starting
 * from the snapshots saved before the server stopped: after a restart the first poll is
 * compared with the last one saved, so what happened while the server was down arrives
 * (João's call at gate 2 of PR #22, replacing the first rule of BAJAOVRLAY-44), and the
 * inbox skips the ids it already holds, so nothing listed before is listed again. The
 * baseline rule: the first snapshot of a source never polled before, of a source just
 * turned on, or of a source whose config changed (another race, another mapping, which
 * could list the whole day as new), is only remembered, and fires nothing but the Super
 * Chats of its last 15 minutes (BAJAOVRLAY-35, detectors/newSuperChat.ts). Every later
 * snapshot is compared with the remembered one (detectEventsBetweenSnapshots), dated by
 * its own receivedAtMs, and becomes the remembered one. A saved snapshot of another
 * session (yesterday's race) is a baseline too, by the detectors' own session rule.
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
  const slicesAtStart = stateStore.readAllSlices();
  const lastShapesSeenBySourceId = new Map<string, DataSnapshotShapes>(
    slicesAtStart.dataSnapshots.map((snapshot) => [snapshot.sourceId, snapshot.shapes]),
  );
  let enabledSourceIds = listEnabledSourceIds(slicesAtStart.dataSources);
  let configTextBySourceId = writeConfigTextOfEachSource(slicesAtStart.dataSources);
  let eventsToSend: DetectedEvent[] = [];
  let sendTimerHandle: unknown;

  /**
   * Forgets the last snapshot of each source just turned on, or whose config changed, so
   * its next one is a baseline.
   */
  function forgetSourcesTurnedOnOrChanged(dataSources: DataSource[]): void {
    const enabledSourceIdsNow = listEnabledSourceIds(dataSources);
    const configTextBySourceIdNow = writeConfigTextOfEachSource(dataSources);
    for (const [sourceId, configText] of configTextBySourceIdNow) {
      const wasTurnedOn = enabledSourceIdsNow.has(sourceId) && !enabledSourceIds.has(sourceId);
      const hasConfigChanged = configTextBySourceId.get(sourceId) !== configText;
      if (wasTurnedOn || hasConfigChanged) {
        lastShapesSeenBySourceId.delete(sourceId);
      }
    }
    enabledSourceIds = enabledSourceIdsNow;
    configTextBySourceId = configTextBySourceIdNow;
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
        forgetSourcesTurnedOnOrChanged(slices.dataSources);
      }
      for (const change of changedDataSnapshots) {
        if (change.snapshot === null) {
          lastShapesSeenBySourceId.delete(change.sourceId);
          continue;
        }
        const previousShapes = lastShapesSeenBySourceId.get(change.sourceId);
        lastShapesSeenBySourceId.set(change.sourceId, change.snapshot.shapes);
        const moment = {
          sourceId: change.sourceId,
          detectedAtMs: change.snapshot.receivedAtMs,
        };
        const events =
          previousShapes === undefined
            ? detectEventsInAFirstSnapshot(change.snapshot.shapes, moment)
            : detectEventsBetweenSnapshots(previousShapes, change.snapshot.shapes, moment);
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

/**
 * Each source's config as JSON text, by source id, to tell a changed config. The keys of a
 * config always come in the same order (the server builds it from its schema), so equal
 * configs give equal texts.
 */
function writeConfigTextOfEachSource(dataSources: DataSource[]): Map<string, string> {
  return new Map(
    dataSources.map((dataSource) => [dataSource.id, JSON.stringify(dataSource.config)]),
  );
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
