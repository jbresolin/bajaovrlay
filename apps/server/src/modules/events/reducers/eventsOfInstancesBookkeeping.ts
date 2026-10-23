import type { Instance } from '@bajaovrlay/shared';

import type { SlicesChangedByCommands } from '../../../core/store/reducers/reducerTypes.js';
import { changeStatusOfEvent, readMomentMs } from './inboxEventChanges.js';

/**
 * Keeps the inbox in step with the program output, after any command that changed the
 * instances (core's reduceCommand calls it, in that one place, as it drops the bindings
 * of instances gone). The one rule: an event is on air while a program instance carries
 * its id, and shown once that instance has left.
 * - A waiting event (pending or queued) whose id a program instance carries becomes
 *   onAir, naming that instance: showEvent's take, or "Tomar" on a previewed event.
 * - An onAir event whose instance is no longer on the program output becomes shown: a
 *   clear, the auto-out, a replace by another take. One replaced by another instance of the
 *   same event stays onAir, naming the new instance.
 * An event already shown, dismissed or expired keeps its status even if an instance
 * carrying its id goes on air again (the operator took a preview of it again by hand).
 */
export function followEventsOfProgramInstances(
  slices: SlicesChangedByCommands,
  isoMomentOfTheCommand: string,
): SlicesChangedByCommands {
  const nowMs = readMomentMs(isoMomentOfTheCommand);
  const programInstanceIdByEventId = new Map<string, string>();
  for (const instance of slices.instances) {
    if (isProgramInstanceOfAnEvent(instance)) {
      programInstanceIdByEventId.set(instance.eventId, instance.id);
    }
  }
  const programInstanceIds = new Set(programInstanceIdByEventId.values());

  let hasAnyEventChanged = false;
  const eventsAfter = slices.events.map((event) => {
    const isWaiting = event.status === 'pending' || event.status === 'queued';
    const instanceIdShowingIt = programInstanceIdByEventId.get(event.eventId);
    // Its notice replaced by another of the same event (its preview taken over it): still
    // on air, now with the new instance (gate 2 of PR #22).
    const isOnAirWithAnotherInstance =
      event.status === 'onAir' &&
      instanceIdShowingIt !== undefined &&
      instanceIdShowingIt !== event.instanceId;
    if (isOnAirWithAnotherInstance) {
      hasAnyEventChanged = true;
      return { ...event, instanceId: instanceIdShowingIt };
    }
    if (isWaiting && instanceIdShowingIt !== undefined) {
      hasAnyEventChanged = true;
      return {
        ...changeStatusOfEvent(event, 'onAir', nowMs),
        instanceId: instanceIdShowingIt,
      };
    }
    const hasLeftTheAir =
      event.status === 'onAir' &&
      (event.instanceId === undefined || !programInstanceIds.has(event.instanceId));
    if (hasLeftTheAir) {
      hasAnyEventChanged = true;
      return changeStatusOfEvent(event, 'shown', nowMs);
    }
    return event;
  });

  return hasAnyEventChanged ? { ...slices, events: eventsAfter } : slices;
}

/** True for an instance on the program output that an event put there. */
function isProgramInstanceOfAnEvent(
  instance: Instance,
): instance is Instance & { eventId: string } {
  return instance.target === 'program' && instance.eventId !== undefined;
}
