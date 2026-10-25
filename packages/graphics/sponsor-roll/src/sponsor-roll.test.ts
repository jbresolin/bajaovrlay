/**
 * The sponsor roll web component: load, play, update, stop and dispose, and its pages turning
 * on air (packages/graphics/sponsor-roll)
 *
 * What this module is for:
 *   sponsor-roll.ts is the OGraf graphic itself: every sponsor, the round in the kit's order,
 *   each page (each sponsor, in the corner) held by its level's hold (BAJAOVRLAY-46).
 *
 * What these tests prove (Ardósia's holds on the page, timers faked after load):
 *   - load draws page 1 off air: "PATROCÍNIO DIAMANTE", "1/5", Bosch and Renault; bad data
 *     answers 400; calls at the wrong moment answer 409 or 404.
 *   - On the full screen the pages turn after their level's hold: 8 s on Diamante, then
 *     the two Ouro pages 5 s each, Apoio 3 s, Realização 5 s, and back to page 1.
 *   - In the corner each sponsor crossfades to the next after its own level's hold: Bosch
 *     8 s, Renault 8 s, then Certi, CNH… 5 s each.
 *   - A list that shrinks on air under the page shown goes back to page 1 in place; one
 *     page left, the timer stops.
 *   - stop, dispose and removal from the page each stop the page timer: no timer is left
 *     and the holds passing turn nothing (these fail if the stop is removed); an update off
 *     air draws page 1 and books nothing; one during the stop-out leaves the fading page
 *     alone and is drawn from page 1 once the roll has faded.
 *
 * What these tests deliberately do not cover:
 *   - The paging rules themselves; the kit's sponsorPages test and sponsorRollModel.test.ts.
 *   - Real rendering and motion; e2e/ runs the built graphic in Chromium.
 */
import { describe, expect, it } from 'vitest';

import {
  createSponsorRollOnThePage,
  createThe30thCompetitionRoll,
  createThe30thCompetitionSponsors,
  loadSponsorRollWithData,
  placeTheSponsorHoldsOnTheRoot,
  readCornerSponsorShown,
  readHead,
  readNamesOfTheTilesShown,
  takeControlOfTimers,
} from './sponsorRollOnThePage.testSupport.js';

/** The roll of the 17 loaded and played in a layout, the timers faked from the play on. */
async function putTheRollOnAir(layout: 'fullscreen' | 'corner') {
  placeTheSponsorHoldsOnTheRoot();
  const roll = createSponsorRollOnThePage();
  await loadSponsorRollWithData(roll, createThe30thCompetitionRoll(layout));
  const timers = takeControlOfTimers();
  await roll.playAction({ skipAnimation: true });
  return { roll, timers };
}

describe('load', () => {
  it('draws page 1 off air: Diamante, 1/5, Bosch and Renault', async () => {
    // Arrange: a roll on the page.
    const roll = createSponsorRollOnThePage();

    // Act: load the 17 on the full screen.
    const answer = await loadSponsorRollWithData(roll, createThe30thCompetitionRoll('fullscreen'));

    // Assert: 200, the head of page 1, its two tiles waiting off air.
    expect(answer, 'load must answer 200').toEqual({ statusCode: 200 });
    expect(readHead(roll), 'page 1 of 5').toEqual({
      heading: 'PATROCÍNIO DIAMANTE',
      pageLine: '1/5',
    });
    expect(
      roll.shadowRoot?.querySelectorAll('[data-testid="sponsor-roll-tile"]').length,
      'Bosch and Renault',
    ).toBe(2);
    expect(readNamesOfTheTilesShown(roll), 'nothing shows before play').toEqual([]);
  });

  it('answers 400 naming a sponsor of a level nobody sells', async () => {
    // Arrange: a roll, and Bosch at "platina".
    const roll = createSponsorRollOnThePage();
    const [bosch] = createThe30thCompetitionSponsors();

    // Act: load it.
    const answer = await loadSponsorRollWithData(roll, {
      layout: 'fullscreen',
      sponsors: [{ ...bosch, level: 'platina' }],
    });

    // Assert: refused, naming the field.
    expect(answer.statusCode, 'bad data answers 400').toBe(400);
  });

  it('answers 409 before load and after dispose, 404 to a custom action', async () => {
    // Arrange: a roll never loaded.
    const roll = createSponsorRollOnThePage();

    // Act: play it, ask a custom action, dispose it and update it.
    const playBeforeLoad = await roll.playAction({});
    const customAction = await roll.customAction({ id: 'proxima', payload: {} });
    await roll.dispose();
    const updateAfterDispose = await roll.updateAction({ data: { eventWord: 'SUPER PRIME' } });

    // Assert: answered, never thrown.
    expect(
      [playBeforeLoad.statusCode, customAction.statusCode, updateAfterDispose.statusCode],
      'wrong-moment calls answer',
    ).toEqual([409, 404, 409]);
  });
});

