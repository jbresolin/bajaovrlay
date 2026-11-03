/**
 * The Baja app's teams written as the Equipes CSV (apps/control)
 *
 * What this module is for:
 *   "Importar equipes do app Baja" (BAJAOVRLAY-54) reads an event's teams (equipes.php)
 *   through the server and writes them as the Equipes tab's CSV, so the import goes
 *   through the very preview and importEntities of "Importar CSV". Each team becomes one
 *   line: carro ← number; equipe ← short name, else the full one; escola ← short school,
 *   else the full one; escola_completa ← school; cidade; uf. Every text is cleaned as the
 *   flex mapping cleans one (entities decoded, spaces collapsed, trimmed). What the app
 *   leaves blank never clears what a stored team has.
 *
 * What these tests prove:
 *   - The real 26BR teams: Poli's line from its short names and its city, and team 100,
 *     whose short names are empty, from its full ones.
 *   - The real 26SE teams, with no short names at all, are written with the full names.
 *   - A trailing space and an `&nbsp;` are cleaned out of a name.
 *   - A stored team keeps the short school its operator typed when the app has none, and
 *     the city the app leaves blank.
 *   - A state that is not a Brazilian state ("EX" on 26SE's test team) is left blank.
 *   - An answer that is not a teams list, and an empty list, are refused with a sentence.
 *
 * What these tests deliberately do not cover:
 *   - The preview and the import: entityCsvImport.test.ts, and the button's own tests
 *     (BajaAppTeamsImport.test.tsx).
 */
import type { Team } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import teams26BR from '../../../../../packages/shared/src/flexMapping/examples/bajaApp/equipes-26BR.json';
import teams26SE from '../../../../../packages/shared/src/flexMapping/examples/bajaApp/equipes-26SE.json';
import { writeBajaAppTeamsAsCsvText } from './bajaAppTeamsAsCsv';

/** The CSV's header, as the Equipes tab reads it. */
const teamsCsvHeader = 'carro;equipe;escola;escola_completa;cidade;uf';

/** The line of one car in a written CSV text, or undefined. */
function findLineOfCar(csvText: string, carNumber: number): string | undefined {
  return csvText.split('\n').find((line) => line.startsWith(`${String(carNumber)};`));
}

/** Team 1 of 26SE as an operator stored it: "UFF" typed as its school, Niterói its city. */
function buildStoredTuffao(): Team {
  return {
    carNumber: 1,
    teamName: 'Tuffão',
    schoolName: 'UFF',
    city: 'Niterói',
    state: 'RJ',
  };
}

describe('writeBajaAppTeamsAsCsvText', () => {
  it('writes the real 26BR teams by their short names, the full ones when those are empty', () => {
    // Arrange: the real 26BR teams and an empty library.
    const answer = teams26BR;

    // Act: write them as the CSV.
    const written = writeBajaAppTeamsAsCsvText(answer, []);

    // Assert: 53 teams under the header; Poli by its short names, team 100 by its full ones.
    expect(written.isWritten, 'the list must be written').toBe(true);
    if (!written.isWritten) {
      return;
    }
    expect(written.teamCount, 'every team of 26BR').toBe(53);
    expect(written.csvText.split('\n')[0], 'the Equipes header first').toBe(teamsCsvHeader);
    expect(findLineOfCar(written.csvText, 5), 'Poli by its short names').toBe(
      '5;Poli;Poli;Escola Politécnica da Universidade de São Paulo - Poli USP;São Paulo;SP',
    );
    expect(findLineOfCar(written.csvText, 100), 'team 100 by its full names').toBe(
      '100;EQUIPE TESTE 2;Escola Teste;Escola Teste;;',
    );
  });

  it('writes the real 26SE teams, which have no short names, with the full names', () => {
    // Arrange: the real 26SE teams and an empty library.
    const answer = teams26SE;

    // Act: write them as the CSV.
    const written = writeBajaAppTeamsAsCsvText(answer, []);

    // Assert: 26 teams; team 4 under its full team and school names.
    expect(written, 'every team of 26SE').toMatchObject({ isWritten: true, teamCount: 26 });
    const csvText = written.isWritten ? written.csvText : '';
    expect(findLineOfCar(csvText, 4), 'team 4 by its full names').toBe(
      '4;Equipe Poli;Escola Politécnica da Universidade de São Paulo;Escola Politécnica da Universidade de São Paulo;;',
    );
  });

  it('cleans a trailing space and an entity out of a name', () => {
    // Arrange: one team as the app writes some, "Procobaja " and "Baja&nbsp;SAE".
    const answer = {
      event_id: '26BR',
      teams: [
        {
          number: 13,
          name: 'Procobaja ',
          short_name: 'Procobaja ',
          school: 'Universidade&nbsp;Federal de Santa Maria',
          school_short: 'UFSM',
          city: 'Santa Maria',
          state: 'RS',
          disqualified: false,
        },
      ],
    };

    // Act: write it as the CSV.
    const written = writeBajaAppTeamsAsCsvText(answer, []);

    // Assert: one plain space, no space at the end.
    const csvText = written.isWritten ? written.csvText : '';
    expect(findLineOfCar(csvText, 13), 'the names cleaned').toBe(
      '13;Procobaja;UFSM;Universidade Federal de Santa Maria;Santa Maria;RS',
    );
  });

  it('keeps what a stored team has where the app has no short name or leaves a blank', () => {
    // Arrange: the real 26SE teams, team 1 stored with "Tuffão", "UFF", Niterói and RJ.
    const answer = teams26SE;

    // Act: write them as the CSV.
    const written = writeBajaAppTeamsAsCsvText(answer, [buildStoredTuffao()]);

    // Assert: the stored short names and place kept, the app's full school added.
    const csvText = written.isWritten ? written.csvText : '';
    expect(findLineOfCar(csvText, 1), 'team 1 keeps what its operator typed').toBe(
      '1;Tuffão;UFF;Universidade Federal Fluminense;Niterói;RJ',
    );
  });

  it('leaves blank a state that is not a Brazilian state', () => {
    // Arrange: the real 26SE teams, whose test team 100 says "EX".
    const answer = teams26SE;

    // Act: write them as the CSV.
    const written = writeBajaAppTeamsAsCsvText(answer, []);

    // Assert: team 100's uf is empty.
    const csvText = written.isWritten ? written.csvText : '';
    expect(findLineOfCar(csvText, 100), 'no "EX"').toBe('100;Teste 2;;;;');
  });

  const refusalScenarios = [
    // The overall table given by mistake: it has no teams list.
    {
      name: 'refuses an answer that is not a teams list',
      answer: { event_id: '26BR', resultado_id: '26BR_GER', rows: [] },
      reason: 'A resposta não é uma lista de equipes do app Baja.',
    },
    // An event the organisers have not filled in yet.
    {
      name: 'refuses an event with no team',
      answer: { event_id: '27BR', teams: [] },
      reason: 'O app Baja não lista equipes neste evento.',
    },
  ];

  it.each(refusalScenarios)('$name', ({ answer, reason }) => {
    // Arrange: this row's answer.

    // Act: try to write it.
    const written = writeBajaAppTeamsAsCsvText(answer, []);

    // Assert: refused with this row's sentence.
    expect(written, 'refused with the sentence').toEqual({ isWritten: false, reason });
  });
});
