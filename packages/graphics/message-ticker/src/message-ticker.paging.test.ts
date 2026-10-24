/**
 * The message ticker's pages on air (packages/graphics/message-ticker)
 *
 * What this module is for:
 *   On air the ticker shows one message a page and turns to the next every
 *   `--motion-strip-hold` (7 s in Ardósia), cycling, with the kit's pageTurner; the message
 *   turns in place, the old lifting while the new rises, and never scrolls.
 *
 * What these tests prove (fake time decides when a hold ends):
 *   - With three messages: after one hold the second ("2/3"), after three the first again.
 *   - One message never turns; given a second on air with "Atualizar no ar", it starts.
 *   - An update that arrives during a turn is drawn once the turn has ended.
 *   - The timer is stopped on stop, on dispose and when the element leaves the page; a
 *     re-take starts on the first message.
 *
 * What these tests deliberately do not cover:
 *   - What the turn looks like; the kit's barMotion.test.ts gives its timing, and
 *     e2e/messageTickerLifecycle.e2e.ts watches it in Chromium.
 */
import { describe, expect, it, vi } from 'vitest';

import {
  createEnduroTickerData,
  createMessageTickerOnThePage,
  findPartOfMessageTicker,
  loadMessageTickerWithData,
  placeArdosiaStripHoldOnTheRoot,
  readMessageOnAir,
  readPageCell,
  takeControlOfTimers,
} from './messageTickerOnThePage.testSupport.js';

describe('the page timer', () => {
  it('shows the second message after one hold, and the first again after three', async () => {
    // Arrange: the 7 s hold, timers under the test's control, three messages on air.
    placeArdosiaStripHoldOnTheRoot();
    takeControlOfTimers();
    const ticker = createMessageTickerOnThePage();
    await loadMessageTickerWithData(ticker, createEnduroTickerData());
    await ticker.playAction({ skipAnimation: true });

    // Act: one hold, note the page; two more holds.
    await vi.advanceTimersByTimeAsync(7000);
    const afterOneHold = [readMessageOnAir(ticker), readPageCell(ticker)];
    await vi.advanceTimersByTimeAsync(2 * 7000);

    // Assert: the second message, then the cycle back to the first.
    expect(afterOneHold, 'the second message after one hold').toEqual([
      'Box aberto para abastecimento',
      '2/3',
    ]);
    expect(readPageCell(ticker), 'back to the first after three holds').toBe('1/3');
    expect(readMessageOnAir(ticker), 'the first message again').toBe('Largada do enduro às 10h00');
  });

  it('never turns one message, and starts once a second arrives on air', async () => {
    // Arrange: the 7 s hold, timers under the test's control, one message on air.
    placeArdosiaStripHoldOnTheRoot();
    takeControlOfTimers();
    const ticker = createMessageTickerOnThePage();
    await loadMessageTickerWithData(ticker, {
      ...createEnduroTickerData(),
      messages: ['Largada do enduro às 10h00'],
    });
    await ticker.playAction({ skipAnimation: true });

    // Act: three holds pass; then "Atualizar no ar" adds a second message; one hold.
    await vi.advanceTimersByTimeAsync(3 * 7000);
    const pageCellWithOneMessage = readPageCell(ticker);
    await ticker.updateAction({
      data: { messages: ['Largada do enduro às 10h00', 'Box aberto para abastecimento'] },
    });
    await vi.advanceTimersByTimeAsync(7000);

    // Assert: one page that never turned; with two the ticker turns.
    expect(pageCellWithOneMessage, 'one message never turns').toBe('1/1');
    expect(readPageCell(ticker), 'two messages turn').toBe('2/2');
  });
});

describe('a turn on air', () => {
  it('draws an update that arrives during a turn once the turn has ended', async () => {
    // Arrange: three messages on air, the turn lasting 300 ms (on the bar itself, since
    // jsdom carries no custom property from :root into a shadow root).
    const ticker = createMessageTickerOnThePage();
    await loadMessageTickerWithData(ticker, createEnduroTickerData());
    await ticker.playAction({ skipAnimation: true });
    findPartOfMessageTicker(ticker, 'message-ticker-bar')?.style.setProperty(
      '--motion-strip-page',
      '300ms',
    );

    // Act: start the turn to the second message; meanwhile it is corrected.
    const pendingTurn = ticker.turnToTheNextPageNow();
    await ticker.updateAction({
      data: {
        messages: [
          'Largada do enduro às 10h00',
          'Box aberto até 13h30',
          'Premiação às 16h no palco principal',
        ],
      },
    });
    await pendingTurn;

    // Assert: the corrected second message is on air once the turn ended.
    expect(readMessageOnAir(ticker), 'the correction is drawn after the turn').toBe(
      'Box aberto até 13h30',
    );
    expect(readPageCell(ticker), 'on page 2').toBe('2/3');
  });
});

describe('the page timer stopped', () => {
  it('turns no page after stop, and a re-take starts on the first message', async () => {
    // Arrange: three messages on air turned to the second, then taken off.
    placeArdosiaStripHoldOnTheRoot();
    takeControlOfTimers();
    const ticker = createMessageTickerOnThePage();
    await loadMessageTickerWithData(ticker, createEnduroTickerData());
    await ticker.playAction({ skipAnimation: true });
    await vi.advanceTimersByTimeAsync(7000);
    await ticker.stopAction({ skipAnimation: true });

    // Act: three holds off air, then take it again.
    await vi.advanceTimersByTimeAsync(3 * 7000);
    const pageCellOffAir = readPageCell(ticker);
    await ticker.playAction({ skipAnimation: true });

    // Assert: off air it rests on the first, and the re-take starts there.
    expect(pageCellOffAir, 'off air the ticker rests on the first message').toBe('1/3');
    expect(readMessageOnAir(ticker), 'the re-take starts on the first').toBe(
      'Largada do enduro às 10h00',
    );
  });

  it('turns no page after dispose, nor once removed from the page', async () => {
    // Arrange: two tickers on air with their timers armed.
    placeArdosiaStripHoldOnTheRoot();
    takeControlOfTimers();
    const disposedTicker = createMessageTickerOnThePage();
    const removedTicker = createMessageTickerOnThePage();
    for (const ticker of [disposedTicker, removedTicker]) {
      await loadMessageTickerWithData(ticker, createEnduroTickerData());
      await ticker.playAction({ skipAnimation: true });
    }

    // Act: dispose one, take the other out of the page; one hold passes.
    await disposedTicker.dispose();
    removedTicker.remove();
    await vi.advanceTimersByTimeAsync(7000);

    // Assert: both still on their first message.
    expect(readPageCell(disposedTicker), 'no turn after dispose').toBe('1/3');
    expect(readPageCell(removedTicker), 'no turn once removed').toBe('1/3');
  });
});
