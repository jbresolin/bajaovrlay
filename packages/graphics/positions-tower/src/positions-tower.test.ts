/**
 * The positions tower web component: load, play, stop and dispose
 * (packages/graphics/positions-tower)
 *
 * What this module is for:
 *   positions-tower.ts is the OGraf graphic itself: a web component the renderer loads,
 *   plays, updates, stops and disposes. It wires the model, the view, the pages, the
 *   page timer and the animations together; each of those has its own tests.
 *
 * What these tests prove:
 *   - Calls made at the wrong moment (play before load, a second load, anything after
 *     dispose, a custom action it does not have) answer a 4xx status with a pt-BR
 *     message instead of throwing, as OGraf asks. Stop before play is harmless.
 *   - load draws page 1 of the field: 20 rows (the theme's rows per page) keyed by car
 *     number, the leader marked, the head with the compact captions.
 *   - Play while on air takes the tower off (OGraf's "past the last step" rule), and a
 *     play cut short by a stop reports no step, matching what is on screen.
 *   - Bad load data answers 400 with a pt-BR message naming the field.
 *   - The page timer turns pages only while on air with pages cycling: after the hold the
 *     tower shows cars 21–40; after stop or dispose no page turns, however much time
 *     passes.
 *   - dispose kills the running timelines; a play that was animating when dispose came
 *     still resolves (with 409) instead of hanging, and a dispose that lands while load
 *     is still waiting is not undone.
 *
 * What these tests deliberately do not cover:
 *   - updateAction, which positions-tower.updateAction.test.ts covers.
 *   - Real rendering, fonts and timing; jsdom draws nothing and has no `document.fonts`,
 *     so load's wait for the theme's font ends at once, and unless a test places tokens
 *     on :root every timeline lasts 0 ms (the theme's rule for a missing token). The
 *     Playwright suites in e2e/ run the built component in Chromium for the motion, the
 *     paging in real time and the screenshots.
 */
import { gsap } from 'gsap';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import {
  ardosiaMotionTokenDeclarations,
  createCompactTowerDataOnTheSample,
  createTowerOnThePage,
  findPartOfTower,
  listRowElements,
  loadTowerWithData,
  placeTokensOnTheRoot,
  readCarNumbersOnThePage,
} from './positionsTowerOnThePage.testSupport.js';

/** Car numbers of the sample's page 1, positions 1 to 20. */
const pageOneCarNumbers = [
  31, 38, 25, 78, 52, 47, 30, 81, 49, 95, 67, 93, 89, 45, 98, 32, 69, 64, 42, 71,
];

/** Fakes setTimeout so the test decides when the page hold ends; real timers come back after. */
function takeControlOfTimers() {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  onTestFinished(() => {
    vi.useRealTimers();
  });
}

describe('calls made at the wrong moment', () => {
  it('answers 409 to playAction before load, without throwing', async () => {
    // Arrange: a tower on the page that was never loaded.
    const tower = createTowerOnThePage();

    // Act: try to play it.
    const answer = await tower.playAction({});

    // Assert: a 409 with a pt-BR explanation.
    expect(answer, 'play before load must answer 409 with a pt-BR message').toEqual({
      statusCode: 409,
      statusMessage: 'A torre ainda não foi carregada (load).',
    });
  });

  it('answers 200 to stopAction before playAction, since there is nothing to take off', async () => {
    // Arrange: a loaded tower that was never played.
    const tower = createTowerOnThePage();
    await loadTowerWithData(tower, createCompactTowerDataOnTheSample());

    // Act: ask it to stop.
    const answer = await tower.stopAction({});

    // Assert: a plain 200; stopping something already off air is not an error.
    expect(answer, 'stop while off air must simply answer 200').toEqual({ statusCode: 200 });
  });

  it('answers 409 to a second load, so a loaded tower is never half reset', async () => {
    // Arrange: a tower already loaded with the sample.
    const tower = createTowerOnThePage();
    await loadTowerWithData(tower, createCompactTowerDataOnTheSample());

    // Act: load it again with a detailed layout.
    const answer = await loadTowerWithData(tower, {
      ...createCompactTowerDataOnTheSample(),
      layout: 'detailed',
    });

    // Assert: a 409 with a pt-BR explanation, and the compact layout is still drawn.
    expect(answer, 'a second load must answer 409 with a pt-BR message').toEqual({
      statusCode: 409,
      statusMessage: 'A torre já foi carregada (load); crie outra para novos dados.',
    });
    expect(
      findPartOfTower(tower, 'positions-tower')?.dataset.layout,
      'a refused second load must leave the first data drawn',
    ).toBe('compact');
  });

  it('answers 404 to any customAction, because the tower has none', async () => {
    // Arrange: a tower on air.
    const tower = createTowerOnThePage();
    await loadTowerWithData(tower, createCompactTowerDataOnTheSample());
    await tower.playAction({ skipAnimation: true });

    // Act: ask for a custom action a control page might guess at.
    const answer = await tower.customAction({ id: 'proxima-pagina', payload: {} });

    // Assert: a 404 naming the unknown action in pt-BR.
    expect(answer, 'an unknown custom action must answer 404 with a pt-BR message').toEqual({
      statusCode: 404,
      statusMessage:
        'Ação personalizada desconhecida: "proxima-pagina". A torre não tem ações personalizadas.',
    });
  });

  it('answers 409 to playAction and updateAction after dispose', async () => {
    // Arrange: a tower that was loaded, played and then disposed.
    const tower = createTowerOnThePage();
    await loadTowerWithData(tower, createCompactTowerDataOnTheSample());
    await tower.playAction({ skipAnimation: true });
    await tower.dispose();

    // Act: try to play it and to switch its layout.
    const playAnswer = await tower.playAction({ skipAnimation: true });
    const updateAnswer = await tower.updateAction({ data: { layout: 'detailed' } });

    // Assert: both answer "already disposed".
    const alreadyDisposedAnswer = {
      statusCode: 409,
      statusMessage: 'A torre já foi descartada (dispose).',
    };
    expect(playAnswer, 'play after dispose must answer 409').toEqual(alreadyDisposedAnswer);
    expect(updateAnswer, 'update after dispose must answer 409').toEqual(alreadyDisposedAnswer);
  });
});

