/**
 * The plain sponsor roll's lifecycle and its one pass (packages/graphics/sponsor-roll-plain)
 *
 * What this module is for:
 *   The plain sponsor roll (BAJAOVRLAY-64) shows every sponsor once, one at a time on the
 *   theme's card in the corner the item picks: the level's heading over the logo, nothing
 *   else. It goes through the sponsors on shared's one table (sponsorRollPass.ts), the very
 *   plan the server's auto-out is worked out from, so the layer is cleared exactly when the
 *   last sponsor's hold ends. It never loops: after the last hold it waits for that clear.
 *
 * What these tests prove (fake timers, no theme token, so each fade lasts 0 ms):
 *   - Load refuses data with no sponsors (400) and a list where no sponsor has a logo (422),
 *     in pt-BR; a sponsor with no logo is left off the card.
 *   - Play shows the first sponsor under its level's heading, in the round's order.
 *   - Each sponsor turns to the next exactly when the plan says (8,4 s, then 13,4 s), and the
 *     last one stays after the pass with no timer left: one pass, never a second.
 *   - The pass the graphic runs ends where shared's measure, the server's auto-out, ends.
 *   - Stop calls the turns off; a play after it starts the pass over from the first sponsor.
 *   - An update on air with a new list keeps the pass it started (the server does the same);
 *     the next play shows the new list. A new corner moves the card at once.
 *
 * What these tests deliberately do not cover:
 *   - The plan and the table; shared's sponsorRollPass.test.ts.
 *   - The look on screen; e2e/sponsorRollPlainScreenshots.e2e.ts.
 *   - The OGraf step rules shared by every graphic; the kit's playSteps.test.ts.
 */
import { measurePlainSponsorRollPassMs } from '@bajaovrlay/shared/sponsorRollPass';
import { describe, expect, it } from 'vitest';

import {
  createPlainRollOnThePage,
  createThreeSponsorsRoll,
  loadPlainRollWithData,
  readTheCardsPosition,
  readTheSponsorShown,
  readTheSponsorsOfTheCard,
  takeControlOfTimers,
} from './sponsorRollPlainOnThePage.testSupport.js';

describe('load', () => {
  it('refuses data with no sponsors, naming the field in pt-BR', async () => {
    // Arrange: a roll on the page.
    takeControlOfTimers();
    const roll = createPlainRollOnThePage();

    // Act: load it with an empty list.
    const answer = await loadPlainRollWithData(roll, { sponsors: [] });

    // Assert: 400, with the reason in pt-BR.
    expect(answer, 'an empty list is bad data').toEqual({
      statusCode: 400,
      statusMessage: 'Valor inválido no campo "sponsors".',
    });
  });

  it('refuses a list where no sponsor has a logo with 422, in pt-BR', async () => {
    // Arrange: Randon, typed with no logo yet.
    takeControlOfTimers();
    const roll = createPlainRollOnThePage();

    // Act: load it.
    const answer = await loadPlainRollWithData(roll, {
      sponsors: [{ name: 'Randon', level: 'prata' }],
    });

    // Assert: nothing to show, so the card is never an empty one.
    expect(answer, 'a roll with nothing to show must say so').toEqual({
      statusCode: 422,
      statusMessage: 'Nenhum patrocinador da lista tem logo; não há o que mostrar.',
    });
  });

  it('leaves a sponsor with no logo off the card', async () => {
    // Arrange: the three sponsors, and Randon with no logo among them.
    takeControlOfTimers();
    const roll = createPlainRollOnThePage();
    const data = createThreeSponsorsRoll();
    data.sponsors.splice(1, 0, { name: 'Randon', level: 'prata', logoUrl: '' });

    // Act: load it.
    const answer = await loadPlainRollWithData(roll, data);

    // Assert: loaded, with a cell for each sponsor that has a logo, in the round's order.
    expect(answer.statusCode, 'the roll loads').toBe(200);
    expect(readTheSponsorsOfTheCard(roll), 'Randon is never an empty card').toEqual([
      'Bosch',
      'Petrobras',
      'SAE Brasil',
    ]);
  });
});

