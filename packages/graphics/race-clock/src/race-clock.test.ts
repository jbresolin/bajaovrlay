/**
 * The race clock web component: load, play, stop and dispose (packages/graphics/race-clock)
 *
 * What this module is for:
 *   race-clock.ts is the OGraf graphic itself: a web component the renderer loads,
 *   plays, updates, stops and disposes. It wires the model, the formatter, the ticker
 *   and the animations together; each of those has its own tests.
 *
 * What these tests prove:
 *   - Calls made at the wrong moment (play before load, a second load, anything after
 *     dispose, a custom action it does not have) answer a 4xx status with a pt-BR
 *     message instead of throwing, as OGraf asks. Stop before play is harmless.
 *   - Play while on air takes the clock off (OGraf's "past the last step" rule), and a
 *     play cut short by a stop reports no step, matching what is on screen.
 *   - Bad load data answers 400 with a pt-BR message naming the field.
 *   - dispose stops the per-frame clock redraw and kills the running timelines; a play
 *     that was animating when dispose came still resolves (with 409) instead of
 *     hanging, and a dispose that lands while load is still waiting is not undone.
 *   - load asks the page for the theme's face (the family in `--font-display`, read
 *     through the graphic itself, so the token reaches inside its shadow root) before
 *     it draws, through the theme's `waitForThemeFontsToBeReady`.
 *
 * What these tests deliberately do not cover:
 *   - updateAction, which race-clock.updateAction.test.ts covers.
 *   - Real rendering, fonts and timing; jsdom draws nothing and has no `document.fonts`
 *     (except in the one test that puts a stand-in there), so load's wait for the
 *     theme's font ends at once, and no theme token is on the page, so every timeline
 *     lasts 0 ms (the theme's rule for a missing token). The Playwright suites in e2e/
 *     run the built component in Chromium for the lifecycle order, the motion and the
 *     screenshots. How the wait itself behaves (a face that fails, a page without a
 *     token) is the theme's waitForThemeFonts.test.ts.
 */
import { gsap } from 'gsap';
import { describe, expect, it, onTestFinished } from 'vitest';

import {
  createGreenFlagEnduroData,
  createRaceClockOnThePage,
  loadRaceClockWithData,
  readPanelOpacity,
  readShownText,
  takeControlOfFramesAndTime,
} from './raceClockOnThePage.testSupport.js';

/**
 * Puts a stand-in `document.fonts` on jsdom's page that writes down every face asked
 * for and answers at once, and takes it off again when the test ends.
 */
function installStandInPageFontsThatRecordRequests(): { loadRequests: string[] } {
  const loadRequests: string[] = [];
  const standInFonts = {
    load: (fontSpec: string) => {
      loadRequests.push(fontSpec);
      return Promise.resolve([]);
    },
    ready: Promise.resolve(),
  };
  Object.defineProperty(document, 'fonts', { value: standInFonts, configurable: true });
  onTestFinished(() => {
    Object.defineProperty(document, 'fonts', { value: undefined, configurable: true });
  });
  return { loadRequests };
}

describe('load and the theme’s face', () => {
  it('asks the page for the face named by --font-display, read through the graphic, before it draws', async () => {
    // Arrange: the theme's face token on :root (as the renderer page has it), a page
    // that records font requests, and a race clock ready to load.
    document.documentElement.style.setProperty('--font-display', "'Bebas Neue', sans-serif");
    onTestFinished(() => {
      document.documentElement.style.removeProperty('--font-display');
    });
    const pageFonts = installStandInPageFontsThatRecordRequests();
    const raceClock = createRaceClockOnThePage();

    // Act: load it, as a renderer does.
    const answer = await loadRaceClockWithData(raceClock, createGreenFlagEnduroData());

    // Assert: the load went through, and the page was asked for the theme's face by
    // name, so a cold OBS start fetches it before the first frame.
    expect(answer, 'load must answer 200').toEqual({ statusCode: 200 });
    expect(
      pageFonts.loadRequests,
      'load must ask for the face named by --font-display, read through the shadow boundary',
    ).toEqual(["1em 'Bebas Neue', sans-serif"]);
  });
});

