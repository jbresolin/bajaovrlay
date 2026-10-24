/**
 * The standings web component: load, play, stop, dispose and the page timer
 * (packages/graphics/standings)
 *
 * What this module is for:
 *   standings.ts is the OGraf graphic itself: a web component the renderer loads, plays,
 *   updates, stops and disposes, which turns its own pages while on air. It wires the
 *   model, the layout, the view and the animations; each of those has its own tests.
 *
 * What these tests prove:
 *   - Calls made at the wrong moment (play before load, a second load, anything after
 *     dispose, a custom action it does not have) answer a 4xx status with a pt-BR message
 *     instead of throwing. Stop before play is harmless. Bad load data answers 400.
 *   - load draws page 1 off air: the title, the event line, "1/3 · 1º A 20º", 20 rows.
 *   - Play while on air takes the board off; a play cut short by a stop reports no step;
 *     a re-take after a stop on page 2 starts on page 1.
 *   - The page timer, driven by fake time with the hold read from `--motion-board-hold`:
 *     after one hold page 2 is on air (rows 21–40, the head card the same element, its
 *     line "2/3 · 21º A 40º"), after three holds page 1 again; no page turns after stop or
 *     dispose; the columns board with 54 teams (one page) never turns; with 61 teams it
 *     turns to the 61st after the hold. The Playwright paging test relies on this one.
 *   - dispose ends a running play-in (the play answers 409, no tween left), and a dispose
 *     that lands while load is still waiting is not undone.
 *
 * What these tests deliberately do not cover:
 *   - updateAction; standings.updateAction.test.ts covers it.
 *   - Real motion and fonts: jsdom draws nothing, and unless a test places tokens every
 *     timeline lasts 0 ms. The Playwright suites run the built graphic in Chromium.
 */
import { gsap } from 'gsap';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { createOverallStandingsTotalOnly, createOverallStandingsWithParts } from './previewData.js';
import {
  ardosiaMotionTokenDeclarations,
  createOverallEntriesWithSevenLateEntrants,
  createStandingsOnThePage,
  findPartOfStandings,
  loadStandingsWithData,
  placeTokensOnTheRoot,
  readCarNumbersOnTheBoard,
  readPageLine,
} from './standingsOnThePage.testSupport.js';

/** Fakes setTimeout so the test decides when the page hold ends; real timers come back after. */
function takeControlOfTimers() {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  onTestFinished(() => {
    vi.useRealTimers();
  });
}

/** Ardósia's 10 s hold on :root; with no motion token every timeline still lasts 0 ms. */
function placeArdosiaBoardHoldOnTheRoot() {
  placeTokensOnTheRoot({ '--motion-board-hold': '10000ms' });
}

const alreadyDisposedAnswer = {
  statusCode: 409,
  statusMessage: 'A classificação já foi descartada (dispose).',
};

