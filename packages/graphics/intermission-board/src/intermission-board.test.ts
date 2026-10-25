/**
 * The intermission board web component: load, play, update, stop and dispose, its count and
 * its sponsor line on air (packages/graphics/intermission-board)
 *
 * What this module is for:
 *   intermission-board.ts is the OGraf graphic itself: the next session with its count (the
 *   countdown's kit parts), the top five and the sponsor line (the sponsor roll's paging rule
 *   and timer), each of the last two optional (BAJAOVRLAY-46).
 *
 * What these tests prove (Date, the timers and the frames faked, the sponsor holds on the page):
 *   - load draws the next session, "LARGADA ÀS 10:00" and the count as it is now, off air;
 *     bad data answers 400; calls at the wrong moment answer 409 or 404.
 *   - On air the count follows the clock and stops at "0:00".
 *   - The sponsor line turns after each page's level hold: Diamante 8 s, then the Ouro
 *     pages 5 s each (five Ouro on lines of four share 3 + 2), then Realização.
 *   - A top five and a sponsor line added on air are drawn on air at once; taken off, they
 *     leave, and with one line page left its timer stops.
 *   - stop, dispose and removal each stop both the count and the line's timer: nothing is
 *     left booked (these fail if the stop is removed).
 *   - With the real 17 (seven line pages), a list that shrinks to three under page 5 goes
 *     back to page 1 in place.
 *   - An update off air is drawn from page 1 and books nothing; one during the stop-out
 *     leaves the fading board alone and is drawn once it has faded.
 *
 * What these tests deliberately do not cover:
 *   - Which parts each combination draws, and the motion's timing; the view and
 *     animations tests.
 *   - Real rendering; e2e/ runs the built graphic in Chromium.
 */
import { finishEveryRunningMotionAtOnce } from '@bajaovrlay/graphics-kit/runningMotions.testSupport';
import { createThe30thCompetitionSponsors } from '@bajaovrlay/graphics-kit/the30thCompetitionSponsors.testSupport';
import { describe, expect, it } from 'vitest';

import {
  createBreakBeforeTheEnduro,
  createEightSponsors,
  createIntermissionBoardOnThePage,
  isPartDrawn,
  loadIntermissionBoardWithData,
  placeTheSponsorHoldsOnTheRoot,
  readShownText,
  readSponsorLineShown,
  takeControlOfTime,
} from './intermissionBoardOnThePage.testSupport.js';

/** The break with both parts, loaded, then played with time under the test's control. */
async function putTheFullBreakOnAir() {
  placeTheSponsorHoldsOnTheRoot();
  const board = createIntermissionBoardOnThePage();
  await loadIntermissionBoardWithData(
    board,
    createBreakBeforeTheEnduro({ hasTopFive: true, hasSponsors: true }),
  );
  const time = takeControlOfTime();
  await board.playAction({ skipAnimation: true });
  return { board, time };
}

describe('load', () => {
  it('draws the next session, its start and the count as it is now, off air', async () => {
    // Arrange: a board on the page.
    const board = createIntermissionBoardOnThePage();

    // Act: load the break at the real moment, with a start two hours away.
    const answer = await loadIntermissionBoardWithData(board, {
      ...createBreakBeforeTheEnduro({ hasTopFive: true, hasSponsors: false }),
      nextStartsAtMs: Date.now() + 2 * 3_600_000,
    });

    // Assert: 200, the head's title, the session and a count of two hours.
    expect(answer, 'load must answer 200').toEqual({ statusCode: 200 });
    expect(readShownText(board, 'intermission-title'), 'the head').toBe('INTERVALO');
    expect(readShownText(board, 'intermission-session'), 'what is next').toBe(
      'Enduro de Resistência',
    );
    expect(readShownText(board, 'intermission-count'), 'the count').toBe('2:00:00');
  });

  it('answers 400 naming a start that is not a whole number', async () => {
    // Arrange: a board on the page.
    const board = createIntermissionBoardOnThePage();

    // Act: load data whose start is text.
    const answer = await loadIntermissionBoardWithData(board, {
      ...createBreakBeforeTheEnduro({ hasTopFive: false, hasSponsors: false }),
      nextStartsAtMs: '10:00',
    });

    // Assert: refused, naming the field.
    expect(answer, 'refused').toEqual({
      statusCode: 400,
      statusMessage: 'Valor inválido no campo "nextStartsAtMs".',
    });
  });

  it('answers 409 before load and after dispose, 404 to a custom action', async () => {
    // Arrange: a board never loaded.
    const board = createIntermissionBoardOnThePage();

    // Act: play it, ask a custom action, dispose it and update it.
    const playBeforeLoad = await board.playAction({});
    const customAction = await board.customAction({ id: 'pular', payload: {} });
    await board.dispose();
    const updateAfterDispose = await board.updateAction({ data: { nextSessionName: 'Premiação' } });

    // Assert: answered, never thrown.
    expect(
      [playBeforeLoad.statusCode, customAction.statusCode, updateAfterDispose.statusCode],
      'wrong-moment calls answer',
    ).toEqual([409, 404, 409]);
  });
});

