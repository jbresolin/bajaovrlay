/**
 * The race clock web component with no flag (packages/graphics/race-clock, BAJAOVRLAY-81)
 *
 * What this module is for:
 *   The flag ("Bandeira") is optional: an item may leave it out, for a session with no
 *   flag to show, and the renderer then sends no `state`. With no flag the card draws no
 *   flag band and closes up (it is as low as with "Mostrar faixa da bandeira" off); a flag
 *   that arrives later brings the band back, dressed as that flag.
 *
 * What these tests prove:
 *   - Loaded with no flag, the card is marked without its band (the styles lower it) and
 *     the band is hidden from assistive technology, even with the band switch on.
 *   - On air, an update that takes the flag away (the renderer sends `state: undefined`)
 *     hides the band; one that brings a flag back shows the band with that flag's word.
 *   - An update that does not name the flag keeps it: leaving a field out of a partial
 *     update is not taking it away.
 *   - The band switch off still wins over a flag: switch off and a flag gives no band.
 *
 * What these tests deliberately do not cover:
 *   - The card's height; jsdom draws nothing, so the e2e tests and the screenshots of the
 *     card without a band (the same look) cover it.
 */
import { describe, expect, it } from 'vitest';

import {
  createGreenFlagEnduroData,
  createRaceClockOnThePage,
  findPartOfRaceClock,
  loadRaceClockWithData,
  readShownText,
} from './raceClockOnThePage.testSupport.js';

/** The enduro 1:05:00 in, as an item with "Bandeira" cleared sends it: no `state` at all. */
function createEnduroDataWithoutFlag() {
  const { state: flagLeftOut, ...dataWithoutFlag } = createGreenFlagEnduroData();
  return { flagLeftOut, dataWithoutFlag };
}

/** Reads whether the card is drawn with its band ("shown") or without it ("hidden"). */
function readFlagBandMark(raceClock: HTMLElement & { shadowRoot: ShadowRoot | null }) {
  return raceClock.shadowRoot?.querySelector<HTMLElement>('[data-testid="race-clock-panel"]')
    ?.dataset.flagBand;
}

describe('the race clock loaded with no flag', () => {
  it('draws the card without its band, even with the band switch on', async () => {
    // Arrange: a race clock on the page and the enduro's data with no flag, band switch on.
    const raceClock = createRaceClockOnThePage();
    const { flagLeftOut, dataWithoutFlag } = createEnduroDataWithoutFlag();

    // Act: load it and put it on air.
    const loadAnswer = await loadRaceClockWithData(raceClock, {
      ...dataWithoutFlag,
      showFlagBand: true,
    });
    await raceClock.playAction({ skipAnimation: true });

    // Assert: loaded fine, the card is marked without a band, and the band is hidden.
    expect(flagLeftOut, 'the data we started from had a flag').toBe('green');
    expect(loadAnswer, 'data without a flag must load').toEqual({ statusCode: 200 });
    expect(readFlagBandMark(raceClock), 'with no flag the card has no band').toBe('hidden');
    expect(
      findPartOfRaceClock(raceClock, 'race-clock-flag-band')?.getAttribute('aria-hidden'),
      'the band must be hidden from assistive technology',
    ).toBe('true');
    // (The clock is running against the real time here, so only its shape is checked.)
    expect(
      readShownText(raceClock, 'race-clock-time'),
      'the clock itself still shows a time',
    ).toMatch(/^\d+:\d\d:\d\d$/);
  });
});

describe('the flag taken away and brought back on air', () => {
  it('hides the band when an update takes the flag away', async () => {
    // Arrange: a race clock on air under green flag, its band shown.
    const raceClock = createRaceClockOnThePage();
    await loadRaceClockWithData(raceClock, createGreenFlagEnduroData());
    await raceClock.playAction({ skipAnimation: true });

    // Act: the operator clears "Bandeira"; the renderer sends the field as gone.
    const answer = await raceClock.updateAction({
      data: { state: undefined },
      skipAnimation: true,
    });

    // Assert: accepted, and the card is now without its band.
    expect(answer, 'taking the flag away must be accepted').toEqual({ statusCode: 200 });
    expect(readFlagBandMark(raceClock), 'with no flag the card has no band').toBe('hidden');
  });

  it('shows the band again, dressed as the new flag, when a flag comes back', async () => {
    // Arrange: a race clock on air with no flag.
    const raceClock = createRaceClockOnThePage();
    const { dataWithoutFlag } = createEnduroDataWithoutFlag();
    await loadRaceClockWithData(raceClock, dataWithoutFlag);
    await raceClock.playAction({ skipAnimation: true });

    // Act: the item is bound to the session's flag, which is yellow now.
    const answer = await raceClock.updateAction({
      data: { state: 'yellow' },
      skipAnimation: true,
    });

    // Assert: the band is back, reading the yellow flag's word.
    expect(answer, 'a flag arriving must be accepted').toEqual({ statusCode: 200 });
    expect(readFlagBandMark(raceClock), 'with a flag the band is back').toBe('shown');
    expect(
      readShownText(raceClock, 'race-clock-flag-label'),
      'the band must read the flag that arrived',
    ).toBe('AMARELA');
  });

  it('keeps the flag when an update does not name it', async () => {
    // Arrange: a race clock on air under green flag.
    const raceClock = createRaceClockOnThePage();
    await loadRaceClockWithData(raceClock, createGreenFlagEnduroData());
    await raceClock.playAction({ skipAnimation: true });

    // Act: only the leader's laps change; the flag is not in the update at all.
    await raceClock.updateAction({ data: { lapsCompletedByLeader: 13 }, skipAnimation: true });

    // Assert: the band is still there, still green.
    expect(readFlagBandMark(raceClock), 'a field left out is not taken away').toBe('shown');
    expect(readShownText(raceClock, 'race-clock-flag-label'), 'still the green flag').toBe('VERDE');
  });

  it('keeps the band off when a flag arrives with the band switch off', async () => {
    // Arrange: a race clock on air with no flag and the band switched off.
    const raceClock = createRaceClockOnThePage();
    const { dataWithoutFlag } = createEnduroDataWithoutFlag();
    await loadRaceClockWithData(raceClock, { ...dataWithoutFlag, showFlagBand: false });
    await raceClock.playAction({ skipAnimation: true });

    // Act: a flag arrives.
    await raceClock.updateAction({ data: { state: 'red' }, skipAnimation: true });

    // Assert: the switch still wins: no band.
    expect(readFlagBandMark(raceClock), 'the band switch off must still hide the band').toBe(
      'hidden',
    );
  });
});