describe('the full screen on air', () => {
  it('turns each page after its level’s hold, the organiser last, then back to page 1', async () => {
    // Arrange: the 17 on air on the full screen.
    const { roll, timers } = await putTheRollOnAir('fullscreen');
    const pagesSeen = [readHead(roll)];

    // Act: let each page's hold pass in turn: Diamante 8 s, Ouro 5 s twice, Apoio 3 s,
    // Realização 5 s.
    for (const holdMs of [8000, 5000, 5000, 3000, 5000]) {
      await timers.letTimePass(holdMs);
      pagesSeen.push(readHead(roll));
    }

    // Assert: the five pages in round order, each turned exactly at its hold, then page 1.
    expect(pagesSeen, 'the round, each page held by its level').toEqual([
      { heading: 'PATROCÍNIO DIAMANTE', pageLine: '1/5' },
      { heading: 'PATROCÍNIO OURO', pageLine: '2/5' },
      { heading: 'PATROCÍNIO OURO', pageLine: '3/5' },
      { heading: 'APOIO', pageLine: '4/5' },
      { heading: 'REALIZAÇÃO', pageLine: '5/5' },
      { heading: 'PATROCÍNIO DIAMANTE', pageLine: '1/5' },
    ]);
  });

  it('holds the Diamante page its full 8 s, not the general 5 s', async () => {
    // Arrange: the 17 on air on the full screen.
    const { roll, timers } = await putTheRollOnAir('fullscreen');

    // Act: 7.9 s pass.
    await timers.letTimePass(7900);

    // Assert: still page 1.
    expect(readHead(roll).pageLine, 'Diamante is held 8 s').toBe('1/5');
  });

  it('shows the new page’s tiles once it has turned', async () => {
    // Arrange: the 17 on air on the full screen.
    const { roll, timers } = await putTheRollOnAir('fullscreen');

    // Act: the Diamante hold passes.
    await timers.letTimePass(8000);

    // Assert: the first five Ouro, shared 5 + 4.
    expect(readNamesOfTheTilesShown(roll), 'the first Ouro page').toEqual([
      'Certi',
      'CNH',
      'Himix',
      'Horse',
      'Marcopolo',
    ]);
  });

  it('goes back to page 1 in place when the list shrinks under the page shown', async () => {
    // Arrange: the 17 on air, turned to page 4 (Apoio).
    const { roll, timers } = await putTheRollOnAir('fullscreen');
    await timers.letTimePass(8000 + 5000 + 5000);

    // Act: Cadastros keeps the Diamante and Ouro sponsors only (three pages).
    const diamanteAndOuro = createThe30thCompetitionSponsors().filter(
      (sponsor) => sponsor.level === 'diamante' || sponsor.level === 'ouro',
    );
    await roll.updateAction({ data: { sponsors: diamanteAndOuro } });

    // Assert: page 1 of 3, its tiles on air.
    expect(readHead(roll), 'back to page 1').toEqual({
      heading: 'PATROCÍNIO DIAMANTE',
      pageLine: '1/3',
    });
    expect(readNamesOfTheTilesShown(roll), 'its tiles shown').toEqual(['Bosch', 'Renault']);
  });

  it('stops turning when the list shrinks to one page', async () => {
    // Arrange: the 17 on air.
    const { roll, timers } = await putTheRollOnAir('fullscreen');

    // Act: only the two Diamante sponsors are left.
    const diamanteOnly = createThe30thCompetitionSponsors().filter(
      (sponsor) => sponsor.level === 'diamante',
    );
    await roll.updateAction({ data: { sponsors: diamanteOnly } });

    // Assert: one page, no timer.
    expect(readHead(roll).pageLine, 'one page').toBe('1/1');
    expect(timers.countPendingTimers(), 'nothing to turn to').toBe(0);
  });
});