describe('one pass', () => {
  it('shows the first sponsor under its level’s heading when played', async () => {
    // Arrange: the roll loaded.
    takeControlOfTimers();
    const roll = createPlainRollOnThePage();
    await loadPlainRollWithData(roll, createThreeSponsorsRoll());

    // Act: play it.
    const answer = await roll.playAction({});

    // Assert: Bosch, under "PATROCÍNIO DIAMANTE".
    expect(answer, 'play answers step 0').toEqual({ statusCode: 200, currentStep: 0 });
    expect(readTheSponsorShown(roll), 'the first sponsor of the round').toEqual({
      heading: 'PATROCÍNIO DIAMANTE',
      name: 'Bosch',
    });
  });

  const turnScenarios = [
    // Bosch holds 8 s after the 0,4 s entrance: still up a millisecond before.
    { name: 'still shows Bosch at 8399 ms', atMs: 8399, expected: 'Bosch' },
    // Then Petrobras, exactly when the plan says.
    { name: 'turns to Petrobras at 8400 ms', atMs: 8400, expected: 'Petrobras' },
    // Petrobras holds 5 s.
    { name: 'still shows Petrobras at 13 399 ms', atMs: 13_399, expected: 'Petrobras' },
    // Then SAE Brasil, the organiser, last.
    { name: 'turns to SAE Brasil at 13 400 ms', atMs: 13_400, expected: 'SAE Brasil' },
    // Past the pass's end the last sponsor stays until the server's clear: no loop.
    { name: 'still shows SAE Brasil after the pass', atMs: 30_000, expected: 'SAE Brasil' },
  ];

  it.each(turnScenarios)('$name', async ({ atMs, expected }) => {
    // Arrange: the roll loaded and played.
    const { letTimePass } = takeControlOfTimers();
    const roll = createPlainRollOnThePage();
    await loadPlainRollWithData(roll, createThreeSponsorsRoll());
    await roll.playAction({});

    // Act: time runs to this row's moment.
    await letTimePass(atMs);

    // Assert: the sponsor the plan has on air then.
    expect(readTheSponsorShown(roll)?.name, `the plan has ${expected} on air`).toBe(expected);
  });

  it('leaves no timer once the pass is over: it never starts a second one', async () => {
    // Arrange: the roll loaded and played.
    const { letTimePass, countPendingTimers } = takeControlOfTimers();
    const roll = createPlainRollOnThePage();
    await loadPlainRollWithData(roll, createThreeSponsorsRoll());
    await roll.playAction({});

    // Act: the whole pass goes by.
    await letTimePass(18_400);

    // Assert: nothing left to turn.
    expect(countPendingTimers(), 'one pass, then nothing').toBe(0);
  });

  it('ends its last turn inside the pass the server’s auto-out waits for', async () => {
    // Arrange: the roll loaded and played; the server's length of the same list.
    const { letTimePass, countPendingTimers } = takeControlOfTimers();
    const roll = createPlainRollOnThePage();
    const data = createThreeSponsorsRoll();
    await loadPlainRollWithData(roll, data);
    await roll.playAction({});
    const serversPassMs = measurePlainSponsorRollPassMs(data.sponsors);

    // Act: time runs to a millisecond before the server clears the layer.
    await letTimePass(serversPassMs - 1);

    // Assert: the last sponsor is up and no turn is left: the graphic and the server agree.
    expect(readTheSponsorShown(roll)?.name, 'the last sponsor is up before the clear').toBe(
      'SAE Brasil',
    );
    expect(countPendingTimers(), 'no turn may come after the server’s clear').toBe(0);
  });
});

describe('stop and play again', () => {
  it('calls the turns off at stop, and starts the pass over at the next play', async () => {
    // Arrange: the roll played and turned to Petrobras.
    const { letTimePass, countPendingTimers } = takeControlOfTimers();
    const roll = createPlainRollOnThePage();
    await loadPlainRollWithData(roll, createThreeSponsorsRoll());
    await roll.playAction({});
    await letTimePass(9000);

    // Act: stop, then play again.
    await roll.stopAction({});
    const timersAfterTheStop = countPendingTimers();
    await roll.playAction({});

    // Assert: no turn left after the stop; the new pass starts at Bosch.
    expect(timersAfterTheStop, 'stop calls every turn off').toBe(0);
    expect(readTheSponsorShown(roll)?.name, 'a new play starts the pass over').toBe('Bosch');
  });
});

describe('update', () => {
  it('keeps the pass it started when the list changes on air, and shows the new list next time', async () => {
    // Arrange: the roll played, 10 s in (Petrobras on air).
    const { letTimePass } = takeControlOfTimers();
    const roll = createPlainRollOnThePage();
    await loadPlainRollWithData(roll, createThreeSponsorsRoll());
    await roll.playAction({});
    await letTimePass(10_000);

    // Act: Fiat, a Diamante, is added on air; the pass runs out; then stop and play again.
    const fiat = { name: 'Fiat', level: 'diamante', logoUrl: '/media/logo-fiat' };
    const answer = await roll.updateAction({
      data: { sponsors: [...createThreeSponsorsRoll().sponsors, fiat] },
    });
    const sponsorsDuringThePass = readTheSponsorsOfTheCard(roll);
    await letTimePass(8400);
    const shownAtTheEnd = readTheSponsorShown(roll)?.name;
    await roll.stopAction({});
    await roll.playAction({});

    // Assert: the pass on air is the one taken; the next one has Fiat.
    expect(answer.statusCode, 'the update is taken').toBe(200);
    expect(sponsorsDuringThePass, 'the pass on air keeps its sponsors').toEqual([
      'Bosch',
      'Petrobras',
      'SAE Brasil',
    ]);
    expect(shownAtTheEnd, 'and ends where it was planned').toBe('SAE Brasil');
    expect(readTheSponsorsOfTheCard(roll), 'the next pass has Fiat').toEqual([
      'Bosch',
      'Fiat',
      'Petrobras',
      'SAE Brasil',
    ]);
  });

  it('moves the card to a new corner at once, on the safe edges', async () => {
    // Arrange: the roll on air, top-left.
    takeControlOfTimers();
    const roll = createPlainRollOnThePage();
    await loadPlainRollWithData(roll, createThreeSponsorsRoll());
    await roll.playAction({});

    // Act: move it to the bottom-left.
    await roll.updateAction({ data: { corner: 'bottom-left' } });

    // Assert: held by the bottom and the left safe edges.
    expect(readTheCardsPosition(roll), 'the card sits in the bottom-left corner').toEqual({
      top: 'auto',
      left: 'var(--stage-safe-side)',
      bottom: 'var(--stage-safe-bottom)',
    });
  });
});