describe('calls made at the wrong moment', () => {
  it('answers 409 to playAction before load, without throwing', async () => {
    // Arrange: a board on the page that was never loaded.
    const standings = createStandingsOnThePage();

    // Act: try to play it.
    const answer = await standings.playAction({});

    // Assert: a 409 with a pt-BR explanation.
    expect(answer, 'play before load must answer 409 with a pt-BR message').toEqual({
      statusCode: 409,
      statusMessage: 'A classificação ainda não foi carregada (load).',
    });
  });

  it('answers 200 to stopAction before playAction, since there is nothing to take off', async () => {
    // Arrange: a loaded board that was never played.
    const standings = createStandingsOnThePage();
    await loadStandingsWithData(standings, createOverallStandingsWithParts());

    // Act: ask it to stop.
    const answer = await standings.stopAction({});

    // Assert: a plain 200.
    expect(answer, 'stop while off air must simply answer 200').toEqual({ statusCode: 200 });
  });

  it('answers 409 to a second load, so a loaded board is never half reset', async () => {
    // Arrange: a board loaded with the overall standings.
    const standings = createStandingsOnThePage();
    await loadStandingsWithData(standings, createOverallStandingsWithParts());

    // Act: load it again with the total alone.
    const answer = await loadStandingsWithData(standings, createOverallStandingsTotalOnly());

    // Assert: a 409, and the table is still drawn.
    expect(answer, 'a second load must answer 409 with a pt-BR message').toEqual({
      statusCode: 409,
      statusMessage: 'A classificação já foi carregada (load); crie outra para novos dados.',
    });
    expect(
      findPartOfStandings(standings, 'standings')?.dataset.layout,
      'a refused second load must leave the first data drawn',
    ).toBe('table');
  });

  it('answers 404 to any customAction, because the standings have none', async () => {
    // Arrange: a board on air.
    const standings = createStandingsOnThePage();
    await loadStandingsWithData(standings, createOverallStandingsWithParts());
    await standings.playAction({ skipAnimation: true });

    // Act: ask for a custom action a control page might guess at.
    const answer = await standings.customAction({ id: 'proxima-pagina', payload: {} });

    // Assert: a 404 naming the unknown action in pt-BR.
    expect(answer, 'an unknown custom action must answer 404 with a pt-BR message').toEqual({
      statusCode: 404,
      statusMessage:
        'Ação personalizada desconhecida: "proxima-pagina". A classificação não tem ações personalizadas.',
    });
  });

  it('answers 409 to playAction and updateAction after dispose', async () => {
    // Arrange: a board loaded, played and disposed.
    const standings = createStandingsOnThePage();
    await loadStandingsWithData(standings, createOverallStandingsWithParts());
    await standings.playAction({ skipAnimation: true });
    await standings.dispose();

    // Act: try to play it and to change its title.
    const playAnswer = await standings.playAction({ skipAnimation: true });
    const updateAnswer = await standings.updateAction({ data: { title: 'CLASSIFICAÇÃO' } });

    // Assert: both answer "already disposed".
    expect(playAnswer, 'play after dispose must answer 409').toEqual(alreadyDisposedAnswer);
    expect(updateAnswer, 'update after dispose must answer 409').toEqual(alreadyDisposedAnswer);
  });

  it('answers 400 from load with a pt-BR message naming the bad field', async () => {
    // Arrange: a board, and data whose title is a number.
    const standings = createStandingsOnThePage();
    const dataWithBadTitle = { ...createOverallStandingsWithParts(), title: 30 };

    // Act: load it.
    const answer = await loadStandingsWithData(standings, dataWithBadTitle);

    // Assert: a 400 naming the field.
    expect(answer, 'bad load data must answer 400 naming the field').toEqual({
      statusCode: 400,
      statusMessage: 'Valor inválido no campo "title".',
    });
  });
});

describe('load', () => {
  it('draws page 1 off air: the title, the event, "1/3 · 1º A 20º" and 20 rows', async () => {
    // Arrange: a board on the page.
    const standings = createStandingsOnThePage();

    // Act: load the real overall standings.
    const answer = await loadStandingsWithData(standings, createOverallStandingsWithParts());

    // Assert: 200, the head's texts, the first 20 teams with Baja UFMG first.
    expect(answer, 'load must answer 200').toEqual({ statusCode: 200 });
    expect(findPartOfStandings(standings, 'standings-title')?.textContent, 'the title').toBe(
      'CLASSIFICAÇÃO GERAL',
    );
    expect(
      findPartOfStandings(standings, 'standings-event-line')?.textContent,
      'the event line',
    ).toBe('30ª COMPETIÇÃO BAJA SAE BRASIL');
    expect(readPageLine(standings), 'the page line of page 1').toBe('1/3 · 1º A 20º');
    const carNumbers = readCarNumbersOnTheBoard(standings);
    expect(carNumbers, 'page 1 holds 20 teams').toHaveLength(20);
    expect(carNumbers[0], 'Baja UFMG (car 2) is first').toBe(2);
  });
});

