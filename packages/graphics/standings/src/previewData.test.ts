/**
 * The preview's sample data (packages/graphics/standings)
 *
 * What this module is for:
 *   previewData.ts holds the real overall standings of the 30th competition (the export
 *   docs/design/sample_data/results/overall.csv) and the enduro's own table, which the
 *   preview page, the unit tests and the browser tests all draw; it also reads `?data=`
 *   and `?stage=` and disqualifies a team the way a source would send it.
 *
 * What these tests prove:
 *   - The overall sample is the export: 54 teams, Baja UFMG first with 921.8, the four
 *     "Desclassificada" last and without a rank, a blank 4X4 left out (Forja Baja).
 *   - The enduro sample has 33 teams with the export's ties (three teams second).
 *   - Disqualifying the 3rd team moves it last, without a rank, and changes nothing given.
 *   - `?stage=grey|black` is read; anything else keeps the gradient; bad `?data=` JSON
 *     gives a pt-BR problem instead of a throw.
 *
 * What these tests deliberately do not cover:
 *   - That the samples pass the model; standingsModel.test.ts loads them.
 */
import { describe, expect, it } from 'vitest';

import {
  choosePreviewData,
  choosePreviewStage,
  createEnduroStandings,
  createOverallStandingsEntries,
  disqualifyTeamInRow,
} from './previewData.js';

describe('the overall sample', () => {
  it('is the real export: 54 teams, Baja UFMG first, the four disqualified last with no rank', () => {
    // Arrange: nothing to set up; the sample is built from the export's lines.

    // Act: build the entries.
    const entries = createOverallStandingsEntries();

    // Assert: the export's count, leader and disqualified teams.
    expect(entries, 'the export lists 54 teams').toHaveLength(54);
    expect(entries[0], 'Baja UFMG won with 921.8').toMatchObject({
      rank: 1,
      carNumber: 2,
      teamName: 'Baja UFMG',
      points: 921.8,
    });
    const lastFour = entries.slice(-4);
    expect(
      lastFour.map((entry) => ({ carNumber: entry.carNumber, rank: entry.rank })),
      'the disqualified teams are last and have no rank',
    ).toEqual([
      { carNumber: 30, rank: undefined },
      { carNumber: 42, rank: undefined },
      { carNumber: 48, rank: undefined },
      { carNumber: 57, rank: undefined },
    ]);
    expect(
      lastFour.every((entry) => entry.isDisqualified === true),
      'the last four are marked disqualified',
    ).toBe(true);
  });

  it('leaves out a part the export leaves blank: Forja Baja has no 4X4', () => {
    // Arrange: the export's line for car 16 has an empty "Bônus 4x4" cell.
    const entries = createOverallStandingsEntries();

    // Act: find Forja Baja.
    const forjaBaja = entries.find((entry) => entry.carNumber === 16);

    // Assert: its parts have no bonus4x4 key, and a negative SEG.
    expect(forjaBaja?.pointsByPart, 'a blank part must be left out, not 0').toEqual({
      projeto: 152.01,
      dinamicas: 64.83,
      enduro: 325,
      seguranca: -15,
      penalidade: 0,
    });
  });
});

describe('the enduro sample', () => {
  it('has the 33 teams that scored, with three teams tied second', () => {
    // Arrange: nothing to set up.

    // Act: build the enduro's table.
    const data = createEnduroStandings();

    // Assert: 33 teams, Sinuelo first, then three at rank 2.
    expect(data.entries, 'the enduro has 33 scoring teams').toHaveLength(33);
    expect(
      data.entries.slice(0, 4).map((entry) => entry.rank),
      'Sinuelo first, then three teams tied second',
    ).toEqual([1, 2, 2, 2]);
    expect(data.scoreParts, 'a per-event table has no parts').toEqual([]);
  });
});

describe('disqualifyTeamInRow', () => {
  it('moves the 3rd team last without a rank and leaves the list given unchanged', () => {
    // Arrange: the overall entries; the 3rd is Equipe Komiketo Baja (car 10).
    const entries = createOverallStandingsEntries();

    // Act: disqualify the team in row 3.
    const changedEntries = disqualifyTeamInRow(entries, 3);

    // Assert: car 10 is last, disqualified, rankless; the original list is as it was.
    const lastEntry = changedEntries.at(-1);
    expect(lastEntry?.carNumber, 'the disqualified team must go last').toBe(10);
    expect(lastEntry?.isDisqualified, 'it must be marked disqualified').toBe(true);
    expect(lastEntry?.rank, 'it must lose its rank').toBeUndefined();
    expect(changedEntries[2]?.carNumber, 'the 4th team moves up to row 3').toBe(47);
    expect(entries[2]?.carNumber, 'the list given must not change').toBe(10);
  });
});

describe('reading the address', () => {
  it('reads the grey and black stages, and keeps the gradient for anything else', () => {
    // Arrange: three address queries.

    // Act: read the stage of each.
    const greyStage = choosePreviewStage('?stage=grey');
    const blackStage = choosePreviewStage('?stage=black');
    const unknownStage = choosePreviewStage('?stage=verde');

    // Assert: the two design backgrounds, and the gradient otherwise.
    expect(greyStage, '?stage=grey must give the grey stage').toBe('grey');
    expect(blackStage, '?stage=black must give the black stage').toBe('black');
    expect(unknownStage, 'an unknown stage must keep the gradient').toBe('gradient');
  });

  it('answers a pt-BR problem for ?data= that is not JSON', () => {
    // Arrange: a query whose data was cut short.

    // Act: read it.
    const choice = choosePreviewData('?data=%7B%22entries%22');

    // Assert: a readable refusal, not a throw.
    expect(choice, 'unreadable data must give a pt-BR problem').toEqual({
      isReadable: false,
      problem: 'O parâmetro ?data= do endereço não é um JSON válido.',
    });
  });
});
