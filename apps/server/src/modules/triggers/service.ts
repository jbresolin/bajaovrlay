// The trigger service (BAJAOVRLAY-48): it watches what triggers wait for (OBS's Program
// scene, the inbox's events, the schedule's moments) and sends fireTrigger, signed
// `sistema:gatilhos`. HTTP triggers come in through the route (httpTriggerCalls.ts)
// instead. Whether a trigger may fire, and what a firing does, is the reducer's to decide.
import type { Slices, Trigger, TriggerData } from '@bajaovrlay/shared';

import type { ServerLogger } from '../../core/logger/createLogger.js';
import { eventInboxActor, triggerServiceActor } from '../../core/store/commandActors.js';
import type { StateStore } from '../../core/store/createStateStore.js';
import { readServerTime } from '../../core/time/serverClock.js';
import { readTriggerDataEventOfInboxEvent } from './dataEventsOfTheInbox.js';
import { readObsReading } from './obsSceneChanges.js';
import { isTheCountOfMomentsCapped, listScheduleMomentsDue } from './scheduleMoments.js';
import { findWhyTriggerMayNotFireNow } from './whenATriggerMayFire.js';

/** What the service needs; the timers default to Node's own, the clock to the server clock. */
export type TriggerServiceOptions = {
  stateStore: StateStore;
  logger: ServerLogger;
  startTimer?: ((onTimeIsUp: () => void, delayInMilliseconds: number) => unknown) | undefined;
  cancelTimer?: ((timerHandle: unknown) => void) | undefined;
  readCurrentTime?: (() => Date) | undefined;
};

/** The running service; stop() calls off its timers and stops watching the store. */
export type TriggerService = { stop: () => void };

/** How often the schedule is looked at: once a second, the finest a time of day says. */
const scheduleLookIntervalMs = 1000;

/**
 * How late a schedule moment may still fire: 5 s. A tick delayed a moment (a busy event
 * loop) still fires its moment; a machine that slept for minutes does not fire a
 * countdown for a session that has started, which would be wrong on air.
 */
const latestAScheduleMomentMayFireMs = 5000;

/** One firing to send: the trigger, its data, and the actor behind what happened. */
type FiringToSend = { trigger: Trigger; data: TriggerData; causedBy: string };

/**
 * Starts the service. Called by startServer after the macro runner (so a firing's run is
 * seen) and before OBS connects and the sources poll (so their first reports are seen).
 * At the start it notes OBS's scene, the inbox's events and the time as they are: nothing
 * that happened before the boot is replayed.
 *
 * Deliberate trade-offs:
 * - A firing seen while the store tells its listeners is sent from a 0 ms timer, never
 *   from inside the listener, so the change that caused it is broadcast whole before the
 *   firing's own, as the macro runner does with its first step.
 * - Every matching trigger is sent its firing, on or off; the reducer drops what may not
 *   fire. It is one place for the rules, and a dropped firing costs nothing (no row).
 * - Nothing here throws: this runs from timers, where an error nobody catches would stop
 *   the whole server with graphics on air. A firing that throws is logged as an error.
 */
