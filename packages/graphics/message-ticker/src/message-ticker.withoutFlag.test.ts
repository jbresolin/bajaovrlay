/**
 * The message ticker with no flag (packages/graphics/message-ticker, BAJAOVRLAY-81)
 *
 * What this module is for:
 *   The flag ("Bandeira") is optional on every graphic that shows it. On the ticker, an
 *   item with "Bandeira" cleared sends no `state`; its clock block then shows the time
 *   alone, without the flag pill, and the block closes up around the time.
 *
 * What these tests prove:
 *   - Loaded with no flag, the ticker answers 200, its block shows the time and its flag
 *     pill is hidden.
 *   - On air, an update that takes the flag away (the renderer sends `state: undefined`)
 *     hides the pill, and one that brings a flag back shows it with that flag's word.
 *
 * What these tests deliberately do not cover:
 *   - The closed-up look; jsdom draws nothing, so the screenshot of the ticker without a
 *     flag shows it.
 */
import { describe, expect, it } from 'vitest';

import {
  createEnduroTickerData,
  createMessageTickerOnThePage,
  findPartOfMessageTicker,
  loadMessageTickerWithData,
} from './messageTickerOnThePage.testSupport.js';

/** The enduro's announcements with the clock block on, as an item with no flag sends them. */
function createEnduroTickerDataWithoutFlag() {
  const { state: flagLeftOut, ...dataWithoutFlag } = createEnduroTickerData();
  return { flagLeftOut, dataWithoutFlag };
}

describe('the message ticker with no flag', () => {
  it('loads and shows the time with the flag pill hidden', async () => {
    // Arrange: a ticker on the page and the enduro's data with no flag.
    const ticker = createMessageTickerOnThePage();
    const { flagLeftOut, dataWithoutFlag } = createEnduroTickerDataWithoutFlag();

    // Act: load it.
    const answer = await loadMessageTickerWithData(ticker, dataWithoutFlag);

    // Assert: loaded, the time is there, the pill is hidden.
    expect(flagLeftOut, 'the data we started from had a flag').toBe('green');
    expect(answer, 'data without a flag must load').toEqual({ statusCode: 200 });
    expect(findPartOfMessageTicker(ticker, 'clock-block-time')?.textContent, 'the time').toBe(
      '1:00:00',
    );
    expect(
      findPartOfMessageTicker(ticker, 'clock-block-flag')?.hidden,
      'with no flag the pill must be hidden',
    ).toBe(true);
  });

  it('hides the pill when the flag is taken away on air, and shows it when one comes back', async () => {
    // Arrange: a ticker on air under green flag.
    const ticker = createMessageTickerOnThePage();
    await loadMessageTickerWithData(ticker, createEnduroTickerData());
    await ticker.playAction({ skipAnimation: true });

    // Act: the flag is cleared, then the red flag comes.
    const clearAnswer = await ticker.updateAction({ data: { state: undefined } });
    const isPillHiddenWithoutFlag = findPartOfMessageTicker(ticker, 'clock-block-flag')?.hidden;
    await ticker.updateAction({ data: { state: 'red' } });

    // Assert: hidden while there was no flag; back and red once the flag came.
    expect(clearAnswer, 'taking the flag away must be accepted').toEqual({ statusCode: 200 });
    expect(isPillHiddenWithoutFlag, 'with no flag the pill must be hidden').toBe(true);
    expect(
      findPartOfMessageTicker(ticker, 'clock-block-flag')?.hidden,
      'with a flag the pill must show',
    ).toBe(false);
    expect(
      findPartOfMessageTicker(ticker, 'clock-block-flag-word')?.textContent,
      'the pill must read the red flag',
    ).toBe('VERMELHA');
  });
});
