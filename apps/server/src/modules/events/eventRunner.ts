// The automatic runner of the event inbox: puts each queued event (its rule says auto) on
// air by itself, through showEvent as sistema:eventos, and expires what waited too long.
import type { EventRule, InboxEvent, Slices } from '@bajaovrlay/shared';

import type { ServerLogger } from '../../core/logger/createLogger.js';
import { eventInboxActor } from '../../core/store/commandActors.js';
import type { StateStore } from '../../core/store/createStateStore.js';

/**
 * The theme's --motion-out (packages/theme/ardosia/tokens.css): how long a graphic takes
 * to leave. The server cannot read CSS, so it is written here; eventRunner.test.ts fails
 * if the token changes and this does not.
 */
const motionOutMs = 250;

/**
 * How long a layer must have been empty before the runner puts an event on it:
 * --motion-out plus one second, so the previous notice is fully out, and the screen has a
 * breath, before the next one comes in (the brief's rule, decisions BAJAOVRLAY-44).
 */
export const gapBetweenEventsOnALayerMs = motionOutMs + 1_000;

/** What the runner needs: the store, the logger, and a clock and timers a test can move. */
export type EventRunnerOptions = {
  stateStore: StateStore;
  logger: ServerLogger;
  readCurrentTime?: (() => Date) | undefined;
  startTimer?: ((onTimeIsUp: () => void, delayInMilliseconds: number) => unknown) | undefined;
  cancelTimer?: ((timerHandle: unknown) => void) | undefined;
};

/** The running runner; stop() stops watching and calls off its timer. */
export type EventRunner = { stop: () => void };

/**
 * Starts the runner. Each time it looks (after any change of the store, from a 0 ms
 * timer, and at the next moment time alone would change something), it applies the rules
 * of the queue, written here and in docs/decisions.md:
 * 1. Never late: a waiting event (queued, or pending under a rule with a max age) older
 *    than its rule's maxAgeMs is sent to showEvent, which expires it instead of showing it.
 * 2. Never over something else: a queued event goes on air only on an empty layer (the
 *    layer of its rule's item). Whatever is there, an operator's graphic or the previous
 *    event, it waits; the auto-out or the operator empties the layer.
 * 3. One after another: an empty layer takes the first queued event of that layer in
 *    detection order (the slice's order), and only once it has been empty for
 *    gapBetweenEventsOnALayerMs.
 * A pending event (its rule asks) is never shown by the runner. An event showEvent refused
 * (its rule's item cannot be taken) is not tried again; it waits for the operator, or
 * expires. The moments the layers emptied are kept in memory: after a restart every
 * layer counts as long empty.
 */
