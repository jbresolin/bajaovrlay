/**
 * How many firings the triggerActivity slice keeps (apps/server, modules/triggers)
 *
 * What this module is for:
 *   The Eventos tab lists the newest firings from the triggerActivity slice, which keeps
 *   at most triggerFiringsKept (50) of them; every firing is in the event log too. A
 *   firing that is waiting for the operator ("Rodar" or "Descartar") is the one thing on
 *   that list the operator still has to act on, so it must never be dropped to make room.
 *
 * What these tests prove:
 *   - Past 50, the oldest answered firing (ran or dismissed) is dropped first, even when a
 *     waiting firing is older.
 *   - Waiting firings are all kept, even when they alone pass 50.
 *
 * What these tests deliberately do not cover:
 *   - When a trigger fires, and what a firing does; triggerFiring.test.ts.
 */
import {
  type TriggerActivity,
  triggerActivityAtBoot,
  type TriggerFiring,
  triggerFiringsKept,
  type TriggerFiringStatus,
} from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { addFiringToTheActivity } from './triggerActivityChanges.js';

/** A firing of "Entrou no box" at minute `minute` of the race day, in this status. */
function buildBoxFiring(minute: number, status: TriggerFiringStatus): TriggerFiring {
  const firedAtMs = Date.parse('2027-08-14T14:00:00.000Z') + minute * 60_000;
  return {
    firingId: `disparo-box-${minute}`,
    triggerId: 'gatilho-entrou-no-box',
    triggerName: 'Entrou no box',
    macroId: 'macro-entrevista-no-box',
    data: { cena: 'Box' },
    firedAtMs,
    status,
    statusChangedAtMs: firedAtMs,
    autoRunRefusal: null,
  };
}

/** The activity holding these firings, oldest first. */
function buildActivityWithFirings(firings: TriggerFiring[]): TriggerActivity {
  return { ...triggerActivityAtBoot, firings };
}

/** Firings of minutes `firstMinute`, `firstMinute + 1`, …, all in this status. */
function buildBoxFiringsFrom(
  firstMinute: number,
  count: number,
  status: TriggerFiringStatus,
): TriggerFiring[] {
  const firings: TriggerFiring[] = [];
  for (let index = 0; index < count; index += 1) {
    firings.push(buildBoxFiring(firstMinute + index, status));
  }
  return firings;
}

describe('addFiringToTheActivity, past the 50 firings kept', () => {
  const fullLists = [
    // The plain case: every firing ran, so the oldest one makes room.
    {
      name: 'drops the oldest answered firing',
      firingsHeld: buildBoxFiringsFrom(0, triggerFiringsKept, 'ran'),
      expectedFiringIdsDropped: ['disparo-box-0'],
      expectedCount: triggerFiringsKept,
    },
    // The oldest firing still waits for the operator: the oldest answered one goes instead.
    {
      name: 'keeps a waiting firing older than every answered one',
      firingsHeld: [
        buildBoxFiring(0, 'pending'),
        buildBoxFiring(1, 'dismissed'),
        ...buildBoxFiringsFrom(2, triggerFiringsKept - 2, 'ran'),
      ],
      expectedFiringIdsDropped: ['disparo-box-1'],
      expectedCount: triggerFiringsKept,
    },
    // A rehearsal left 50 firings waiting: none may vanish, so the list grows past 50.
    {
      name: 'keeps every waiting firing, even when they alone pass 50',
      firingsHeld: buildBoxFiringsFrom(0, triggerFiringsKept, 'pending'),
      expectedFiringIdsDropped: [],
      expectedCount: triggerFiringsKept + 1,
    },
  ];

  it.each(fullLists)('$name', ({ firingsHeld, expectedFiringIdsDropped, expectedCount }) => {
    // Arrange: a list already holding 50 firings, and a new firing that waits.
    const activity = buildActivityWithFirings(firingsHeld);
    const newFiring = buildBoxFiring(90, 'pending');

    // Act: add the new firing.
    const activityAfter = addFiringToTheActivity(activity, newFiring);

    // Assert: the expected firings were dropped, the new one is last, and every waiting
    // firing is still there.
    const firingIdsAfter = activityAfter.firings.map((firing) => firing.firingId);
    const firingIdsDropped = firingsHeld
      .map((firing) => firing.firingId)
      .filter((firingId) => !firingIdsAfter.includes(firingId));
    expect(firingIdsDropped, 'only the oldest answered firing may make room').toEqual(
      expectedFiringIdsDropped,
    );
    expect(firingIdsAfter.length, 'the list keeps 50, or more when they all wait').toBe(
      expectedCount,
    );
    expect(firingIdsAfter.at(-1), 'the new firing must be last').toBe('disparo-box-90');
  });
});
