/**
 * The race clock web component (packages/graphics/race-clock)
 *
 * What this module is for:
 *   race-clock.ts is the OGraf graphic itself: a web component the renderer loads,
 *   plays, updates, stops and disposes. It wires the model, the formatter, the ticker
 *   and the animations together; each of those has its own tests.
 *
 * What these tests prove:
 *   - Calls made at the wrong moment (before load, update before play) answer a 4xx
 *     status with a pt-BR message instead of throwing, as OGraf asks.
 *   - Bad data answers 400 with a pt-BR message naming the field.
 *   - A partial update changes what is shown and keeps the rest.
 *   - dispose stops the per-frame clock redraw and kills the running timelines, and a
 *     play that was animating when dispose came still resolves instead of hanging.
 *
 * What these tests deliberately do not cover:
 *   - Real rendering, fonts and timing; jsdom draws nothing. The Playwright suites in
 *     e2e/ run the built component in Chromium for the lifecycle order and screenshots.
 *   - Loading the display font: jsdom has no FontFace, so displayFont.ts is replaced
 *     by a stand-in that is ready at once.
 */
import { gsap } from 'gsap';
import { describe, expect, it, vi } from 'vitest';

import RaceClockGraphic from './race-clock.js';
import type { RaceClockData } from './raceClockModel.js';

vi.mock('./displayFont.js', () => ({
  loadDisplayFontOnce: () => Promise.resolve(),
}));

// The renderer, not the graphic, picks the tag name; these tests pick their own.
customElements.define('baja-race-clock-under-test', RaceClockGraphic);

/** 16 May 2026, 14:30:00 UTC: when the clock reading in these tests was taken. */
const readingWallClockMs = Date.parse('2026-05-16T14:30:00.000Z');

/** Builds the data the server sends when the enduro is under green flag, 1:05:00 in. */
function createGreenFlagEnduroData(): RaceClockData {
  return {
    sessionName: 'Enduro de Resistência',
    state: 'green',
    clockMode: 'elapsed',
    referenceTimeMs: 3_900_000,
    referenceWallClockMs: readingWallClockMs,
    running: true,
    lapsCompletedByLeader: 12,
  };
}

/** Puts a fresh race clock element on the page, as a renderer does before calling load. */
function createRaceClockOnThePage(): RaceClockGraphic {
  const raceClock = document.createElement('baja-race-clock-under-test') as RaceClockGraphic;
  document.body.append(raceClock);
  return raceClock;
}

/** Loads the race clock the way an OBS renderer does: real-time, at 1920x1080. */
function loadRaceClockWithData(raceClock: RaceClockGraphic, data: unknown) {
  return raceClock.load({
    data,
    renderType: 'realtime',
    renderCharacteristics: { resolution: { width: 1920, height: 1080 } },
  });
}

/** Reads the text of one part of the graphic, found by its test id inside the shadow root. */
function readShownText(raceClock: RaceClockGraphic, testId: string): string | null | undefined {
  return raceClock.shadowRoot?.querySelector(`[data-testid="${testId}"]`)?.textContent;
}

/**
 * Replaces requestAnimationFrame with frames that run only when the test says so, and
 * fixes Date.now, so the test decides exactly when time passes and frames happen.
 */
function takeControlOfFramesAndTime() {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(readingWallClockMs);
  const pendingCallbacks = new Map<number, FrameRequestCallback>();
  let lastFrameId = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    lastFrameId += 1;
    pendingCallbacks.set(lastFrameId, callback);
    return lastFrameId;
  });
  vi.stubGlobal('cancelAnimationFrame', (frameId: number) => pendingCallbacks.delete(frameId));
  return {
    runPendingFrames(): void {
      const callbacksDueNow = [...pendingCallbacks.values()];
      pendingCallbacks.clear();
      for (const callback of callbacksDueNow) {
        callback(performance.now());
      }
    },
    letWallClockTimePass(milliseconds: number): void {
      vi.setSystemTime(Date.now() + milliseconds);
    },
    giveBackRealFramesAndTime(): void {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    },
  };
}

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

  it('answers 409 to updateAction before playAction, without throwing', async () => {
    // Arrange: a loaded race clock that is not on air yet.
    const raceClock = createRaceClockOnThePage();
    await loadRaceClockWithData(raceClock, createGreenFlagEnduroData());

    // Act: try to throw the yellow flag before the clock is on air.
    const answer = await raceClock.updateAction({ data: { state: 'yellow' } });

    // Assert: a 409 with a pt-BR explanation.
    expect(answer, 'update before play must answer 409 with a pt-BR message').toEqual({
      statusCode: 409,
      statusMessage: 'O relógio não está no ar: chame playAction antes de atualizar.',
    });
  });
});

