/**
 * Each layer's last program change, and who made it (apps/server)
 *
 * What this module is for:
 *   To refuse a take over another console's change, the store must know, for each layer,
 *   when its program output last changed and which console changed it. This record is
 *   brought up to date after every accepted command, whoever sent it.
 *
 * What these tests prove:
 *   - A take records its layer with the moment and the console that sent it; a layer it did
 *     not touch keeps its entry.
 *   - A clear records its layer too (the layer now shows nothing).
 *   - "Próximo" and an edit on air keep the same instance, so they change nothing, and the
 *     very same record is handed back.
 *   - A change made by no console (a macro, a trigger, the API) is recorded without one, so
 *     it never makes a later take look like the loser of a race.
 *   - A command is signed with its moment, the server clock's step count at that moment (so a
 *     step since makes the change old), its console and the role of that console's login,
 *     and with no role when the login is off.
 *
 * What these tests deliberately do not cover:
 *   - The rule that reads it: unseenChangeByAnotherConsole.test.ts.
 *   - That the store carries it from one command to the next: storeTwoConsolesOnOneLayer.test.ts.
 */
import { describe, expect, it } from 'vitest';

import {
  type LastProgramChangeOfEachLayer,
  rememberLastProgramChangeOfEachLayer,
  signProgramChangeOfACommand,
} from './lastProgramChangeOfEachLayer.js';
import {
  buildCaptainOnProgram,
  buildMesa1TookTheCaptain,
  consoleAtMesa1,
  consoleAtMesa2,
} from './twoConsolesOnOneLayerFixtures.testSupport.js';

/** The change Mesa 2 makes at 14:32:05, after the server clock's second step, signed as the store signs it. */
const mesa2At143205 = {
  changedAt: '2026-10-09T14:32:05.000Z',
  serverClockStepCount: 2,
  consoleId: consoleAtMesa2,
  consoleRole: 'produtor' as const,
};

/** Reads the record as `layer: console at moment` lines, sorted, for easy comparison. */
function readRecordAsLines(record: LastProgramChangeOfEachLayer): string[] {
  return [...record.entries()]
    .map(
      ([layerId, change]) =>
        `${layerId}: ${change.consoleId ?? 'no console'} at ${change.changedAt}`,
    )
    .sort();
}

describe('rememberLastProgramChangeOfEachLayer', () => {
  it("records a take on its layer and leaves the other layers' entries as they were", () => {
    // Arrange: "Relógio" last changed by Mesa 1; "Tarja" empty.
    const recordBefore: LastProgramChangeOfEachLayer = new Map([
      [
        'clock',
        {
          changedAt: '2026-10-09T14:30:00.000Z',
          serverClockStepCount: 2,
          consoleId: consoleAtMesa1,
        },
      ],
    ]);

    // Act: Mesa 2 takes the captain on "Tarja".
    const recordAfter = rememberLastProgramChangeOfEachLayer(
      recordBefore,
      [],
      [buildCaptainOnProgram()],
      mesa2At143205,
    );

    // Assert: "Tarja" now names Mesa 2 at 14:32:05; "Relógio" is unchanged.
    expect(readRecordAsLines(recordAfter), 'only the layer taken on may change').toEqual([
      `clock: ${consoleAtMesa1} at 2026-10-09T14:30:00.000Z`,
      `lower-third: ${consoleAtMesa2} at 2026-10-09T14:32:05.000Z`,
    ]);
  });

  it('records a clear, which leaves the layer showing nothing', () => {
    // Arrange: Mesa 1 took the captain.
    const recordBefore: LastProgramChangeOfEachLayer = new Map([
      ['lower-third', buildMesa1TookTheCaptain()],
    ]);

    // Act: Mesa 2 clears "Tarja".
    const recordAfter = rememberLastProgramChangeOfEachLayer(
      recordBefore,
      [buildCaptainOnProgram()],
      [],
      mesa2At143205,
    );

    // Assert: the clear is the layer's last change now.
    expect(recordAfter.get('lower-third'), 'a clear is a change of the layer').toEqual(
      mesa2At143205,
    );
  });

  it('hands back the very same record when the instance on air stays (Próximo, an edit)', () => {
    // Arrange: Mesa 1 took the captain; "Próximo" keeps her instance, on its next step.
    const recordBefore: LastProgramChangeOfEachLayer = new Map([
      ['lower-third', buildMesa1TookTheCaptain()],
    ]);
    const captainOnHerSecondStep = { ...buildCaptainOnProgram(), currentStep: 1 };

    // Act: Mesa 2 presses "Próximo".
    const recordAfter = rememberLastProgramChangeOfEachLayer(
      recordBefore,
      [buildCaptainOnProgram()],
      [captainOnHerSecondStep],
      mesa2At143205,
    );

    // Assert: nothing recorded; the same record comes back.
    expect(recordAfter, 'a step is not a change of what is on the layer').toBe(recordBefore);
  });

  it('records a change made by no console without a console', () => {
    // Arrange: nothing known yet, as when the store starts.
    const recordBefore: LastProgramChangeOfEachLayer = new Map();

    // Act: a macro's step takes the captain.
    const recordAfter = rememberLastProgramChangeOfEachLayer(
      recordBefore,
      [],
      [buildCaptainOnProgram()],
      signProgramChangeOfACommand({
        now: '2026-10-09T14:32:05.000Z',
        serverClockStepCount: 2,
        actor: 'sistema:macro:macro-abertura-do-enduro',
        consoleId: undefined,
      }),
    );

    // Assert: recorded with its moment, the clock's step count and no console.
    expect(recordAfter.get('lower-third'), 'a macro is no console').toEqual({
      changedAt: '2026-10-09T14:32:05.000Z',
      serverClockStepCount: 2,
    });
  });
});

describe('signProgramChangeOfACommand', () => {
  it("signs a logged-in console's command with its id and its role", () => {
    // Arrange: nothing beyond the command's own facts.

    // Act: sign a command of the Produtor at "Mesa 2".
    const change = signProgramChangeOfACommand({
      now: '2026-10-09T14:32:05.000Z',
      serverClockStepCount: 2,
      actor: 'produtor:Mesa 2',
      consoleId: consoleAtMesa2,
    });

    // Assert: moment, the clock's step count, console and role.
    expect(change, 'a logged-in console is signed with its role').toEqual(mesa2At143205);
  });

  it('signs a console with the login off with no role', () => {
    // Arrange: nothing beyond the command's own facts.

    // Act: sign a command of a console whose actor is its connection.
    const change = signProgramChangeOfACommand({
      now: '2026-10-09T14:32:05.000Z',
      serverClockStepCount: 2,
      actor: 'operador:3f2a9c1e-8b47-4d06-9e15-7c0d2b6a4f81',
      consoleId: consoleAtMesa2,
    });

    // Assert: moment, step count and console, no role.
    expect(change, 'with no login there is no role').toEqual({
      changedAt: '2026-10-09T14:32:05.000Z',
      serverClockStepCount: 2,
      consoleId: consoleAtMesa2,
    });
  });
});