describe('playing and stopping', () => {
  it('takes the board off air when playAction comes while it is already on air', async () => {
    // Arrange: a board on air at its only step.
    const standings = createStandingsOnThePage();
    await loadStandingsWithData(standings, createOverallStandingsWithParts());
    await standings.playAction({ skipAnimation: true });

    // Act: play again; a step past the last means "go to the end".
    const answer = await standings.playAction({ skipAnimation: true });

    // Assert: 200 with no step, and the head card gone invisible.
    expect(answer, 'playing past the last step must take the board off').toEqual({
      statusCode: 200,
      currentStep: undefined,
    });
    expect(
      findPartOfStandings(standings, 'standings-head')?.style.opacity,
      'the head card must be off screen once taken off',
    ).toBe('0');
  });

  it('answers a play cut short by a stop with no current step', async () => {
    // Arrange: the theme's motion (so the play-in lasts) and a play-in just started.
    placeTokensOnTheRoot(ardosiaMotionTokenDeclarations);
    const standings = createStandingsOnThePage();
    await loadStandingsWithData(standings, createOverallStandingsWithParts());
    const pendingPlay = standings.playAction({});

    // Act: stop before the play-in has finished.
    const stopAnswer = await standings.stopAction({ skipAnimation: true });
    const playAnswer = await pendingPlay;

    // Assert: both 200, and play does not claim step 0 is on air.
    expect(stopAnswer, 'the stop must answer 200').toEqual({ statusCode: 200 });
    expect(playAnswer, 'a play cut short by stop must not report a step on air').toEqual({
      statusCode: 200,
      currentStep: undefined,
    });
  });

  it('comes back on page 1 when played again after a stop on page 2', async () => {
    // Arrange: the board on air, turned to page 2 by hand as the timer would.
    placeArdosiaBoardHoldOnTheRoot();
    const standings = createStandingsOnThePage();
    await loadStandingsWithData(standings, createOverallStandingsWithParts());
    await standings.playAction({ skipAnimation: true });
    await standings.turnToTheNextPageNow();
    const firstCarBeforeTheStop = readCarNumbersOnTheBoard(standings)[0];

    // Act: the operator takes the board off and on again.
    await standings.stopAction({ skipAnimation: true });
    await standings.playAction({ skipAnimation: true });

    // Assert: it was on page 2 (car 7 first), and the re-take shows page 1.
    expect(firstCarBeforeTheStop, 'the board was on page 2 when stopped').toBe(7);
    expect(readCarNumbersOnTheBoard(standings)[0], 'a re-take must start on page 1').toBe(2);
    expect(readPageLine(standings), 'the head must say page 1 again').toBe('1/3 · 1º A 20º');
  });
});