describe('calls made at the wrong moment', () => {
  it('answers 409 to playAction before load, without throwing', async () => {
    // Arrange: a race clock on the page that was never loaded.
    const raceClock = createRaceClockOnThePage();

    // Act: try to play it.
    const answer = await raceClock.playAction({});

    // Assert: a 409 with a pt-BR explanation.
    expect(answer, 'play before load must answer 409 with a pt-BR message').toEqual({
      statusCode: 409,
      statusMessage: 'O relógio ainda não foi carregado (load).',
    });
  });

  it('answers 200 to stopAction before playAction, since there is nothing to take off', async () => {
    // Arrange: a loaded race clock that was never played.
    const raceClock = createRaceClockOnThePage();
    await loadRaceClockWithData(raceClock, createGreenFlagEnduroData());

    // Act: ask it to stop.
    const answer = await raceClock.stopAction({});

    // Assert: a plain 200; stopping something already off air is not an error.
    expect(answer, 'stop while off air must simply answer 200').toEqual({ statusCode: 200 });
  });

  it('answers 409 to a second load, so a loaded clock is never half reset', async () => {
    // Arrange: a race clock already loaded with the green-flag enduro.
    const raceClock = createRaceClockOnThePage();
    await loadRaceClockWithData(raceClock, createGreenFlagEnduroData());

    // Act: load it again with red-flag data.
    const answer = await loadRaceClockWithData(raceClock, {
      ...createGreenFlagEnduroData(),
      state: 'red',
    });

    // Assert: a 409 with a pt-BR explanation, and the green flag is still the one drawn.
    expect(answer, 'a second load must answer 409 with a pt-BR message').toEqual({
      statusCode: 409,
      statusMessage: 'O relógio já foi carregado (load); crie outro para novos dados.',
    });
    expect(
      readShownText(raceClock, 'race-clock-flag-label'),
      'a refused second load must leave the first data drawn',
    ).toBe('VERDE');
  });

  it('answers 404 to any customAction, because the race clock has none', async () => {
    // Arrange: a race clock on air.
    const raceClock = createRaceClockOnThePage();
    await loadRaceClockWithData(raceClock, createGreenFlagEnduroData());
    await raceClock.playAction({ skipAnimation: true });

    // Act: ask for a custom action a control page might guess at.
    const answer = await raceClock.customAction({ id: 'reiniciar-relogio', payload: {} });

    // Assert: a 404 naming the unknown action in pt-BR.
    expect(answer, 'an unknown custom action must answer 404 with a pt-BR message').toEqual({
      statusCode: 404,
      statusMessage:
        'Ação personalizada desconhecida: "reiniciar-relogio". O relógio não tem ações personalizadas.',
    });
  });

  it('answers 409 to playAction and updateAction after dispose', async () => {
    // Arrange: a race clock that was loaded, played and then disposed.
    const raceClock = createRaceClockOnThePage();
    await loadRaceClockWithData(raceClock, createGreenFlagEnduroData());
    await raceClock.playAction({ skipAnimation: true });
    await raceClock.dispose();

    // Act: try to play it and to throw the yellow flag on it.
    const playAnswer = await raceClock.playAction({ skipAnimation: true });
    const updateAnswer = await raceClock.updateAction({ data: { state: 'yellow' } });

    // Assert: both answer "already disposed".
    const alreadyDisposedAnswer = {
      statusCode: 409,
      statusMessage: 'O relógio já foi descartado (dispose).',
    };
    expect(playAnswer, 'play after dispose must answer 409').toEqual(alreadyDisposedAnswer);
    expect(updateAnswer, 'update after dispose must answer 409').toEqual(alreadyDisposedAnswer);
  });
});