describe('load', () => {
  it('draws page 1 of the field: 20 rows keyed by car number, the leader marked, the compact captions', async () => {
    // Arrange: the theme's rows per page on :root, and a tower on the page.
    placeTokensOnTheRoot({ '--tower-rows-per-page': '20' });
    const tower = createTowerOnThePage();

    // Act: load the 60-car sample.
    const answer = await loadTowerWithData(tower, createCompactTowerDataOnTheSample());

    // Assert: 200; the first 20 cars in order, the first row marked as the leader, and
    // the head naming the compact columns.
    expect(answer, 'load must answer 200').toEqual({ statusCode: 200 });
    expect(readCarNumbersOnThePage(tower), 'page 1 must hold positions 1 to 20').toEqual(
      pageOneCarNumbers,
    );
    expect(
      listRowElements(tower)[0]?.hasAttribute('data-leader'),
      'the row in slot 1 must carry the leader mark',
    ).toBe(true);
    const captions = [...(findPartOfTower(tower, 'positions-tower-head')?.children ?? [])];
    expect(
      captions.map((caption) => caption.textContent).filter((text) => text !== ''),
      'the compact head must name POS, Nº, EQUIPE and VOLTAS',
    ).toEqual(['POS', 'Nº', 'EQUIPE', 'VOLTAS']);
  });
});

describe('playing and stopping', () => {
  it('takes the tower off air when playAction comes while it is already on air', async () => {
    // Arrange: a tower on air at its only step, step 0.
    const tower = createTowerOnThePage();
    await loadTowerWithData(tower, createCompactTowerDataOnTheSample());
    await tower.playAction({ skipAnimation: true });

    // Act: play again; OGraf says a step past the last one means "go to the end".
    const answer = await tower.playAction({ skipAnimation: true });

    // Assert: 200 with no current step, and the head has gone invisible.
    expect(answer, 'playing past the last step must take the tower off').toEqual({
      statusCode: 200,
      currentStep: undefined,
    });
    expect(
      findPartOfTower(tower, 'positions-tower-head')?.style.opacity,
      'the head must be off screen once taken off',
    ).toBe('0');
  });

  it('answers a play cut short by a stop with no current step, since nothing is on air', async () => {
    // Arrange: a loaded tower that has just started its play-in animation.
    const tower = createTowerOnThePage();
    await loadTowerWithData(tower, createCompactTowerDataOnTheSample());
    const pendingPlay = tower.playAction({});

    // Act: stop it before the play-in has finished.
    const stopAnswer = await tower.stopAction({ skipAnimation: true });
    const playAnswer = await pendingPlay;

    // Assert: both resolve with 200, and play does not claim step 0 is on air.
    expect(stopAnswer, 'the stop must answer 200').toEqual({ statusCode: 200 });
    expect(playAnswer, 'a play cut short by stop must not report a step on air').toEqual({
      statusCode: 200,
      currentStep: undefined,
    });
  });
});

describe('bad load data', () => {
  it('answers 400 from load with a pt-BR message naming the bad field', async () => {
    // Arrange: a tower and data whose paging mode is misspelled.
    const tower = createTowerOnThePage();
    const dataWithBadPaging = { ...createCompactTowerDataOnTheSample(), paging: 'loop' };

    // Act: load it with that data.
    const answer = await loadTowerWithData(tower, dataWithBadPaging);

    // Assert: a 400 naming the field.
    expect(answer, 'bad load data must answer 400 naming the field').toEqual({
      statusCode: 400,
      statusMessage: 'Valor inválido no campo "paging".',
    });
  });
});

