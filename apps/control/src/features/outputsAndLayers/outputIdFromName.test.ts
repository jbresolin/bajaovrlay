/**
 * The address suggested for a new output (apps/control)
 *
 * What this module is for:
 *   On "Saídas e camadas" the operator names a new output ("PiP") and the page suggests
 *   the address it gets in OBS (/render/?output=pip). The suggestion must be an id the
 *   server accepts: lower case, no accents, words joined by hyphens.
 *
 * What these tests prove:
 *   - Each row's name gives the row's address.
 *
 * What these tests deliberately do not cover:
 *   - The server's own check of an id; packages/shared's outputs tests.
 */
import { describe, expect, it } from 'vitest';

import { suggestOutputIdFromName } from './outputIdFromName';

const outputNameScenarios = [
  // João's first extra output.
  { name: 'lower-cases a short name', outputName: 'PiP', expected: 'pip' },
  // Accents and spaces, as a person types them.
  { name: 'drops accents and joins words', outputName: 'Câmera 2', expected: 'camera-2' },
  // Punctuation and extra spaces collapse into one hyphen, never at either end.
  {
    name: 'collapses punctuation and trims the ends',
    outputName: '  Box da largada — lado B! ',
    expected: 'box-da-largada-lado-b',
  },
  // A very long name is cut to the 30 characters the server accepts, with no hyphen left last.
  {
    name: 'cuts a long name to 30 characters',
    outputName: 'Transmissão secundária do box de reparos',
    expected: 'transmissao-secundaria-do-box',
  },
  // Nothing usable gives nothing, and the form keeps "Adicionar saída" off.
  { name: 'gives nothing for a name of symbols only', outputName: '★ ★', expected: '' },
];

describe('suggestOutputIdFromName', () => {
  it.each(outputNameScenarios)('$name', ({ outputName, expected }) => {
    // Arrange: the name of the row, as typed.

    // Act: suggest an address for it.
    const suggestion = suggestOutputIdFromName(outputName);

    // Assert: the row's address.
    expect(suggestion, `"${outputName}" must suggest "${expected}"`).toBe(expected);
  });
});
