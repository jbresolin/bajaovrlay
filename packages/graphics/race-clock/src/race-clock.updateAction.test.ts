/**
 * The race clock web component: updateAction (packages/graphics/race-clock)
 *
 * What this module is for:
 *   The server corrects the race clock's data with OGraf's updateAction: a flag change,
 *   a new clock reading, a new lap count. João's ruling: an update is accepted at any
 *   time after load, on air or off (before the first play, or after a stop), and is
 *   refused only before load.
 *
 * What these tests prove:
 *   - updateAction before load answers 409 with a pt-BR message, without throwing.
 *   - An update while loaded but off air (before play, or after stop) answers 200 and
 *     its data is what the next play shows.
 *   - A partial update on air changes what it names and keeps the rest.
 *   - A bad update answers 400 naming the field and leaves the previous data shown.
 *
 * What these tests deliberately do not cover:
 *   - The flag wipe animation; jsdom draws nothing, so e2e/raceClockOnAir.e2e.ts checks
 *     the wipe is gradual in Chromium.
 *   - Loading the display font: jsdom has no FontFace, so displayFont.ts is replaced
 *     by a stand-in that is ready at once.
 */
import { describe, expect, it, vi } from 'vitest';

import {
  createGreenFlagEnduroData,
  createRaceClockOnThePage,
  loadRaceClockWithData,
  readPanelOpacity,
  readShownText,
} from './raceClockOnThePage.testSupport.js';

vi.mock('./displayFont.js', () => ({
  loadDisplayFontOnce: () => Promise.resolve(),
}));

describe('updateAction before load', () => {
  it('answers 409 with a pt-BR message, without throwing', async () => {
    // Arrange: a race clock on the page that was never loaded.
    const raceClock = createRaceClockOnThePage();

    // Act: try to throw the yellow flag on it.
    const answer = await raceClock.updateAction({ data: { state: 'yellow' } });

    // Assert: a 409 saying the clock is not loaded yet.
    expect(answer, 'update before load must answer 409 with a pt-BR message').toEqual({
      statusCode: 409,
      statusMessage: 'O relógio ainda não foi carregado (load).',
    });
  });
});

describe('updateAction while loaded but off air', () => {
  it('accepts an update before the first play, and play then shows the new data', async () => {
    // Arrange: a loaded race clock that has not been played yet.
    const raceClock = createRaceClockOnThePage();
    await loadRaceClockWithData(raceClock, createGreenFlagEnduroData());

    // Act: race control throws the yellow flag before the clock goes on air, then play.
    const updateAnswer = await raceClock.updateAction({ data: { state: 'yellow' } });
    await raceClock.playAction({ skipAnimation: true });

    // Assert: the update answered 200 and the clock comes on air already yellow.
    expect(updateAnswer, 'an update before play must answer 200').toEqual({ statusCode: 200 });
    expect(
      readShownText(raceClock, 'race-clock-flag-label'),
      'the clock must come on air showing the flag sent before play',
    ).toBe('AMARELA');
  });

  it('accepts an update after stop without bringing the clock back on air', async () => {
    // Arrange: a race clock that was on air and has been taken off.
    const raceClock = createRaceClockOnThePage();
    await loadRaceClockWithData(raceClock, createGreenFlagEnduroData());
    await raceClock.playAction({ skipAnimation: true });
    await raceClock.stopAction({ skipAnimation: true });

    // Act: the leader completes lap 13 while the clock is off air.
    const updateAnswer = await raceClock.updateAction({ data: { lapsCompletedByLeader: 13 } });

    // Assert: 200, the new lap count is drawn, and the panel stays invisible.
    expect(updateAnswer, 'an update after stop must answer 200').toEqual({ statusCode: 200 });
    expect(
      readShownText(raceClock, 'race-clock-laps'),
      'the new lap count must be ready for the next play',
    ).toBe('13 VOLTAS');
    expect(readPanelOpacity(raceClock), 'an update must not bring the clock back on air').toBe('0');
  });
});

describe('updateAction on air', () => {
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

  it('answers 400 to a bad update and keeps showing the previous data', async () => {
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