describe('on air', () => {
  it('counts down on the clock and stops at 0:00', async () => {
    // Arrange: the break on air at 09:36:15.
    const { board, time } = await putTheFullBreakOnAir();
    const countAtTheTake = readShownText(board, 'intermission-count');

    // Act: the clock moves a minute on, then past the start, a frame running after each.
    await time.jumpTheClockAndRunAFrame(60_000);
    const countAMinuteLater = readShownText(board, 'intermission-count');
    await time.jumpTheClockAndRunAFrame(23 * 60_000);

    // Assert: 23:45, 22:45, then 0:00.
    expect(
      [countAtTheTake, countAMinuteLater, readShownText(board, 'intermission-count')],
      'the count follows the clock and stops at zero',
    ).toEqual(['23:45', '22:45', '0:00']);
  });

  it('turns the sponsor line after each page’s level hold, the organiser last', async () => {
    // Arrange: the break on air with its eight sponsors (Diamante 2, Ouro 3 + 2, Realização 1).
    const { board, time } = await putTheFullBreakOnAir();
    const pagesSeen = [readSponsorLineShown(board)];

    // Act: the Diamante hold (8 s), then the two Ouro holds (5 s each).
    for (const holdMs of [8000, 5000, 5000]) {
      await time.letTimePass(holdMs);
      pagesSeen.push(readSponsorLineShown(board));
    }

    // Assert: each page with its heading and logos.
    expect(pagesSeen, 'the line turns through the round').toEqual([
      { heading: 'PATROCÍNIO DIAMANTE', names: ['Bosch', 'Renault'] },
      { heading: 'PATROCÍNIO OURO', names: ['Certi', 'CNH', 'Himix'] },
      { heading: 'PATROCÍNIO OURO', names: ['Horse', 'Marcopolo'] },
      { heading: 'REALIZAÇÃO', names: ['SAE Brasil'] },
    ]);
  });

  it('draws a top five and a sponsor line added on air, and stops the line with one page left', async () => {
    // Arrange: the break on air with neither part.
    placeTheSponsorHoldsOnTheRoot();
    const board = createIntermissionBoardOnThePage();
    await loadIntermissionBoardWithData(
      board,
      createBreakBeforeTheEnduro({ hasTopFive: false, hasSponsors: false }),
    );
    const time = takeControlOfTime();
    await board.playAction({ skipAnimation: true });

    // Act: the standings and the sponsors arrive; then the line shrinks to Diamante only.
    const withBoth = createBreakBeforeTheEnduro({ hasTopFive: true, hasSponsors: true });
    await board.updateAction({ data: { topFive: withBoth.topFive, sponsors: withBoth.sponsors } });
    const isTopFiveDrawn = isPartDrawn(board, 'intermission-top-five');
    const isLineDrawn = isPartDrawn(board, 'intermission-sponsor-line');
    await board.updateAction({ data: { sponsors: createEightSponsors().slice(0, 2) } });

    // Assert: both drawn, on air; the line's single page with no timer left but the count's.
    expect([isTopFiveDrawn, isLineDrawn], 'both parts came in').toEqual([true, true]);
    expect(
      board.shadowRoot?.querySelector<HTMLElement>('[data-testid="intermission-row"]')?.style
        .opacity,
      'a row that came in is on air at once',
    ).toBe('1');
    expect(readSponsorLineShown(board).heading, 'one page left').toBe('PATROCÍNIO DIAMANTE');
    expect(time.countPendingTimers(), 'only the count’s frame is left').toBe(1);
  });
});

describe('the real 17 on the line', () => {
  it('goes back to page 1 in place when the list shrinks under the page shown', async () => {
    // Arrange: the break on air with the real 17 (seven line pages: Diamante 2, Ouro
    // 3 + 3 + 3, Apoio 3 + 2, Realização 1), turned to page 5, the first Apoio page.
    placeTheSponsorHoldsOnTheRoot();
    const board = createIntermissionBoardOnThePage();
    await loadIntermissionBoardWithData(board, {
      ...createBreakBeforeTheEnduro({ hasTopFive: true, hasSponsors: false }),
      sponsors: createThe30thCompetitionSponsors(),
    });
    const time = takeControlOfTime();
    await board.playAction({ skipAnimation: true });
    for (const holdMs of [8000, 5000, 5000, 5000]) {
      await time.letTimePass(holdMs);
    }
    const lineBeforeTheEdit = readSponsorLineShown(board);

    // Act: Cadastros keeps the nine Ouro sponsors only (three line pages).
    const theNineOuro = createThe30thCompetitionSponsors().filter(
      (sponsor) => sponsor.level === 'ouro',
    );
    await board.updateAction({ data: { sponsors: theNineOuro } });

    // Assert: page 5 was the first Apoio page; now page 1 of three, the first Ouro logos.
    expect(lineBeforeTheEdit, 'page 5 of 7 before the edit').toEqual({
      heading: 'APOIO',
      names: ['Criciúma', 'Osaki', 'SAE4Mobility'],
    });
    expect(readSponsorLineShown(board), 'back to page 1, in place').toEqual({
      heading: 'PATROCÍNIO OURO',
      names: ['Certi', 'CNH', 'Himix'],
    });
  });
});

