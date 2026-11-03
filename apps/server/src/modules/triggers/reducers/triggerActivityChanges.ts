// How the triggerActivity slice changes: a firing added (and the trigger's last firing
// noted), a firing's status changed. Shared by fireTrigger and the operator's answers.
import {
  type TriggerActivity,
  type TriggerFiring,
  triggerFiringsKept,
  type TriggerFiringStatus,
} from '@bajaovrlay/shared';

/**
 * The activity with a new firing last, past triggerFiringsKept the oldest answered firings
 * dropped (the event log keeps them all), and the trigger's last firing set to this
 * moment, which the minimum interval counts from.
 */
export function addFiringToTheActivity(
  activity: TriggerActivity,
  firing: TriggerFiring,
): TriggerActivity {
  const firingsAfter = dropOldestAnsweredFiringsPastTheCap([...activity.firings, firing]);
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

/**
 * The firings, oldest first, with the oldest answered ones (ran or dismissed) dropped
 * until at most triggerFiringsKept are left. A waiting firing is never dropped: the
 * operator still has to answer it. So when waiting firings alone pass the cap, the list
 * holds all of them and grows past it; each one is gone once answered and pushed out.
 */
function dropOldestAnsweredFiringsPastTheCap(firings: TriggerFiring[]): TriggerFiring[] {
  let howManyToDrop = firings.length - triggerFiringsKept;
  const firingsKept: TriggerFiring[] = [];
  for (const firing of firings) {
    const isAnswered = firing.status !== 'pending';
    if (howManyToDrop > 0 && isAnswered) {
      howManyToDrop -= 1;
      continue;
    }
    firingsKept.push(firing);
  }
  return firingsKept;
}
