/**
 * Two consoles take on one layer at once (apps/server)
 *
 * What this module is for:
 *   Two operators at two consoles (two tabs of the control page) may press a take on the
 *   same layer at the same moment. The later take used to replace the earlier one, its
 *   entrance played again, and nobody was told. Now a take from a console carries what that
 *   console showed on the layer's program output, and the server refuses it only when the
 *   layer now shows something else, put there (or emptied) by ANOTHER console less than 2 s
 *   ago, on the server clock. Every other take goes through as before (João's ruling,
 *   option C, 2026-11-10).
 *
 * What these tests prove (through reduceCommand, the reducers' one entry):
 *   - The table of the brief, one row per case: one console pressing twice fast goes
 *     through; another console within 2 s is refused; after 2 s (and at exactly 2 s) it goes
 *     through; a page that had already seen the other take goes through; a macro or trigger
 *     that took meanwhile does not refuse; a layer emptied by another console refuses; the
 *     command API, a console take that says nothing of what it saw, and a layer whose last
 *     change is unknown (a restart) go through.
 *   - A step of the server clock since the other change, back or forward, makes it old, and
 *     so does a change stamped after the take: only 0 ≤ elapsed < 2 s on one clock is recent.
 *   - The refusal's exact pt-BR sentence: who (the other console's role), what it did (took
 *     which item, or emptied the layer), on which layer, how long ago, and what of this take
 *     was not done; with the login off it says "Outra mesa" with no role.
 *   - What the event-log row keeps: the layer, both consoles' roles and the other change's
 *     moment.
 *
 * What these tests deliberately do not cover:
 *   - Where the store keeps each layer's last change and how it signs it:
 *     lastProgramChangeOfEachLayer.test.ts and storeTwoConsolesOnOneLayer.test.ts.
 *   - Space and "Tomar": spaceAndTomarOverAnotherConsole.test.ts.
 *   - "Tomar tudo", which checks each layer on its own: takeAllPreviewsAnotherConsole.test.ts.
 *   - The console's own side (what it sends, where it shows the refusal): apps/control.
 */
import type { Instance } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { reduceCommand } from '../reducers/reduceCommand.js';
import type { ReducerContext } from '../reducers/reducerTypes.js';
import type { ProgramChangeOfALayer } from './lastProgramChangeOfEachLayer.js';
import {
  buildCaptainOnProgram,
  buildContextOfMesa2,
  buildContextOfTheCommandApi,
  buildMesa1TookTheCaptain,
  buildRaceDayWithBothLowerThirds,
  captainOnAirInstanceId,
  consoleAtMesa1,
  consoleAtMesa2,
  momentMesa1TookTheCaptain,
  refusalOfTheChiefOverTheCaptain,
} from './twoConsolesOnOneLayerFixtures.testSupport.js';

/**
 * "Tarja"'s last change as made by the given console, this many milliseconds before 14:32:05
 * (negative: after it), while the server clock had made this many steps (none unless given).
 */
function buildChangeOfTheLowerThirdBy(
  consoleId: string | undefined,
  millisecondsBeforeTheTake: number,
  serverClockStepCount = 0,
): ProgramChangeOfALayer {
  const momentOfTheTake = Date.parse('2026-10-09T14:32:05.000Z');
  const changedAt = new Date(momentOfTheTake - millisecondsBeforeTheTake).toISOString();
  if (consoleId === undefined) {
    return { changedAt, serverClockStepCount };
  }
  return { changedAt, serverClockStepCount, consoleId, consoleRole: 'produtor' };
}

type TableRow = {
  name: string;
  instancesOnAir: Instance[];
  lastChangeOfTheLowerThirdLayer: ProgramChangeOfALayer | undefined;
  sentFrom: 'Mesa 2' | 'the command API';
  instanceIdSeenOnAir: string | null | undefined;
  /** The server clock's step count at the take; none (0) unless the row is about a step. */
  serverClockStepCountAtTheTake?: number;
  expectedStatus: 'applied' | 'refused';
};