describe('the corner on air', () => {
  it('crossfades each sponsor to the next after its own level’s hold', async () => {
    // Arrange: the 17 on air in the corner.
    const { roll, timers } = await putTheRollOnAir('corner');
    const sponsorsSeen = [readCornerSponsorShown(roll)];

    // Act: Bosch's 8 s, Renault's 8 s, Certi's 5 s pass.
    for (const holdMs of [8000, 8000, 5000]) {
      await timers.letTimePass(holdMs);
      sponsorsSeen.push(readCornerSponsorShown(roll));
    }

    // Assert: Bosch, Renault, Certi, CNH, each under its level's heading.
    expect(sponsorsSeen, 'one sponsor at a time, in round order').toEqual([
      { heading: 'PATROCÍNIO DIAMANTE', name: 'Bosch' },
      { heading: 'PATROCÍNIO DIAMANTE', name: 'Renault' },
      { heading: 'PATROCÍNIO OURO', name: 'Certi' },
      { heading: 'PATROCÍNIO OURO', name: 'CNH' },
    ]);
  });
});

describe('the page timer stopped', () => {
  it('stops on stop: no timer is left, and the holds turn nothing', async () => {
    // Arrange: the 17 on air on the full screen.
    const { roll, timers } = await putTheRollOnAir('fullscreen');

    // Act: stop it, then far more than a hold passes.
    await roll.stopAction({ skipAnimation: true });
    const timersLeft = timers.countPendingTimers();
    await timers.letTimePass(60_000);

    // Assert: no timer, and page 1 drawn for the next take.
    expect(timersLeft, 'stop must stop the timer').toBe(0);
    expect(readHead(roll).pageLine, 'nothing turns off air').toBe('1/5');
  });

  it('stops on dispose', async () => {
    // Arrange: the 17 on air on the full screen.
    const { roll, timers } = await putTheRollOnAir('fullscreen');

    // Act: dispose it.
    await roll.dispose();

    // Assert: no timer.
    expect(timers.countPendingTimers(), 'dispose must stop the timer').toBe(0);
  });

  it('stops when the element leaves the page without dispose', async () => {
    // Arrange: the 17 on air on the full screen.
    const { roll, timers } = await putTheRollOnAir('fullscreen');

    // Act: the renderer takes the element out of the page.
    roll.remove();

    // Assert: no timer.
    expect(timers.countPendingTimers(), 'a removed roll must not turn').toBe(0);
  });

  it('only stores and draws an update off air, from page 1, booking nothing', async () => {
    // Arrange: the 17 played, turned to page 2, then stopped.
    const { roll, timers } = await putTheRollOnAir('fullscreen');
    await timers.letTimePass(8000);
    await roll.stopAction({ skipAnimation: true });

    // Act: the list changes while off air.
    await roll.updateAction({
      data: { sponsors: createThe30thCompetitionSponsors().slice(0, 11) },
    });

    // Assert: page 1 of the new round, no timer.
    expect(readHead(roll), 'drawn from page 1').toEqual({
      heading: 'PATROCÍNIO DIAMANTE',
      pageLine: '1/3',
    });
    expect(timers.countPendingTimers(), 'an update off air books nothing').toBe(0);
  });
});

describe('an update during the stop-out', () => {
  it('leaves the fading page alone, then draws page 1 of the new round once it has faded', async () => {
    // Arrange: the 17 on air, turned to page 2 (Ouro), the stop-out lasting 250 ms (on the
    // panel itself, since jsdom carries no custom property from :root into a shadow root),
    // the stop started.
    const { roll, timers } = await putTheRollOnAir('fullscreen');
    await timers.letTimePass(8000);
    roll.shadowRoot
      ?.querySelector<HTMLElement>('[data-testid="sponsor-roll-panel"]')
      ?.style.setProperty('--motion-out', '250ms');
    const pendingStop = roll.stopAction({});

    // Act: Cadastros changes the list while the roll fades; then the stop-out ends.
    const answer = await roll.updateAction({
      data: { sponsors: createThe30thCompetitionSponsors().slice(0, 11) },
    });
    const headDuringTheStopOut = readHead(roll);
    await pendingStop;

    // Assert: accepted, the fading page unchanged, page 1 of the new round drawn once faded.
    expect(answer, 'the update must answer 200').toEqual({ statusCode: 200 });
    expect(headDuringTheStopOut, 'the fading page keeps its head').toEqual({
      heading: 'PATROCÍNIO OURO',
      pageLine: '2/5',
    });
    expect(readHead(roll), 'page 1 of the new round once faded').toEqual({
      heading: 'PATROCÍNIO DIAMANTE',
      pageLine: '1/3',
    });
    expect(timers.countPendingTimers(), 'nothing booked off air').toBe(0);
  });
});
