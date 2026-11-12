/**
 * Space and "Tomar" on a layer another console just changed (apps/server)
 *
 * What this module is for:
 *   A console's take is refused when another console changed its layer less than 2 s ago and
 *   the page had not shown it yet (BAJAOVRLAY-69). Besides takeItem (a row's "Disparar", a
 *   quick-fire button or key), two more take commands carry what the page saw: Space
 *   (takeNext, the cursor's item) and "Tomar" under the Prévia monitor (takePreview, of a
 *   preview or of a "vai limpar" mark). They must be refused the same way.
 *
 *   Space also carries the cursor item the page saw (gate 2 of PR #64): the server takes at its
 *   own cursor, so when another press moved the cursor meanwhile, what the page saw on air was
 *   about another item, maybe on another layer, and the press is refused instead.
 *
 * What these tests prove:
 *   - Space on the cursor's item is refused with the same sentence as a take of that item.
 *   - Space whose cursor item is no longer the server's (the cursor moved to an item on
 *     another layer) is refused with RUNDOWN_CURSOR_MOVED, naming the new cursor item; at the
 *     cursor the page saw, it is taken; the command API's Space, which names no cursor, takes
 *     the server's.
 *   - "Tomar" of a preview is refused, naming the previewed item.
 *   - "Tomar" of a "vai limpar" mark is refused, saying the clear was not done.
 *
 * What these tests deliberately do not cover:
 *   - The rule case by case (same console, after 2 s, seen, a macro...):
 *     unseenChangeByAnotherConsole.test.ts, through takeItem, the path every take shares.
 *   - "Tomar tudo": takeAllPreviewsAnotherConsole.test.ts.
 */
import type { TakeNextCommand } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { reduceCommand } from '../reducers/reduceCommand.js';
import { mainSessionRundownId } from '../reducers/rundownSlices.testSupport.js';
import {
  buildCaptainOnProgram,
  buildChiefOnPreview,
  buildContextOfMesa2,
  buildContextOfTheCommandApi,
  buildMesa1TookTheCaptain,
  buildRaceDayWithBothLowerThirds,
  refusalOfTheChiefOverTheCaptain,
} from './twoConsolesOnOneLayerFixtures.testSupport.js';

const spaceCases: Array<{
  name: string;
  cursorItemIdOnTheServer: string;
  sentFrom: 'Mesa 2' | 'the command API';
  command: TakeNextCommand;
  expectedOutcome: 'taken' | { code: 'RUNDOWN_CURSOR_MOVED'; message: string };
}> = [
  {
    // Both consoles pressed Space on the chief: the other press took him and moved the
    // cursor to the yellow flag, on "Relógio". Mesa 2's press says it saw "Tarja" empty,
    // which says nothing about "Relógio": refused, so the flag never airs unseen.
    name: 'refuses Space when the cursor moved to an item on another layer',
    cursorItemIdOnTheServer: 'item-bandeira-amarela',
    sentFrom: 'Mesa 2',
    command: {
      type: 'takeNext',
      rundownId: mainSessionRundownId,
      cursorItemIdSeen: 'item-tarja-chefe-ufsc',
      instanceIdSeenOnAir: null,
    },
    expectedOutcome: {
      code: 'RUNDOWN_CURSOR_MOVED',
      message:
        'O cursor de "Sessão principal" mudou para "Bandeira amarela" antes deste Espaço; ' +
        'nada foi tomado. Confira e aperte de novo.',
    },
  },
  {
    // The everyday Space: the cursor is where the page showed it.
    name: 'takes the cursor item when the cursor is where the page saw it',
    cursorItemIdOnTheServer: 'item-tarja-chefe-ufsc',
    sentFrom: 'Mesa 2',
    command: {
      type: 'takeNext',
      rundownId: mainSessionRundownId,
      cursorItemIdSeen: 'item-tarja-chefe-ufsc',
      instanceIdSeenOnAir: null,
    },
    expectedOutcome: 'taken',
  },
  {
    // A Companion button's take-next sees no cursor: it takes the server's, as before.
    name: "lets the command API's Space take the server's cursor item",
    cursorItemIdOnTheServer: 'item-bandeira-amarela',
    sentFrom: 'the command API',
    command: { type: 'takeNext', rundownId: mainSessionRundownId },
    expectedOutcome: 'taken',
  },
];

