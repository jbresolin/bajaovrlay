/**
 * Filling a preset's placeholders (packages/shared)
 *
 * What this module is for:
 *   A preset (BAJAOVRLAY-54) is a flex config kept as JSON, with `{{name}}` where a value
 *   the operator chooses goes: the event, the prova, the API's address. This fills them in
 *   before the config is checked, in every text of the preset and nowhere else.
 *
 * What these tests prove:
 *   - A placeholder is replaced inside a longer text and as a whole text, in nested
 *     objects and lists; numbers, booleans and keys are left alone.
 *   - A placeholder with no value given is an error naming it, so a preset never ships a
 *     "{{eventId}}" to a request.
 *   - The preset given is not changed.
 *
 * What these tests deliberately do not cover:
 *   - The Baja app presets themselves: bajaApp/bajaAppPresets.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { fillPresetPlaceholders } from './presetPlaceholders.js';

/** A small preset like the race one: an address, query strings, a fixed number. */
function buildPresetOfARace() {
  return {
    requests: [
      {
        requestId: 'corrida',
        url: '{{apiAddress}}/resultados/corrida.php',
        queryParameters: [
          { name: 'evt', value: '{{eventId}}' },
          { name: 'p', value: '{{provaId}}' },
        ],
        refreshEveryMs: 600_000,
        isTheTeamsList: false,
      },
    ],
  };
}

describe('fillPresetPlaceholders', () => {
  it('fills every placeholder of every text, inside a text and as the whole of one', () => {
    // Arrange: the race preset and 26BR's Enduro on the real API.
    const preset = buildPresetOfARace();

    // Act: fill it in.
    const filled = fillPresetPlaceholders(preset, {
      apiAddress: 'https://api.bajasaebrasil.net',
      eventId: '26BR',
      provaId: 'END',
    });

    // Assert: the address, the event and the prova in place, the number and boolean kept.
    expect(filled, 'the request of 26BR’s Enduro').toEqual({
      requests: [
        {
          requestId: 'corrida',
          url: 'https://api.bajasaebrasil.net/resultados/corrida.php',
          queryParameters: [
            { name: 'evt', value: '26BR' },
            { name: 'p', value: 'END' },
          ],
          refreshEveryMs: 600_000,
          isTheTeamsList: false,
        },
      ],
    });
  });

  it('refuses a placeholder it has no value for, naming it', () => {
    // Arrange: the race preset, the prova forgotten.
    const preset = buildPresetOfARace();

    // Act: try to fill it in.
    const fillWithoutTheProva = () =>
      fillPresetPlaceholders(preset, {
        apiAddress: 'https://api.bajasaebrasil.net',
        eventId: '26BR',
      });

    // Assert: an error naming the missing one.
    expect(fillWithoutTheProva, 'the missing placeholder must be named').toThrow('{{provaId}}');
  });

  it('leaves the preset it was given as it was', () => {
    // Arrange: the race preset.
    const preset = buildPresetOfARace();

    // Act: fill it in.
    fillPresetPlaceholders(preset, {
      apiAddress: 'https://api.bajasaebrasil.net',
      eventId: '26BR',
      provaId: 'END',
    });

    // Assert: the preset still holds its placeholders.
    expect(preset, 'the preset must be untouched').toEqual(buildPresetOfARace());
  });
});