describe('playing and stopping', () => {
  it('takes the clock off air when playAction comes while it is already on air', async () => {
    // Arrange: a race clock on air at its only step, step 0.
    const raceClock = createRaceClockOnThePage();
    await loadRaceClockWithData(raceClock, createGreenFlagEnduroData());
    await raceClock.playAction({ skipAnimation: true });

    // Act: play again; OGraf says a step past the last one means "go to the end".
    const answer = await raceClock.playAction({ skipAnimation: true });

    // Assert: 200 with no current step, and the panel has gone invisible.
    expect(answer, 'playing past the last step must take the clock off').toEqual({
      statusCode: 200,
      currentStep: undefined,
    });
    expect(readPanelOpacity(raceClock), 'the clock must be off screen once taken off').toBe('0');
  });

  it('answers a play cut short by a stop with no current step, since nothing is on air', async () => {
    // Arrange: a loaded race clock that has just started its play-in animation.
    const raceClock = createRaceClockOnThePage();
    await loadRaceClockWithData(raceClock, createGreenFlagEnduroData());
    const pendingPlay = raceClock.playAction({});

    // Act: stop it before the play-in has finished.
    const stopAnswer = await raceClock.stopAction({ skipAnimation: true });
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
    // Arrange: a race clock and data with a flag state it cannot draw.
    const raceClock = createRaceClockOnThePage();
    const dataWithUnknownFlag = { ...createGreenFlagEnduroData(), state: 'blue' };

    // Act: load it with that data.
    const answer = await loadRaceClockWithData(raceClock, dataWithUnknownFlag);

    // Assert: a 400 naming the field.
    expect(answer, 'bad load data must answer 400 naming the field').toEqual({
      statusCode: 400,
      statusMessage: 'Valor inválido no campo "state".',
    });
  });
});

describe('dispose', () => {
  it('stops redrawing the clock once disposed, however much time passes', async () => {
    // Arrange: a race clock on air, with frames and time under the test's control.
    const framesAndTime = takeControlOfFramesAndTime();
    const raceClock = createRaceClockOnThePage();
    await loadRaceClockWithData(raceClock, createGreenFlagEnduroData());
    await raceClock.playAction({ skipAnimation: true });
    framesAndTime.runPendingFrames();
    const clockTextBeforeDispose = readShownText(raceClock, 'race-clock-time');

    // Act: dispose it, then let ten seconds and several frames pass.
    const answer = await raceClock.dispose();
    framesAndTime.letWallClockTimePass(10_000);
    framesAndTime.runPendingFrames();
    framesAndTime.runPendingFrames();
    const clockTextAfterDispose = readShownText(raceClock, 'race-clock-time');

    // Assert: dispose answered 200 and the clock text never moved again.
    expect(answer, 'dispose must answer 200').toEqual({ statusCode: 200 });
    expect(clockTextBeforeDispose, 'the clock showed 1:05:00 while on air').toBe('1:05:00');
    expect(clockTextAfterDispose, 'no frame may redraw the clock after dispose').toBe('1:05:00');
  });

  it('kills a running play-in and answers the pending play with 409, because the clock was disposed', async () => {
    // Arrange: a loaded race clock whose frames never advance on their own, so the
    // play-in animation is still running when dispose comes.
    takeControlOfFramesAndTime();
    const raceClock = createRaceClockOnThePage();
    await loadRaceClockWithData(raceClock, createGreenFlagEnduroData());
    const pendingPlay = raceClock.playAction({});
    const panel = raceClock.shadowRoot?.querySelector('[data-testid="race-clock-panel"]');

    // Act: dispose in the middle of the animation.
    await raceClock.dispose();
    const playAnswer = await pendingPlay;

    // Assert: the play promise settled with "already disposed", and no tween is left.
    expect(
      playAnswer,
      'a play cut short by dispose must resolve with 409 (already disposed), never hang',
    ).toEqual({ statusCode: 409, statusMessage: 'O relógio já foi descartado (dispose).' });
    expect(gsap.getTweensOf(panel ?? []), 'dispose must kill every tween on the panel').toEqual([]);
  });

  it('stays disposed when dispose comes while load is still waiting', async () => {
    // Arrange: a race clock whose load has started but not yet finished (it waits for
    // the first render and the font).
    const raceClock = createRaceClockOnThePage();
    const pendingLoad = loadRaceClockWithData(raceClock, createGreenFlagEnduroData());

    // Act: dispose before load finishes, then let load finish and try to play.
    await raceClock.dispose();
    const loadAnswer = await pendingLoad;
    const playAnswer = await raceClock.playAction({ skipAnimation: true });

    // Assert: load reports the dispose, and the graphic refuses to come back on air.
    const alreadyDisposedAnswer = {
      statusCode: 409,
      statusMessage: 'O relógio já foi descartado (dispose).',
    };
    expect(loadAnswer, 'a load overtaken by dispose must answer 409').toEqual(
      alreadyDisposedAnswer,
    );
    expect(playAnswer, 'a disposed graphic must never play again').toEqual(alreadyDisposedAnswer);
  });
});