const casesOfTheBrief: TableRow[] = [
  {
    // One operator pressing two takes fast: Mesa 2's own take is on air, its page has not
    // heard of it yet, and the second press must go through, as always.
    name: 'lets one console take twice in a row, 0,3 s apart',
    instancesOnAir: [buildCaptainOnProgram()],
    lastChangeOfTheLowerThirdLayer: buildChangeOfTheLowerThirdBy(consoleAtMesa2, 300),
    sentFrom: 'Mesa 2',
    instanceIdSeenOnAir: null,
    expectedStatus: 'applied',
  },
  {
    // The race of the brief: Mesa 1 took the captain 0,8 s ago, Mesa 2 still showed the
    // layer empty, so its take of the chief would replace her unseen.
    name: "refuses another console's take that changed the layer 0,8 s ago, unseen",
    instancesOnAir: [buildCaptainOnProgram()],
    lastChangeOfTheLowerThirdLayer: buildChangeOfTheLowerThirdBy(consoleAtMesa1, 800),
    sentFrom: 'Mesa 2',
    instanceIdSeenOnAir: null,
    expectedStatus: 'refused',
  },
  {
    // The last millisecond inside the window still counts as unseen.
    name: "refuses another console's change 1,999 s old",
    instancesOnAir: [buildCaptainOnProgram()],
    lastChangeOfTheLowerThirdLayer: buildChangeOfTheLowerThirdBy(consoleAtMesa1, 1_999),
    sentFrom: 'Mesa 2',
    instanceIdSeenOnAir: null,
    expectedStatus: 'refused',
  },
  {
    // "Less than 2 s": a change exactly 2 s old no longer refuses.
    name: "lets a take through over another console's change exactly 2 s old",
    instancesOnAir: [buildCaptainOnProgram()],
    lastChangeOfTheLowerThirdLayer: buildChangeOfTheLowerThirdBy(consoleAtMesa1, 2_000),
    sentFrom: 'Mesa 2',
    instanceIdSeenOnAir: null,
    expectedStatus: 'applied',
  },
  {
    // After 2 s the operator had every chance to see it: replacing it is a decision.
    name: "lets a take through over another console's change 2,5 s old",
    instancesOnAir: [buildCaptainOnProgram()],
    lastChangeOfTheLowerThirdLayer: buildChangeOfTheLowerThirdBy(consoleAtMesa1, 2_500),
    sentFrom: 'Mesa 2',
    instanceIdSeenOnAir: null,
    expectedStatus: 'applied',
  },
  {
    // Mesa 2's page already showed the captain: replacing her is what the operator meant.
    name: "lets a take through when the page had already seen the other console's take",
    instancesOnAir: [buildCaptainOnProgram()],
    lastChangeOfTheLowerThirdLayer: buildChangeOfTheLowerThirdBy(consoleAtMesa1, 800),
    sentFrom: 'Mesa 2',
    instanceIdSeenOnAir: captainOnAirInstanceId,
    expectedStatus: 'applied',
  },
  {
    // A macro's step or a trigger took the captain meanwhile: no console made that change,
    // and automation stays unguarded (out of scope).
    name: 'lets a take through over a change a macro or a trigger made 0,4 s ago',
    instancesOnAir: [buildCaptainOnProgram()],
    lastChangeOfTheLowerThirdLayer: buildChangeOfTheLowerThirdBy(undefined, 400),
    sentFrom: 'Mesa 2',
    instanceIdSeenOnAir: null,
    expectedStatus: 'applied',
  },
  {
    // Mesa 1 cleared the captain 0,8 s ago while Mesa 2 still showed her: putting the chief
    // there now would undo a clear Mesa 2 never saw.
    name: 'refuses a take on a layer another console emptied 0,8 s ago, unseen',
    instancesOnAir: [],
    lastChangeOfTheLowerThirdLayer: buildChangeOfTheLowerThirdBy(consoleAtMesa1, 800),
    sentFrom: 'Mesa 2',
    instanceIdSeenOnAir: captainOnAirInstanceId,
    expectedStatus: 'refused',
  },
  {
    // A Companion button or the D200 sees nothing and says nothing: never guarded.
    name: 'lets the command API take, whatever another console just did',
    instancesOnAir: [buildCaptainOnProgram()],
    lastChangeOfTheLowerThirdLayer: buildChangeOfTheLowerThirdBy(consoleAtMesa1, 800),
    sentFrom: 'the command API',
    instanceIdSeenOnAir: undefined,
    expectedStatus: 'applied',
  },
  {
    // A console's take that does not say what it saw (a page from before this change)
    // is taken as before.
    name: 'lets a console take through when it does not say what it saw',
    instancesOnAir: [buildCaptainOnProgram()],
    lastChangeOfTheLowerThirdLayer: buildChangeOfTheLowerThirdBy(consoleAtMesa1, 800),
    sentFrom: 'Mesa 2',
    instanceIdSeenOnAir: undefined,
    expectedStatus: 'applied',
  },
  {
    // Right after a restart the store knows no layer's last change (it is not saved).
    name: "lets a take through when the layer's last change is not known",
    instancesOnAir: [buildCaptainOnProgram()],
    lastChangeOfTheLowerThirdLayer: undefined,
    sentFrom: 'Mesa 2',
    instanceIdSeenOnAir: null,
    expectedStatus: 'applied',
  },
];