export function startTriggerService(options: TriggerServiceOptions): TriggerService {
  const { stateStore, logger } = options;
  const startTimer = options.startTimer ?? startNodeTimer;
  const cancelTimer = options.cancelTimer ?? cancelNodeTimer;
  const readCurrentTime = options.readCurrentTime ?? readServerTime;
  const slicesAtTheStart = stateStore.readAllSlices();
  let obsSeenLast = slicesAtTheStart.obs;
  let numberOfTheLastSwitchUsedUp: number | undefined = undefined;
  let eventIdsSeen = new Set(slicesAtTheStart.events.map((event) => event.eventId));
  let scheduleLookedAtUpToMs = readCurrentTime().getTime();
  let isStopped = false;
  const pendingTimers = new Set<unknown>();

  /** Sends the firings from a 0 ms timer, in order. */
  function sendFiringsSoon(firings: FiringToSend[]): void {
    if (firings.length === 0) {
      return;
    }
    const timerHandle = startTimer(() => {
      pendingTimers.delete(timerHandle);
      sendFiringsNow(firings);
    }, 0);
    pendingTimers.add(timerHandle);
  }

  /** Sends each firing through the store's one command path. */
  function sendFiringsNow(firings: FiringToSend[]): void {
    for (const firing of firings) {
      if (isStopped) {
        return;
      }
      try {
        stateStore.applyCommand(
          {
            type: 'fireTrigger',
            triggerId: firing.trigger.id,
            triggerName: firing.trigger.name,
            data: firing.data,
            causedBy: firing.causedBy,
          },
          triggerServiceActor,
        );
      } catch (firingError) {
        logger.error(
          { err: firingError, trigger_id: firing.trigger.id },
          'a trigger firing could not be sent',
        );
      }
    }
  }

  /** The scene triggers a change of Program matches: the scene entered, the scene left. */
  function findFiringsOfSceneChange(slices: Slices): FiringToSend[] {
    const obsReading = readObsReading(obsSeenLast, slices.obs, numberOfTheLastSwitchUsedUp);
    obsSeenLast = slices.obs;
    numberOfTheLastSwitchUsedUp = obsReading.numberOfTheLastSwitchUsedUp;
    const sceneChange = obsReading.sceneChange;
    if (sceneChange === undefined) {
      return [];
    }
    const firings: FiringToSend[] = [];
    for (const trigger of slices.triggers) {
      if (trigger.when.kind !== 'obsScene') {
        continue;
      }
      const sceneOfTheTrigger =
        trigger.when.change === 'entered'
          ? sceneChange.enteredSceneName
          : sceneChange.leftSceneName;
      if (trigger.when.sceneName === sceneOfTheTrigger) {
        firings.push({
          trigger,
          data: { cena: sceneOfTheTrigger },
          causedBy: sceneChange.causedBy,
        });
      }
    }
    return firings;
  }

  /** The data event triggers the inbox's new events match, oldest event first. */
  function findFiringsOfNewEvents(slices: Slices): FiringToSend[] {
    const newEvents = slices.events.filter((event) => !eventIdsSeen.has(event.eventId));
    eventIdsSeen = new Set(slices.events.map((event) => event.eventId));
    const firings: FiringToSend[] = [];
    for (const event of newEvents) {
      const dataEvent = readTriggerDataEventOfInboxEvent(event);
      if (dataEvent === undefined) {
        continue;
      }
      for (const trigger of slices.triggers) {
        const isWaitingForThisKind =
          trigger.when.kind === 'dataEvent' && trigger.when.eventKind === dataEvent.eventKind;
        if (isWaitingForThisKind) {
          firings.push({ trigger, data: dataEvent.data, causedBy: eventInboxActor });
        }
      }
    }
    return firings;
  }

  /** Looks at the schedule since the last look, sends what came due, and looks again in 1 s. */
  function lookAtTheSchedule(): void {
    if (isStopped) {
      return;
    }
    try {
      const nowMs = readCurrentTime().getTime();
      const afterMs = Math.max(scheduleLookedAtUpToMs, nowMs - latestAScheduleMomentMayFireMs);
      const skippedFromMs = scheduleLookedAtUpToMs;
      // Never moves back: after a step of the server clock back (BAJAOVRLAY-62), the
      // moments already looked at are not looked at, and fired, a second time.
      scheduleLookedAtUpToMs = Math.max(scheduleLookedAtUpToMs, nowMs);
      const slices = stateStore.readAllSlices();
      if (afterMs > skippedFromMs) {
        logTheScheduleMomentsSkipped(slices, skippedFromMs, afterMs);
      }
      const firings: FiringToSend[] = [];
      for (const trigger of slices.triggers) {
        if (trigger.when.kind !== 'schedule') {
          continue;
        }
        const dataOfEachMoment = listScheduleMomentsDue(trigger.when.moment, slices.scheduleSlots, {
          afterMs,
          upToMs: nowMs,
          intervalCountedFromMs: trigger.intervalCountedFromMs,
        });
        for (const data of dataOfEachMoment) {
          firings.push({ trigger, data, causedBy: triggerServiceActor });
        }
      }
      logTheFiringsOverAGraphicStillOnAir(slices, firings, nowMs);
      sendFiringsNow(firings);
    } catch (scheduleError) {
      logger.error({ err: scheduleError }, 'the schedule of the triggers could not be read');
    }
    armTheNextLook();
  }

  /**
   * Logs, trigger by trigger, the moments that fell more than 5 s before this look and
   * after the last one: a sleep, or a forward step of the server clock to NTP's real time
   * (BAJAOVRLAY-62). They are dropped, never fired late or all together.
   */
  function logTheScheduleMomentsSkipped(
    slices: Slices,
    skippedFromMs: number,
    skippedUpToMs: number,
  ): void {
    for (const trigger of slices.triggers) {
      if (trigger.when.kind !== 'schedule') {
        continue;
      }
      const momentsSkipped = listScheduleMomentsDue(trigger.when.moment, slices.scheduleSlots, {
        afterMs: skippedFromMs,
        upToMs: skippedUpToMs,
        intervalCountedFromMs: trigger.intervalCountedFromMs,
      });
      if (momentsSkipped.length > 0) {
        logger.warn(
          {
            trigger_id: trigger.id,
            trigger_name: trigger.name,
            moments_skipped: momentsSkipped.length,
            // A step of days on an every-N-minutes grid: counted up to the cap only.
            is_count_capped: isTheCountOfMomentsCapped(
              trigger.when.moment,
              skippedUpToMs - skippedFromMs,
            ),
            gap_ms: skippedUpToMs - skippedFromMs,
          },
          'schedule moments skipped, not fired: the clock jumped past them',
        );
      }
    }
  }

  /**
   * Logs each schedule firing that will do nothing because a graphic its macro takes is
   * still on air (a schedule every N minutes over the plain roll's pass, BAJAOVRLAY-64).
   * The reducer drops it, as it drops any firing that may not fire, leaving no row; this
   * line is where the operator reading the log learns why the roll did not come back.
   */
  function logTheFiringsOverAGraphicStillOnAir(
    slices: Slices,
    firings: FiringToSend[],
    nowMs: number,
  ): void {
    for (const firing of firings) {
      const reasonNotToFire = findWhyTriggerMayNotFireNow(
        slices,
        firing.trigger,
        nowMs,
        firing.causedBy,
      );
      if (reasonNotToFire?.why === 'stillOnAir') {
        logger.info(
          {
            trigger_id: firing.trigger.id,
            trigger_name: firing.trigger.name,
            reason: reasonNotToFire.message,
          },
          'schedule firing not made: a graphic of its macro is still on air',
        );
      }
    }
  }

  /** Arms the next look at the schedule. */
  function armTheNextLook(): void {
    if (isStopped) {
      return;
    }
    const timerHandle = startTimer(() => {
      pendingTimers.delete(timerHandle);
      lookAtTheSchedule();
    }, scheduleLookIntervalMs);
    pendingTimers.add(timerHandle);
  }

  const stopWatchingTheStore = stateStore.subscribeToSliceChanges((changedSliceNames, slices) => {
    const firings: FiringToSend[] = [];
    if (changedSliceNames.includes('obs')) {
      firings.push(...findFiringsOfSceneChange(slices));
    }
    if (changedSliceNames.includes('events')) {
      firings.push(...findFiringsOfNewEvents(slices));
    }
    sendFiringsSoon(firings);
  });
  armTheNextLook();
  logger.info('trigger service started');

  return {
    stop: () => {
      isStopped = true;
      stopWatchingTheStore();
      for (const timerHandle of pendingTimers) {
        cancelTimer(timerHandle);
      }
      pendingTimers.clear();
    },
  };
}

/** The default startTimer: Node's setTimeout. */
function startNodeTimer(onTimeIsUp: () => void, delayInMilliseconds: number): unknown {
  return setTimeout(onTimeIsUp, delayInMilliseconds);
}

/** The default cancelTimer: Node's clearTimeout, for a handle startNodeTimer returned. */
function cancelNodeTimer(timerHandle: unknown): void {
  clearTimeout(timerHandle as NodeJS.Timeout);
}