describe('an update off air', () => {
  it('draws the new data off air from page 1 and books nothing', async () => {
    // Arrange: the break played, its line turned to the first Ouro page, then stopped.
    const { board, time } = await putTheFullBreakOnAir();
    await time.letTimePass(8000);
    await board.stopAction({ skipAnimation: true });

    // Act: the session is renamed and the organiser deleted while off air.
    const answer = await board.updateAction({
      data: { nextSessionName: 'Super Prime', sponsors: createEightSponsors().slice(0, 7) },
    });

    // Assert: accepted, drawn (the new session, the line from page 1), nothing running.
    expect(answer, 'the update must answer 200').toEqual({ statusCode: 200 });
    expect(readShownText(board, 'intermission-session'), 'the new session').toBe('Super Prime');
    expect(readSponsorLineShown(board).heading, 'the line from page 1').toBe('PATROCÍNIO DIAMANTE');
    expect(time.countPendingTimers(), 'an update off air books nothing').toBe(0);
  });
});

describe('stopped', () => {
  const stops = [
    // stopAction: the board leaves the air.
    {
      name: 'stops the count and the line on stop',
      stopTheBoard: (board: HTMLElement & { stopAction: (params: object) => Promise<unknown> }) =>
        board.stopAction({ skipAnimation: true }),
    },
    // dispose: the renderer is done with the board.
    {
      name: 'stops the count and the line on dispose',
      stopTheBoard: (board: HTMLElement & { dispose: () => Promise<unknown> }) => board.dispose(),
    },
    // Removal from the page without dispose.
    {
      name: 'stops the count and the line when the element leaves the page',
      stopTheBoard: (board: HTMLElement) => Promise.resolve(board.remove()),
    },
  ];

  it.each(stops)('$name', async ({ stopTheBoard }) => {
    // Arrange: the break on air, its count ticking and its line's timer booked.
    const { board, time } = await putTheFullBreakOnAir();

    // Act: stop it this way.
    await stopTheBoard(board);

    // Assert: no frame and no timer left.
    expect(time.countPendingTimers(), 'nothing keeps running in OBS').toBe(0);
  });
});

describe('an update during the stop-out', () => {
  it('leaves the fading line alone, then draws the new line once the board has faded', async () => {
    // Arrange: the break on air, its line turned to the first Ouro page, the stop-out
    // lasting 250 ms (on the board itself, since jsdom carries no custom property from
    // :root into a shadow root), the stop started.
    const { board, time } = await putTheFullBreakOnAir();
    await time.letTimePass(8000);
    board.shadowRoot
      ?.querySelector<HTMLElement>('[data-testid="intermission-board"]')
      ?.style.setProperty('--motion-out', '250ms');
    const pendingStop = board.stopAction({});

    // Act: the organiser is deleted in Cadastros while the board fades (three line pages
    // left); then the stop-out is ended at once (never waited for: a real motion under
    // fake time may outlast the test's timeout), and a Diamante hold passes off air.
    const answer = await board.updateAction({
      data: { sponsors: createEightSponsors().slice(0, 7) },
    });
    const lineDuringTheStopOut = readSponsorLineShown(board);
    finishEveryRunningMotionAtOnce();
    await pendingStop;
    const lineOnceFaded = readSponsorLineShown(board);
    await time.letTimePass(8000);

    // Assert: accepted, the fading line unchanged, the new line drawn once faded, and it
    // does not turn off air. (No timer count here: GSAP's own frame may still be booked
    // just after a real stop-out; the "stopped" tests count the board's timers.)
    expect(answer, 'the update must answer 200').toEqual({ statusCode: 200 });
    expect(lineDuringTheStopOut, 'the fading line keeps its page').toEqual({
      heading: 'PATROCÍNIO OURO',
      names: ['Certi', 'CNH', 'Himix'],
    });
    expect(lineOnceFaded, 'the new line once faded').toEqual({
      heading: 'PATROCÍNIO DIAMANTE',
      names: ['Bosch', 'Renault'],
    });
    expect(readSponsorLineShown(board), 'the line does not turn off air').toEqual(lineOnceFaded);
  });
});