const casesOfAServerClockStep: TableRow[] = [
  {
    // The clock was stepped back 1,5 s after Mesa 1's take: on the clock the take now reads
    // 0,7 s in the future. No time measured across a step counts, so it is old.
    name: 'lets a take through when the server clock stepped back since the other change',
    instancesOnAir: [buildCaptainOnProgram()],
    lastChangeOfTheLowerThirdLayer: buildChangeOfTheLowerThirdBy(consoleAtMesa1, -700, 0),
    sentFrom: 'Mesa 2',
    instanceIdSeenOnAir: null,
    serverClockStepCountAtTheTake: 1,
    expectedStatus: 'applied',
  },
  {
    // The clock was stepped forward since Mesa 1's take; the 0,3 s it reads is not real time.
    name: 'lets a take through when the server clock stepped forward since the other change',
    instancesOnAir: [buildCaptainOnProgram()],
    lastChangeOfTheLowerThirdLayer: buildChangeOfTheLowerThirdBy(consoleAtMesa1, 300, 0),
    sentFrom: 'Mesa 2',
    instanceIdSeenOnAir: null,
    serverClockStepCountAtTheTake: 1,
    expectedStatus: 'applied',
  },
  {
    // A change stamped after the take with no step counted cannot be measured: only
    // 0 ≤ elapsed < 2 s is recent, never a negative time.
    name: 'lets a take through over a change stamped after it, with no step counted',
    instancesOnAir: [buildCaptainOnProgram()],
    lastChangeOfTheLowerThirdLayer: buildChangeOfTheLowerThirdBy(consoleAtMesa1, -400, 0),
    sentFrom: 'Mesa 2',
    instanceIdSeenOnAir: null,
    expectedStatus: 'applied',
  },
];

describe('a take on a layer another console just changed, case by case', () => {
  it.each([...casesOfTheBrief, ...casesOfAServerClockStep])('$name', (row) => {
    // Arrange: the race day with what is on air, and the context of the sender.
    const slicesBefore = buildRaceDayWithBothLowerThirds({ instances: row.instancesOnAir });
    const context: ReducerContext =
      row.sentFrom === 'Mesa 2'
        ? buildContextOfMesa2({
            lastChangeOfTheLowerThirdLayer: row.lastChangeOfTheLowerThirdLayer,
            serverClockStepCount: row.serverClockStepCountAtTheTake ?? 0,
          })
        : buildContextOfTheCommandApi({
            lastChangeOfTheLowerThirdLayer: row.lastChangeOfTheLowerThirdLayer,
          });

    // Act: take the team chief on "Tarja", saying what the page showed there.
    const outcome = reduceCommand(
      slicesBefore,
      {
        type: 'takeItem',
        itemId: 'item-tarja-chefe-ufsc',
        instanceIdSeenOnAir: row.instanceIdSeenOnAir,
      },
      context,
    );

    // Assert: refused or applied, as the row says.
    expect(outcome.status, `the take must be ${row.expectedStatus}: ${row.name}`).toBe(
      row.expectedStatus,
    );
  });
});