export function startEventRunner(options: EventRunnerOptions): EventRunner {
  const { stateStore, logger } = options;
  const readCurrentTime = options.readCurrentTime ?? (() => new Date());
  const startTimer = options.startTimer ?? startNodeTimer;
  const cancelTimer = options.cancelTimer ?? cancelNodeTimer;
  const emptiedAtMsByLayerId = new Map<string, number>();
  const eventIdsRefused = new Set<string>();
  let layerIdsOnAir = listLayerIdsOnProgram(stateStore.readAllSlices());
  let lookTimerHandle: unknown;
  let lookTimerDueAtMs: number | undefined;

  /** Starts a look at `dueAtMs`, unless one is already due by then. */
  function lookAgainAt(dueAtMs: number): void {
    const nowMs = readCurrentTime().getTime();
    if (lookTimerDueAtMs !== undefined && lookTimerDueAtMs <= dueAtMs) {
      return;
    }
    if (lookTimerHandle !== undefined) {
      cancelTimer(lookTimerHandle);
    }
    lookTimerDueAtMs = dueAtMs;
    lookTimerHandle = startTimer(lookAtTheQueue, Math.max(0, dueAtMs - nowMs));
  }

  /** Applies the queue's rules once, then says when to look again. */
  function lookAtTheQueue(): void {
    lookTimerHandle = undefined;
    lookTimerDueAtMs = undefined;
    const nowMs = readCurrentTime().getTime();
    expireWhatWaitedTooLong(nowMs);
    showWhatTheEmptyLayersCanTake(nowMs);
    const nextMomentMs = findNextMomentTimeChangesSomething(stateStore.readAllSlices(), nowMs);
    if (nextMomentMs !== undefined) {
      lookAgainAt(nextMomentMs);
    }
  }

  /** Rule 1: sends showEvent for every waiting event past its max age (it expires). */
  function expireWhatWaitedTooLong(nowMs: number): void {
    const slices = stateStore.readAllSlices();
    for (const event of slices.events) {
      const expiresAtMs = findMomentEventExpires(event, slices.eventRules);
      if (expiresAtMs !== undefined && nowMs >= expiresAtMs) {
        sendShowEvent(event.eventId);
      }
    }
  }

  /** Rules 2 and 3: on each empty layer past its gap, shows its first queued event. */
  function showWhatTheEmptyLayersCanTake(nowMs: number): void {
    const slices = stateStore.readAllSlices();
    const layerIdsAlreadyServed = new Set<string>();
    for (const event of slices.events) {
      if (event.status !== 'queued' || eventIdsRefused.has(event.eventId)) {
        continue;
      }
      const layerId = findLayerOfEvent(event, slices);
      if (layerId === undefined || layerIdsAlreadyServed.has(layerId)) {
        continue;
      }
      layerIdsAlreadyServed.add(layerId);
      if (isLayerReadyForAnEvent(layerId, nowMs)) {
        const wasShown = sendShowEvent(event.eventId);
        if (!wasShown) {
          eventIdsRefused.add(event.eventId);
        }
      }
    }
  }

  /** True when nothing is on the layer and it has been empty for the whole gap. */
  function isLayerReadyForAnEvent(layerId: string, nowMs: number): boolean {
    const isLayerEmpty = !layerIdsOnAir.has(layerId);
    const emptiedAtMs = emptiedAtMsByLayerId.get(layerId);
    const hasTheGapPassed =
      emptiedAtMs === undefined || nowMs >= emptiedAtMs + gapBetweenEventsOnALayerMs;
    return isLayerEmpty && hasTheGapPassed;
  }

  /**
   * The next moment at which time alone changes what the runner would do: an event's
   * expiry, or the end of a gap on a layer with a queued event. Undefined when nothing
   * waits on time.
   */
  function findNextMomentTimeChangesSomething(slices: Slices, nowMs: number): number | undefined {
    const moments: number[] = [];
    for (const event of slices.events) {
      const expiresAtMs = findMomentEventExpires(event, slices.eventRules);
      if (expiresAtMs !== undefined) {
        moments.push(expiresAtMs);
      }
      const layerId = findLayerOfEvent(event, slices);
      const emptiedAtMs = layerId === undefined ? undefined : emptiedAtMsByLayerId.get(layerId);
      if (event.status === 'queued' && emptiedAtMs !== undefined) {
        moments.push(emptiedAtMs + gapBetweenEventsOnALayerMs);
      }
    }
    const futureMoments = moments.filter((moment) => moment > nowMs);
    return futureMoments.length === 0 ? undefined : Math.min(...futureMoments);
  }

  /** Sends showEvent as sistema:eventos; answers whether it was accepted. Never throws. */
  function sendShowEvent(eventId: string): boolean {
    try {
      const outcome = stateStore.applyCommand({ type: 'showEvent', eventId }, eventInboxActor);
      if (!outcome.ok) {
        logger.warn({ event_id: eventId, error: outcome.error }, 'event runner show refused');
      }
      return outcome.ok;
    } catch (showError) {
      logger.error({ err: showError, event_id: eventId }, 'event runner could not show');
      return false;
    }
  }

  /** Notes the moment each program layer emptied, then looks at the queue from a 0 ms timer. */
  const stopWatchingTheStore = stateStore.subscribeToSliceChanges((changedSliceNames, slices) => {
    if (changedSliceNames.includes('instances')) {
      const layerIdsOnAirNow = listLayerIdsOnProgram(slices);
      const nowMs = readCurrentTime().getTime();
      for (const layerId of layerIdsOnAir) {
        if (!layerIdsOnAirNow.has(layerId)) {
          emptiedAtMsByLayerId.set(layerId, nowMs);
        }
      }
      layerIdsOnAir = layerIdsOnAirNow;
    }
    const concernsTheQueue =
      changedSliceNames.includes('events') ||
      changedSliceNames.includes('eventRules') ||
      changedSliceNames.includes('instances');
    if (concernsTheQueue) {
      lookAgainAt(readCurrentTime().getTime());
    }
  });

  lookAgainAt(readCurrentTime().getTime());
  return {
    stop: () => {
      stopWatchingTheStore();
      if (lookTimerHandle !== undefined) {
        cancelTimer(lookTimerHandle);
      }
    },
  };
}

/**
 * When a waiting event expires: 1 ms past its detection plus its rule's max age (at
 * exactly its max age it may still be shown). Undefined for an event not waiting, or
 * whose rule has no max age.
 */
function findMomentEventExpires(event: InboxEvent, rules: EventRule[]): number | undefined {
  const isWaiting = event.status === 'pending' || event.status === 'queued';
  const maxAgeMs = rules.find((rule) => rule.kind === event.kind)?.maxAgeMs;
  if (!isWaiting || maxAgeMs === null || maxAgeMs === undefined) {
    return undefined;
  }
  return event.detectedAtMs + maxAgeMs + 1;
}

/** The layer an event would go on: its rule's item's layer, or undefined with no item. */
function findLayerOfEvent(event: InboxEvent, slices: Slices): string | undefined {
  const itemId = slices.eventRules.find((rule) => rule.kind === event.kind)?.itemId;
  return slices.items.find((item) => item.id === itemId)?.layerId;
}

/** The layers with something on the program output. */
function listLayerIdsOnProgram(slices: Slices): Set<string> {
  return new Set(
    slices.instances
      .filter((instance) => instance.target === 'program')
      .map((instance) => instance.layerId),
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