describe('Space when the cursor moved since the page saw it', () => {
  it.each(spaceCases)('$name', (row) => {
    // Arrange: the main session's cursor where the server has it; nothing on air.
    const slicesBefore = buildRaceDayWithBothLowerThirds({
      instances: [],
      cursorItemId: row.cursorItemIdOnTheServer,
    });
    const context =
      row.sentFrom === 'Mesa 2' ? buildContextOfMesa2({}) : buildContextOfTheCommandApi({});

    // Act: the press arrives.
    const outcome = reduceCommand(slicesBefore, row.command, context);

    // Assert: taken, or refused with the code and the sentence of the row.
    const outcomeRead =
      outcome.status === 'applied'
        ? 'taken'
        : { code: outcome.error.code, message: outcome.error.message };
    expect(outcomeRead, `Space must be ${JSON.stringify(row.expectedOutcome)}`).toEqual(
      row.expectedOutcome,
    );
  });
});

describe('Space and "Tomar" over another console unseen take', () => {
  it('refuses Space (takeNext) on the cursor item the same way', () => {
    // Arrange: the main session's cursor on the chief; Mesa 1 took the captain 0,8 s ago.
    const slicesBefore = buildRaceDayWithBothLowerThirds({
      instances: [buildCaptainOnProgram()],
      cursorItemId: 'item-tarja-chefe-ufsc',
    });
    const context = buildContextOfMesa2({
      lastChangeOfTheLowerThirdLayer: buildMesa1TookTheCaptain(),
    });

    // Act: Mesa 2 presses Space.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'takeNext', rundownId: mainSessionRundownId, instanceIdSeenOnAir: null },
      context,
    );

    // Assert: the same refusal as a take of the chief.
    expect(
      outcome.status === 'refused' ? outcome.error.message : 'applied',
      'Space must be refused as a take of the cursor item is',
    ).toBe(refusalOfTheChiefOverTheCaptain);
  });

  it('refuses "Tomar" (takePreview), naming the previewed item', () => {
    // Arrange: the chief in Prévia on "Tarja"; Mesa 1 took the captain 0,8 s ago.
    const slicesBefore = buildRaceDayWithBothLowerThirds({
      instances: [buildCaptainOnProgram(), buildChiefOnPreview()],
    });
    const context = buildContextOfMesa2({
      lastChangeOfTheLowerThirdLayer: buildMesa1TookTheCaptain(),
    });

    // Act: Mesa 2 presses "Tomar" on "Tarja".
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'takePreview', layerId: 'lower-third', instanceIdSeenOnAir: null },
      context,
    );

    // Assert: refused, naming the previewed item (a refusal changes no slice: the preview stays).
    expect(
      outcome.status === 'refused' ? outcome.error.message : 'applied',
      '"Tomar" must be refused, naming the item in Prévia',
    ).toBe(refusalOfTheChiefOverTheCaptain);
  });

  it('refuses "Tomar" of a "vai limpar" mark, saying the clear was not done', () => {
    // Arrange: "Tarja" marked "vai limpar"; Mesa 1 took the captain 0,8 s ago.
    const slicesBefore = buildRaceDayWithBothLowerThirds({
      instances: [buildCaptainOnProgram()],
      previewClearedLayerIds: ['lower-third'],
    });
    const context = buildContextOfMesa2({
      lastChangeOfTheLowerThirdLayer: buildMesa1TookTheCaptain(),
    });

    // Act: Mesa 2 presses "Tomar" on "Tarja", having seen it empty.
    const outcome = reduceCommand(
      slicesBefore,
      { type: 'takePreview', layerId: 'lower-third', instanceIdSeenOnAir: null },
      context,
    );

    // Assert: refused; the clear of the captain, whom Mesa 2 never saw, is not done.
    expect(
      outcome.status === 'refused' ? outcome.error.message : 'applied',
      'the clear must be refused, saying so',
    ).toBe(
      'Outra mesa (Produtor) tomou "Tarja — capitã da UFPR" na camada "Tarja" há 0,8 s; ' +
        'sua limpeza desta camada não foi feita.',
    );
  });
});
