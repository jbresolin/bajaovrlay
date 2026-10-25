/**
 * A flag on air (packages/graphics/kit)
 *
 * What this module is for:
 *   The race clock's flag band and the flag pill in the clock block of the lower strip and
 *   the message ticker draw a flag the same way: its colours through `data-flag-state`, its
 *   word, and the word as its accessible name. The checkered flag is the exception the
 *   design asks for: the pattern alone, the word only for assistive technology.
 *
 * What these tests prove:
 *   - Every flag but the checkered one shows its pt-BR word; the checkered one shows none
 *     and is still named QUADRICULADA.
 *   - Dressing an element writes the state, the name and the word, and dressing it again
 *     with another flag replaces all three.
 *
 * What these tests deliberately do not cover:
 *   - The colours themselves: each graphic's styles map `data-flag-state` to the theme's
 *     flag tokens, and the screenshot tests show them.
 */
import { describe, expect, it } from 'vitest';

import { describeFlagOnAir, dressElementAsFlag } from './flagOnAir.js';
import { flagStates } from './raceClockReading.js';

describe('describeFlagOnAir', () => {
  it('shows the pt-BR word of every flag but the checkered one, which shows the pattern alone', () => {
    // Arrange: the six flag states.

    // Act: describe each as drawn on air.
    const wordsShown = Object.fromEntries(
      flagStates.map((flagState) => [flagState, describeFlagOnAir(flagState).wordShown]),
    );

    // Assert: the words of the race clock's band, and no word on the checkered flag.
    expect(wordsShown, 'every flag shows its word, the checkered flag none').toEqual({
      pre: 'PRÉ-LARGADA',
      green: 'VERDE',
      yellow: 'AMARELA',
      red: 'VERMELHA',
      checkered: '',
      finished: 'ENCERRADA',
    });
  });

  it('names the checkered flag for assistive technology though it shows no word', () => {
    // Arrange: the checkered flag at the end of the enduro.

    // Act: describe it.
    const flagOnAir = describeFlagOnAir('checkered');

    // Assert: its accessible name is the word it does not show.
    expect(flagOnAir.accessibleName, 'the checkered flag must still be named').toBe('QUADRICULADA');
  });
});

describe('dressElementAsFlag', () => {
  it('writes the flag state, the accessible name and the word', () => {
    // Arrange: an empty pill and its word span, as a clock block draws them.
    const pill = document.createElement('span');
    const word = document.createElement('span');
    pill.append(word);

    // Act: dress the pill as the yellow flag.
    dressElementAsFlag(pill, word, 'yellow');

    // Assert: all three are written.
    expect(pill.dataset.flagState, 'the styles colour the pill from its flag state').toBe('yellow');
    expect(pill.getAttribute('aria-label'), 'the pill is named after its flag').toBe('AMARELA');
    expect(word.textContent, 'the word is written on the pill').toBe('AMARELA');
  });

  it('replaces all three when the flag changes to checkered', () => {
    // Arrange: a pill already dressed as green, as during the race.
    const pill = document.createElement('span');
    const word = document.createElement('span');
    pill.append(word);
    dressElementAsFlag(pill, word, 'green');

    // Act: the race ends.
    dressElementAsFlag(pill, word, 'checkered');

    // Assert: the checkered pattern, its name, and no word left over from green.
    expect(pill.dataset.flagState, 'the pill takes the checkered state').toBe('checkered');
    expect(pill.getAttribute('aria-label'), 'the pill is named QUADRICULADA').toBe('QUADRICULADA');
    expect(word.textContent, 'the green word must not stay on the checkered pill').toBe('');
  });
});
