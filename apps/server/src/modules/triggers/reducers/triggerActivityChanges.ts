// How the triggerActivity slice changes: a firing added (and the trigger's last firing
// noted), a firing's status changed. Shared by fireTrigger and the operator's answers.
import {
  type TriggerActivity,
  type TriggerFiring,
  triggerFiringsKept,
  type TriggerFiringStatus,
} from '@bajaovrlay/shared';

/**
 * The activity with a new firing last, the oldest dropped past triggerFiringsKept (the
 * event log keeps them all), and the trigger's last firing set to this moment, which the
 * minimum interval counts from.
 */
export function addFiringToTheActivity(
  activity: TriggerActivity,
  firing: TriggerFiring,
): TriggerActivity {
  const firingsAfter = [...activity.firings, firing].slice(-triggerFiringsKept);
  return {
    ...activity,
    lastFiredAtMsByTriggerId: {
      ...activity.lastFiredAtMsByTriggerId,
      [firing.triggerId]: firing.firedAtMs,
    },
    firings: firingsAfter,
  };
}

/** The activity with one firing's status changed at this moment; the others kept as they are. */
export function changeStatusOfFiring(
  activity: TriggerActivity,
  firingId: string,
  status: TriggerFiringStatus,
  atMs: number,
): TriggerActivity {
  const firingsAfter = activity.firings.map((firing) =>
    firing.firingId === firingId ? { ...firing, status, statusChangedAtMs: atMs } : firing,
  );
  return { ...activity, firings: firingsAfter };
}
