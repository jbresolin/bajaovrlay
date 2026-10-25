/**
 * What the countdown shows in each layout (packages/graphics/countdown)
 *
 * What this module is for:
 *   countdownView.ts draws the countdown from its data: the card (the race clock's card
 *   without the band: the session in the head, "LARGADA EM" over the count, "ÀS 10:00"
 *   where the laps go) or the waiting board (the head "PRÓXIMA SESSÃO" with the event and
 *   the date, the session, the count, "LARGADA ÀS 10:00").
 *
 * What these tests prove (Brasília's clock, as vitest.config.ts pins it):
 *   - The card's words, and that it has no flag band at all.
 *   - The waiting board's head and body words.
 *   - A board without the event and date lines has no empty box in its head.
 *   - The animations move the card alone, or the board's head then its body card.
 *
 * What these tests deliberately do not cover:
 *   - The count itself, which the kit's countdownClock writes; countdown.test.ts.
 *   - The look; the screenshots in e2e/.
 */
import { describe, expect, it } from 'vitest';

import {
  createCountdownOnThePage,
  createEnduroCountdownData,
  findPartOfCountdown,
  loadCountdownWithData,
  readShownText,
  takeControlOfFramesAndTime,
} from './countdownOnThePage.testSupport.js';

describe('the card', () => {
  it('shows the session, LARGADA EM and ÀS 10:00, with no flag band', async () => {
    // Arrange: the clock at 09:36:15, a countdown on the page.
    takeControlOfFramesAndTime();
    const countdown = createCountdownOnThePage();

    // Act: load the enduro's card.
    await loadCountdownWithData(countdown, createEnduroCountdownData('card'));

    // Assert: the design's words in their places, and no band.
    expect(
      [
        readShownText(countdown, 'countdown-session'),
        readShownText(countdown, 'countdown-caption'),
        readShownText(countdown, 'countdown-start'),
      ],
      'the card’s words',
    ).toEqual(['Enduro de Resistência', 'LARGADA EM', 'ÀS 10:00']);
    expect(
      countdown.shadowRoot?.querySelector('.flag-band'),
      'the race clock’s card without the band',
    ).toBeNull();
  });
});

describe('the waiting board', () => {
  it('shows PRÓXIMA SESSÃO with the event and date, the session and LARGADA ÀS 10:00', async () => {
    // Arrange: the clock at 09:36:15, a countdown on the page.
    takeControlOfFramesAndTime();
    const countdown = createCountdownOnThePage();

    // Act: load the enduro's waiting board.
    await loadCountdownWithData(countdown, createEnduroCountdownData('fullscreen'));

    // Assert: the head and the body as the design writes them.
    expect(
      [
        readShownText(countdown, 'countdown-title'),
        readShownText(countdown, 'countdown-subtitle'),
        readShownText(countdown, 'countdown-aside'),
        readShownText(countdown, 'countdown-session'),
        readShownText(countdown, 'countdown-start'),
      ],
      'the board’s words',
    ).toEqual([
      'PRÓXIMA SESSÃO',
      '30ª Competição Baja SAE Brasil',
      'domingo, 30 de março de 2025',
      'Enduro de Resistência',
      'LARGADA ÀS 10:00',
    ]);
  });

  it('has no empty box in its head without the event and date lines', async () => {
    // Arrange: a countdown on the page, and the board with neither line.
    const countdown = createCountdownOnThePage();
    const withoutLines = {
      layout: 'fullscreen',
      sessionName: 'Enduro de Resistência',
      startsAtMs: createEnduroCountdownData().startsAtMs,
    };

    // Act: load it.
    await loadCountdownWithData(countdown, withoutLines);

    // Assert: the title alone in the head.
    expect(findPartOfCountdown(countdown, 'countdown-subtitle'), 'no event box').toBeUndefined();
    expect(findPartOfCountdown(countdown, 'countdown-aside'), 'no date box').toBeUndefined();
  });

  it('is brought in as the head, then the body card', async () => {
    // Arrange: a countdown on the page with the waiting board.
    const countdown = createCountdownOnThePage();
    await loadCountdownWithData(countdown, createEnduroCountdownData('fullscreen'));

    // Act: read the pieces load placed off air.
    const head = findPartOfCountdown(countdown, 'countdown-head');
    const body = findPartOfCountdown(countdown, 'countdown-body');

    // Assert: both invisible until play, the board's frame itself untouched.
    expect([head?.style.opacity, body?.style.opacity], 'the head and the body wait').toEqual([
      '0',
      '0',
    ]);
    expect(
      findPartOfCountdown(countdown, 'countdown-panel')?.style.opacity,
      'the frame is not a piece',
    ).toBe('');
  });
});