describe('bad data', () => {
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

  it('answers 400 from updateAction and keeps showing the previous data', async () => {
    // Arrange: a race clock on air under green flag.
    const raceClock = createRaceClockOnThePage();
    await loadRaceClockWithData(raceClock, createGreenFlagEnduroData());
    await raceClock.playAction({ skipAnimation: true });

    // Act: send an update with a misspelled flag state.
    const answer = await raceClock.updateAction({ data: { state: 'amarela' } });

    // Assert: a 400 naming the field, and the green flag is still shown.
    expect(answer, 'a bad update must answer 400 naming the field').toEqual({
      statusCode: 400,
      statusMessage: 'Valor inválido no campo "state".',
    });
    expect(
      readShownText(raceClock, 'race-clock-flag-label'),
      'a refused update must leave the green flag on air',
    ).toBe('VERDE');
  });
});

describe('a partial update', () => {
  it('changes the flag on air and keeps the session name and laps', async () => {
    // Arrange: a race clock on air under green flag.
    const raceClock = createRaceClockOnThePage();
    await loadRaceClockWithData(raceClock, createGreenFlagEnduroData());
    await raceClock.playAction({ skipAnimation: true });

    // Act: race control throws the yellow flag; only the state is sent.
    const answer = await raceClock.updateAction({
      data: { state: 'yellow' },
      skipAnimation: true,
    });

    // Assert: 200, the yellow label is shown, the rest is unchanged.
    expect(answer, 'a good update must answer 200').toEqual({ statusCode: 200 });
    expect(readShownText(raceClock, 'race-clock-flag-label'), 'the yellow flag must show').toBe(
      'AMARELA',
    );
    expect(
      readShownText(raceClock, 'race-clock-session-name'),
      'the session name must survive a partial update',
    ).toBe('Enduro de Resistência');
    expect(
      readShownText(raceClock, 'race-clock-laps'),
      'the leader lap count must survive a partial update',
    ).toBe('12 VOLTAS');
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
    framesAndTime.giveBackRealFramesAndTime();

    // Assert: dispose answered 200 and the clock text never moved again.
    expect(answer, 'dispose must answer 200').toEqual({ statusCode: 200 });
    expect(clockTextBeforeDispose, 'the clock showed 1:05:00 while on air').toBe('1:05:00');
    expect(clockTextAfterDispose, 'no frame may redraw the clock after dispose').toBe('1:05:00');
  });

  it('kills a running play-in animation and lets the pending play resolve', async () => {
    // Arrange: a loaded race clock whose frames never advance on their own, so the
    // play-in animation is still running when dispose comes.
    const framesAndTime = takeControlOfFramesAndTime();
    const raceClock = createRaceClockOnThePage();
    await loadRaceClockWithData(raceClock, createGreenFlagEnduroData());
    const pendingPlay = raceClock.playAction({});
    const panel = raceClock.shadowRoot?.querySelector('[data-testid="race-clock-panel"]');

    // Act: dispose in the middle of the animation.
    await raceClock.dispose();
    const playAnswer = await pendingPlay;
    framesAndTime.giveBackRealFramesAndTime();

    // Assert: the play promise settled, and no tween is left on the panel.
    expect(playAnswer.statusCode, 'a play cut short by dispose must still resolve').toBe(409);
    expect(gsap.getTweensOf(panel ?? []), 'dispose must kill every tween on the panel').toEqual([]);
  });
});