describe('the refusal of a take over another console unseen change', () => {
  it('names the other console, the item it took, the layer, how long ago and the take not done', () => {
    // Arrange: Mesa 1 took the captain 0,8 s ago; Mesa 2 still shows "Tarja" empty.
    const slicesBefore = buildRaceDayWithBothLowerThirds({ instances: [buildCaptainOnProgram()] });
    const context = buildContextOfMesa2({
      lastChangeOfTheLowerThirdLayer: buildMesa1TookTheCaptain(),
    });

    // Act: Mesa 2 takes the chief.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'takeItem', itemId: 'item-tarja-chefe-ufsc', instanceIdSeenOnAir: null },
      context,
    );

    // Assert: refused with the code, the sentence and both roles for the event log.
    expect(outcome, 'the refusal must say what happened, and keep both roles').toEqual({
      status: 'refused',
      error: { code: 'LAYER_CHANGED_BY_ANOTHER_CONSOLE', message: refusalOfTheChiefOverTheCaptain },
      takesRefusedForAnotherConsole: [
        {
          layerId: 'lower-third',
          refusedConsoleRole: 'produtor',
          otherConsoleRole: 'produtor',
          otherConsoleChangedAt: momentMesa1TookTheCaptain,
        },
      ],
    });
  });

  it('says the other console emptied the layer when it cleared it', () => {
    // Arrange: Mesa 1 cleared the captain 0,8 s ago; Mesa 2 still shows her.
    const slicesBefore = buildRaceDayWithBothLowerThirds({ instances: [] });
    const context = buildContextOfMesa2({
      lastChangeOfTheLowerThirdLayer: buildMesa1TookTheCaptain(),
    });

    // Act: Mesa 2 takes the chief, having seen the captain there.
    const outcome = reduceCommand(
      slicesBefore,
      {
        type: 'takeItem',
        itemId: 'item-tarja-chefe-ufsc',
        instanceIdSeenOnAir: captainOnAirInstanceId,
      },
      context,
    );

    // Assert: the sentence says the layer was emptied.
    expect(
      outcome.status === 'refused' ? outcome.error.message : 'applied',
      'the refusal must say the other console emptied the layer',
    ).toBe(
      'Outra mesa (Produtor) limpou a camada "Tarja" há 0,8 s; ' +
        'sua tomada de "Tarja — chefe da UFSC" não foi feita.',
    );
  });

  it('says "Outra mesa" with no role, and keeps no role, when the consoles have no login', () => {
    // Arrange: the PINs unset: Mesa 1's change carries no role, Mesa 2 is `operador:<id>`.
    const slicesBefore = buildRaceDayWithBothLowerThirds({ instances: [buildCaptainOnProgram()] });
    const context = buildContextOfMesa2({
      actor: 'operador:3f2a9c1e-8b47-4d06-9e15-7c0d2b6a4f81',
      lastChangeOfTheLowerThirdLayer: {
        changedAt: momentMesa1TookTheCaptain,
        serverClockStepCount: 0,
        consoleId: consoleAtMesa1,
      },
    });

    // Act: Mesa 2 takes the chief.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'takeItem', itemId: 'item-tarja-chefe-ufsc', instanceIdSeenOnAir: null },
      context,
    );

    // Assert: no role in the sentence, none in the event-log entry.
    expect(outcome, 'with no login there is no role to name or keep').toEqual({
      status: 'refused',
      error: {
        code: 'LAYER_CHANGED_BY_ANOTHER_CONSOLE',
        message:
          'Outra mesa tomou "Tarja — capitã da UFPR" na camada "Tarja" há 0,8 s; ' +
          'sua tomada de "Tarja — chefe da UFSC" não foi feita.',
      },
      takesRefusedForAnotherConsole: [
        { layerId: 'lower-third', otherConsoleChangedAt: momentMesa1TookTheCaptain },
      ],
    });
  });

  it('reads 1,999 s as "há 1,9 s", never "2,0", which would contradict the 2 s rule', () => {
    // Arrange: Mesa 1's take 1999 ms before Mesa 2's.
    const slicesBefore = buildRaceDayWithBothLowerThirds({ instances: [buildCaptainOnProgram()] });
    const context = buildContextOfMesa2({
      lastChangeOfTheLowerThirdLayer: buildChangeOfTheLowerThirdBy(consoleAtMesa1, 1_999),
    });

    // Act: Mesa 2 takes the chief.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'takeItem', itemId: 'item-tarja-chefe-ufsc', instanceIdSeenOnAir: null },
      context,
    );

    // Assert: the time is rounded down.
    expect(
      outcome.status === 'refused' ? outcome.error.message : 'applied',
      'the seconds must be rounded down to a tenth',
    ).toContain('há 1,9 s;');
  });
});
