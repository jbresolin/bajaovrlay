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
 *   - The flag band switched off and on again on air keeps the very same card and band
 *     elements (nothing is rebuilt), marks the card so the styles lower it, and hides
 *     or shows the band; an update that leaves the switch out changes nothing of it.
 *
 * What these tests deliberately do not cover:
 *   - The flag crossfade and the card growing or shrinking; jsdom draws nothing, so
 *     e2e/raceClockOnAir.e2e.ts checks both are gradual in Chromium.
 *   - Fonts: jsdom has no `document.fonts`, so load's wait for the theme's font ends at
 *     once.
 */
import { describe, expect, it } from 'vitest';

import {
  createGreenFlagEnduroData,
  createRaceClockOnThePage,
  findPartOfRaceClock,
  loadRaceClockWithData,
  readPanelOpacity,
  readShownText,
} from './raceClockOnThePage.testSupport.js';

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

describe('the flag band switched on air', () => {
  it('lowers the card and hides the band on the same elements when switched off', async () => {
    // Arrange: a race clock on air with its band, and its card and band elements noted.
    const raceClock = createRaceClockOnThePage();
    await loadRaceClockWithData(raceClock, createGreenFlagEnduroData());
    await raceClock.playAction({ skipAnimation: true });
    const panelBefore = findPartOfRaceClock(raceClock, 'race-clock-panel');
    const flagBandBefore = findPartOfRaceClock(raceClock, 'race-clock-flag-band');

    // Act: the operator switches the band off while the clock is on air.
    const answer = await raceClock.updateAction({
      data: { showFlagBand: false },
      skipAnimation: true,
    });
    const panelAfter = findPartOfRaceClock(raceClock, 'race-clock-panel');
    const flagBandAfter = findPartOfRaceClock(raceClock, 'race-clock-flag-band');

    // Assert: 200; the card and the band are the same elements, the card is marked as
    // without its band (the styles lower it by the band's height from that mark) and
    // the band is hidden from assistive technology.
    expect(answer, 'switching the band off must answer 200').toEqual({ statusCode: 200 });
    expect(panelAfter, 'the card must be the same element after the switch').toBe(panelBefore);
    expect(flagBandAfter, 'the band must be the same element after the switch').toBe(
      flagBandBefore,
    );
    expect(panelAfter?.dataset.flagBand, 'the card must be marked as without its band').toBe(
      'hidden',
    );
    expect(
      flagBandAfter?.getAttribute('aria-hidden'),
      'the band must be hidden once switched off',
    ).toBe('true');
  });

  it('brings the band back on the same elements when switched on again', async () => {
    // Arrange: a race clock on air whose band was switched off.
    const raceClock = createRaceClockOnThePage();
    await loadRaceClockWithData(raceClock, { ...createGreenFlagEnduroData(), showFlagBand: false });
    await raceClock.playAction({ skipAnimation: true });
    const panelBefore = findPartOfRaceClock(raceClock, 'race-clock-panel');

    // Act: switch the band back on.
    const answer = await raceClock.updateAction({
      data: { showFlagBand: true },
      skipAnimation: true,
    });
    const panelAfter = findPartOfRaceClock(raceClock, 'race-clock-panel');
    const flagBandAfter = findPartOfRaceClock(raceClock, 'race-clock-flag-band');

    // Assert: 200, the same card, marked as with its band, and the band shown, still
    // reading the green flag it was loaded with.
    expect(answer, 'switching the band on must answer 200').toEqual({ statusCode: 200 });
    expect(panelAfter, 'the card must be the same element after the switch').toBe(panelBefore);
    expect(panelAfter?.dataset.flagBand, 'the card must be marked as with its band').toBe('shown');
    expect(flagBandAfter?.getAttribute('aria-hidden'), 'the band must be shown again').toBeNull();
    expect(
      readShownText(raceClock, 'race-clock-flag-label'),
      'the band that comes back must show the flag the clock holds',
    ).toBe('VERDE');
  });

  it('leaves the band as it is when an update does not name the switch', async () => {
    // Arrange: a race clock on air without its band.
    const raceClock = createRaceClockOnThePage();
    await loadRaceClockWithData(raceClock, { ...createGreenFlagEnduroData(), showFlagBand: false });
    await raceClock.playAction({ skipAnimation: true });

    // Act: the leader completes lap 13; the update says nothing about the band.
    await raceClock.updateAction({ data: { lapsCompletedByLeader: 13 }, skipAnimation: true });

    // Assert: the card is still without its band.
    expect(
      findPartOfRaceClock(raceClock, 'race-clock-panel')?.dataset.flagBand,
      'an update that leaves the switch out must not bring the band back',
    ).toBe('hidden');
  });
});
