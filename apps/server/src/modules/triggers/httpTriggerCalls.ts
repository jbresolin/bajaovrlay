import { type CommandError, readTriggerDataFromHttpBody } from '@bajaovrlay/shared';

import { ptBR } from '../../core/messages/ptBR.js';
import { triggerServiceActor } from '../../core/store/commandActors.js';
import type { StateStore } from '../../core/store/createStateStore.js';
import { refuseTriggerThatIsNotHttp, refuseUnknownTrigger } from './triggerRefusals.js';
import { findWhyTriggerMayNotFireNow } from './whenATriggerMayFire.js';

/** How a call to an HTTP trigger ended: it fired, or why not (the route picks the status). */
export type HttpTriggerCallOutcome = { status: 'fired' } | { status: 'refused'; error: CommandError };

/**
 * Handles one call to POST /api/v1/triggers/:triggerId (BAJAOVRLAY-48), after the route
 * checked the caller's access. In this order: the id must name an HTTP trigger
 * (TRIGGER_NOT_FOUND, 404), the body must be flat JSON of at most 8 KB (INVALID_TRIGGER_BODY,
 * 400), and the trigger must be free to fire now (TRIGGER_NOT_FIRED, 409, with the reason:
 * off, paused, too soon). Then fireTrigger goes through the store's one path, signed
 * `sistema:gatilhos`, its cause the calling device (`api:<name>`).
 * The 409 is the one difference from the service's firings, which are dropped silently: a
 * device pressed for this firing, and its button should say it did nothing.
 */
export function fireTriggerFromAnHttpCall(call: {
  stateStore: StateStore;
  triggerId: string;
  bodyText: string;
  callerActor: string;
}): HttpTriggerCallOutcome {
  const slices = call.stateStore.readAllSlices();
  const trigger = slices.triggers.find((candidate) => candidate.id === call.triggerId);
  if (trigger === undefined) {
    return { status: 'refused', error: refuseUnknownTrigger(call.triggerId) };
  }
  if (trigger.when.kind !== 'http') {
    return { status: 'refused', error: refuseTriggerThatIsNotHttp(trigger.name) };
  }
  const bodyReading = readTriggerDataFromHttpBody(call.bodyText);
  if (bodyReading.status === 'refused') {
    return {
      status: 'refused',
      error: { code: 'INVALID_TRIGGER_BODY', message: bodyReading.reason },
    };
  }
  const nowMs = Date.now();
  const reasonNotToFire = findWhyTriggerMayNotFireNow(slices, trigger, nowMs, call.callerActor);
  if (reasonNotToFire !== undefined) {
    return { status: 'refused', error: { code: 'TRIGGER_NOT_FIRED', message: reasonNotToFire.message } };
  }
  const outcome = call.stateStore.applyCommand(
    {
      type: 'fireTrigger',
      triggerId: trigger.id,
      triggerName: trigger.name,
      data: bodyReading.data,
      causedBy: call.callerActor,
    },
    triggerServiceActor,
  );
  if (!outcome.ok) {
    return { status: 'refused', error: outcome.error };
  }
  // The reducer has the last word: the check above read the same slices a moment ago, so
  // this only differs if the store's clock and this one disagree. Then the device is told
  // nothing fired rather than a fired it did not do.
  const firingsAfter = call.stateStore.readAllSlices().triggerActivity.firings;
  if (firingsAfter === slices.triggerActivity.firings) {
    return {
      status: 'refused',
      error: { code: 'TRIGGER_NOT_FIRED', message: ptBR.triggers.notFiredReasons.unknown },
    };
  }
  return { status: 'fired' };
}