describe('the page timer', () => {
  it('turns to page 2 after the hold while on air with pages cycling', async () => {
    // Arrange: the hold and rows per page from the theme, timers under the test's
    // control, and a tower on air with the 60-car sample.
    placeTokensOnTheRoot({ '--motion-strip-hold': '7000ms', '--tower-rows-per-page': '20' });
    takeControlOfTimers();
    const tower = createTowerOnThePage();
    await loadTowerWithData(tower, createCompactTowerDataOnTheSample());
    await tower.playAction({ skipAnimation: true });

    // Act: let the hold pass and the turn (0 ms of motion here) finish.
    await vi.advanceTimersByTimeAsync(7000);

    // Assert: the rows are now cars 21 to 40.
    const carNumbers = readCarNumbersOnThePage(tower);
    expect(carNumbers[0], 'after the hold the first row must be the 21st car').toBe(6);
    expect(carNumbers, 'page 2 must hold 20 rows').toHaveLength(20);
    expect(carNumbers, 'page 2 must not hold the leader').not.toContain(31);
  });

  it('turns no page after stop, however long the hold would be', async () => {
    // Arrange: a tower on air with the timer armed, then taken off air.
    placeTokensOnTheRoot({ '--motion-strip-hold': '7000ms', '--tower-rows-per-page': '20' });
    takeControlOfTimers();
    const tower = createTowerOnThePage();
    await loadTowerWithData(tower, createCompactTowerDataOnTheSample());
    await tower.playAction({ skipAnimation: true });
    await tower.stopAction({ skipAnimation: true });

    // Act: let two holds pass.
    await vi.advanceTimersByTimeAsync(14_000);

    // Assert: still page 1, ready for the next play.
    expect(readCarNumbersOnThePage(tower)[0], 'off air the tower must hold its page').toBe(31);
  });

  it('turns no page after dispose', async () => {
    // Arrange: a tower on air with the timer armed, then disposed.
    placeTokensOnTheRoot({ '--motion-strip-hold': '7000ms', '--tower-rows-per-page': '20' });
    takeControlOfTimers();
    const tower = createTowerOnThePage();
    await loadTowerWithData(tower, createCompactTowerDataOnTheSample());
    await tower.playAction({ skipAnimation: true });
    const answer = await tower.dispose();

    // Act: let two holds pass.
    await vi.advanceTimersByTimeAsync(14_000);

    // Assert: dispose answered 200 and the rows never changed.
    expect(answer, 'dispose must answer 200').toEqual({ statusCode: 200 });
    expect(readCarNumbersOnThePage(tower)[0], 'no page may turn after dispose').toBe(31);
  });

  it('does not run with pages held on the first page', async () => {
    // Arrange: the same tower with paging firstPageOnly.
    placeTokensOnTheRoot({ '--motion-strip-hold': '7000ms', '--tower-rows-per-page': '20' });
    takeControlOfTimers();
    const tower = createTowerOnThePage();
    await loadTowerWithData(tower, {
      ...createCompactTowerDataOnTheSample(),
      paging: 'firstPageOnly',
    });
    await tower.playAction({ skipAnimation: true });

    // Act: let two holds pass.
    await vi.advanceTimersByTimeAsync(14_000);

    // Assert: page 1 is still on air.
    expect(readCarNumbersOnThePage(tower)[0], 'firstPageOnly must hold page 1').toBe(31);
  });
});

describe('dispose', () => {
  it('kills a running play-in and answers the pending play with 409, because the tower was disposed', async () => {
    // Arrange: the theme's motion tokens on :root (so the play-in really lasts) and a
    // loaded tower whose play-in has just started.
    placeTokensOnTheRoot(ardosiaMotionTokenDeclarations);
    const tower = createTowerOnThePage();
    await loadTowerWithData(tower, createCompactTowerDataOnTheSample());
    const pendingPlay = tower.playAction({});
    const head = findPartOfTower(tower, 'positions-tower-head');

    // Act: dispose in the middle of the animation.
    await tower.dispose();
    const playAnswer = await pendingPlay;

    // Assert: the play promise settled with "already disposed", and no tween is left.
    expect(
      playAnswer,
      'a play cut short by dispose must resolve with 409 (already disposed), never hang',
    ).toEqual({ statusCode: 409, statusMessage: 'A torre já foi descartada (dispose).' });
    expect(gsap.getTweensOf(head ?? []), 'dispose must kill every tween on the head').toEqual([]);
  });

  it('stays disposed when dispose comes while load is still waiting', async () => {
    // Arrange: a tower whose load has started but not yet finished (it waits for the
    // first render and the font).
    const tower = createTowerOnThePage();
    const pendingLoad = loadTowerWithData(tower, createCompactTowerDataOnTheSample());

    // Act: dispose before load finishes, then let load finish and try to play.
    await tower.dispose();
    const loadAnswer = await pendingLoad;
    const playAnswer = await tower.playAction({ skipAnimation: true });

    // Assert: load reports the dispose, and the graphic refuses to come back on air.
    const alreadyDisposedAnswer = {
      statusCode: 409,
      statusMessage: 'A torre já foi descartada (dispose).',
    };
    expect(loadAnswer, 'a load overtaken by dispose must answer 409').toEqual(
      alreadyDisposedAnswer,
    );
    expect(playAnswer, 'a disposed graphic must never play again').toEqual(alreadyDisposedAnswer);
  });
});