describe('the page timer', () => {
  it('turns to page 2 after one --motion-board-hold, the head card staying', async () => {
    // Arrange: the 10 s hold, timers under the test's control, the table on air.
    placeArdosiaBoardHoldOnTheRoot();
    takeControlOfTimers();
    const standings = createStandingsOnThePage();
    await loadStandingsWithData(standings, createOverallStandingsWithParts());
    await standings.playAction({ skipAnimation: true });
    const headBefore = findPartOfStandings(standings, 'standings-head');

    // Act: let one hold pass and the turn (0 ms of motion here) finish.
    await vi.advanceTimersByTimeAsync(10_000);

    // Assert: rows 21 to 40 on the same head card, with the page line of page 2.
    const carNumbers = readCarNumbersOnTheBoard(standings);
    expect(carNumbers[0], 'page 2 starts with the 21st team, car 7').toBe(7);
    expect(carNumbers, 'page 2 holds 20 rows').toHaveLength(20);
    expect(readPageLine(standings), 'the head says page 2').toBe('2/3 · 21º A 40º');
    expect(
      findPartOfStandings(standings, 'standings-head'),
      'the head card stays through the turn',
    ).toBe(headBefore);
  });

  it('goes through page 3 and back to page 1 after three holds', async () => {
    // Arrange: the same table on air.
    placeArdosiaBoardHoldOnTheRoot();
    takeControlOfTimers();
    const standings = createStandingsOnThePage();
    await loadStandingsWithData(standings, createOverallStandingsWithParts());
    await standings.playAction({ skipAnimation: true });

    // Act: let two holds pass, note page 3, then a third.
    await vi.advanceTimersByTimeAsync(20_000);
    const pageThreeLine = readPageLine(standings);
    const pageThreeRowCount = readCarNumbersOnTheBoard(standings).length;
    await vi.advanceTimersByTimeAsync(10_000);

    // Assert: page 3 held the last 14 teams, and the cycle came back to page 1.
    expect(pageThreeLine, 'the third page says its rows').toBe('3/3 · 41º A 54º');
    expect(pageThreeRowCount, 'page 3 holds the last 14 teams').toBe(14);
    expect(readPageLine(standings), 'the cycle comes back to page 1').toBe('1/3 · 1º A 20º');
  });

  it('turns no page after stop, however long the hold would be', async () => {
    // Arrange: the table on air with the timer armed, then taken off.
    placeArdosiaBoardHoldOnTheRoot();
    takeControlOfTimers();
    const standings = createStandingsOnThePage();
    await loadStandingsWithData(standings, createOverallStandingsWithParts());
    await standings.playAction({ skipAnimation: true });
    await standings.stopAction({ skipAnimation: true });

    // Act: let three holds pass.
    await vi.advanceTimersByTimeAsync(30_000);

    // Assert: still page 1, ready for the next take.
    expect(readPageLine(standings), 'off air the board must stay on page 1').toBe('1/3 · 1º A 20º');
  });

  it('turns no page after dispose', async () => {
    // Arrange: the table on air with the timer armed, then disposed.
    placeArdosiaBoardHoldOnTheRoot();
    takeControlOfTimers();
    const standings = createStandingsOnThePage();
    await loadStandingsWithData(standings, createOverallStandingsWithParts());
    await standings.playAction({ skipAnimation: true });
    const answer = await standings.dispose();

    // Act: let three holds pass.
    await vi.advanceTimersByTimeAsync(30_000);

    // Assert: dispose answered 200 and the page never changed.
    expect(answer, 'dispose must answer 200').toEqual({ statusCode: 200 });
    expect(readPageLine(standings), 'no page may turn after dispose').toBe('1/3 · 1º A 20º');
  });

  it('never turns the columns board of 54 teams, which fits on one page', async () => {
    // Arrange: the 54 teams with their totals alone, on air.
    placeArdosiaBoardHoldOnTheRoot();
    takeControlOfTimers();
    const standings = createStandingsOnThePage();
    await loadStandingsWithData(standings, createOverallStandingsTotalOnly());
    await standings.playAction({ skipAnimation: true });

    // Act: let three holds pass.
    await vi.advanceTimersByTimeAsync(30_000);

    // Assert: every team still on the board, the line counting them.
    expect(readCarNumbersOnTheBoard(standings), 'the whole field stays on air').toHaveLength(54);
    expect(readPageLine(standings), 'a single page names the teams').toBe('54 EQUIPES');
  });

  it('pages the columns board by 60 once it holds 61 teams', async () => {
    // Arrange: the 54 teams plus seven late entrants, totals alone, on air.
    placeArdosiaBoardHoldOnTheRoot();
    takeControlOfTimers();
    const standings = createStandingsOnThePage();
    await loadStandingsWithData(standings, {
      entries: createOverallEntriesWithSevenLateEntrants(),
    });
    await standings.playAction({ skipAnimation: true });
    const pageOneRowCount = readCarNumbersOnTheBoard(standings).length;

    // Act: let one hold pass.
    await vi.advanceTimersByTimeAsync(10_000);

    // Assert: 60 rows on page 1, then the 61st alone on page 2.
    expect(pageOneRowCount, 'page 1 holds three columns of 20').toBe(60);
    expect(readCarNumbersOnTheBoard(standings), 'page 2 holds the 61st team').toHaveLength(1);
    expect(readPageLine(standings), 'the head says page 2 of 2').toBe('2/2 · 61º A 61º');
  });
});

describe('dispose', () => {
  it('ends a running play-in and answers the pending play with 409', async () => {
    // Arrange: the theme's motion tokens (so the play-in lasts) and a play-in just started.
    placeTokensOnTheRoot(ardosiaMotionTokenDeclarations);
    const standings = createStandingsOnThePage();
    await loadStandingsWithData(standings, createOverallStandingsWithParts());
    const pendingPlay = standings.playAction({});
    const head = findPartOfStandings(standings, 'standings-head');

    // Act: dispose in the middle of the animation.
    await standings.dispose();
    const playAnswer = await pendingPlay;

    // Assert: the play settled with "already disposed", and no tween is left.
    expect(playAnswer, 'a play cut short by dispose must resolve with 409').toEqual(
      alreadyDisposedAnswer,
    );
    expect(gsap.getTweensOf(head ?? []), 'dispose must kill every tween on the head').toEqual([]);
  });

  it('stays disposed when dispose comes while load is still waiting', async () => {
    // Arrange: a load started but not finished (it waits for the first render).
    const standings = createStandingsOnThePage();
    const pendingLoad = loadStandingsWithData(standings, createOverallStandingsWithParts());

    // Act: dispose before load finishes, then let load finish and try to play.
    await standings.dispose();
    const loadAnswer = await pendingLoad;
    const playAnswer = await standings.playAction({ skipAnimation: true });

    // Assert: load reports the dispose, and the graphic never comes on air.
    expect(loadAnswer, 'a load overtaken by dispose must answer 409').toEqual(
      alreadyDisposedAnswer,
    );
    expect(playAnswer, 'a disposed graphic must never play again').toEqual(alreadyDisposedAnswer);
  });
});
