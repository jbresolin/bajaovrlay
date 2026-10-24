/**
 * The paths a binding may point at in the standings (packages/shared)
 *
 * What this module is for:
 *   A standings graphic reads the whole list of teams and, since BAJAOVRLAY-24, the parts
 *   of the score (its columns), both as whole lists; a top-ten graphic reads rows one by
 *   one. Listed apart from bindablePaths.test.ts to keep that file under its limit.
 *
 * What these tests prove:
 *   - Standings offer the scope, the whole list, the score parts (typed
 *     standingsScoreParts, "Pontuação › Partes da pontuação") and the 1st to 10th rows,
 *     labelled "1ª linha", not "1º colocado": tied teams share a rank.
 *
 * What these tests deliberately do not cover:
 *   - That every path names a field of the shape; bindablePathsMatchShapes.test.ts.
 *   - Which graphic field a whole list fits; bindingFitsGraphicField.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { listBindablePathsOfShape } from './bindablePaths.js';

describe('listBindablePathsOfShape for the standings', () => {
  it('lists the standings scope, the whole list, the score parts and the first ten rows, named as rows', () => {
    // Arrange: nothing to set up; the list is fixed in code.

    // Act: ask for the standings paths.
    const standingsPaths = listBindablePathsOfShape('standings');

    // Assert: scope, the list and the score parts (a whole list too, the standings
    // graphic's columns, BAJAOVRLAY-24) first, then the first row's four fields,
    // 3 + 10 × 4 in all. A row, not a place: two teams tied on points share a rank, so
    // the 2nd row may be a 1st place (gate 2 on PR #16).
    expect(standingsPaths.slice(0, 7), 'the standings leader paths must be fixed').toEqual([
      {
        path: 'scope',
        label: 'Pontuação › Abrangência',
        valueType: 'text',
        isCarChosenByNumber: false,
      },
      {
        path: 'entries',
        label: 'Pontuação › Lista completa',
        valueType: 'standingsEntries',
        isCarChosenByNumber: false,
      },
      {
        path: 'scoreParts',
        label: 'Pontuação › Partes da pontuação',
        valueType: 'standingsScoreParts',
        isCarChosenByNumber: false,
      },
      {
        path: 'entries.0.carNumber',
        label: 'Pontuação › 1ª linha › Carro',
        valueType: 'integer',
        isCarChosenByNumber: false,
      },
      {
        path: 'entries.0.teamName',
        label: 'Pontuação › 1ª linha › Equipe',
        valueType: 'text',
        isCarChosenByNumber: false,
      },
      {
        path: 'entries.0.schoolName',
        label: 'Pontuação › 1ª linha › Escola',
        valueType: 'text',
        isCarChosenByNumber: false,
      },
      {
        path: 'entries.0.points',
        label: 'Pontuação › 1ª linha › Pontos',
        valueType: 'number',
        isCarChosenByNumber: false,
      },
    ]);
    expect(standingsPaths, 'standings must offer 3 + 10 × 4 paths').toHaveLength(43);
    expect(standingsPaths.at(-1), 'the last path must be the 10th row points').toEqual({
      path: 'entries.9.points',
      label: 'Pontuação › 10ª linha › Pontos',
      valueType: 'number',
      isCarChosenByNumber: false,
    });
  });
});
