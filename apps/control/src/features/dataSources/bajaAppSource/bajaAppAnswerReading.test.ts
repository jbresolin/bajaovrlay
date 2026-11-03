/**
 * Reading the Baja app's event and table answers for "Adicionar fonte do app Baja"
 * (apps/control)
 *
 * What this module is for:
 *   The picker reads two answers of the Baja app's results API before it fills a preset
 *   in: the event (evento.php), for what can be chosen, and a chosen table (resultado.php),
 *   for the column it ranks by and the columns that can be parts of the score. The API may
 *   add keys at any time and its texts carry spaces and HTML entities, so the readers take
 *   only what they need and clean every name as the flex mapping does.
 *
 * What these tests prove:
 *   - The made-up 26BR during its competition gives its name, its one lap-counted race,
 *     its 21 tables (the overall one told apart) and its one tournament, by id and name.
 *   - The real 26BR after its competition gives no race and no tournament.
 *   - A name with an entity and a trailing space is cleaned ("24BR" had `&nbsp;`).
 *   - An answer that is not an event is refused with a sentence.
 *   - The real 26BR overall table ranks by "Total", and offers its six score columns as
 *     parts, never the position, the car, the team or the ranking column itself; the real
 *     26BR Enduro ranks by "Pontos".
 *   - As the contract says (gate 2 of PR #38): the points come from the column flagged
 *     `ranking: true`, whatever `ranking.by` holds (it may be a formula variable); a column
 *     with no title (`header` null) is read and never offered; a table that ranks nobody
 *     (`ranking` null, the real Segurança Estática) and one that flags no column are each
 *     refused with their own sentence.
 *
 * What these tests deliberately do not cover:
 *   - Fetching these answers: the picker's tests (DataSourcesPageBajaApp.test.tsx).
 */
import { describe, expect, it } from 'vitest';

import { readBajaAppEventAnswer, readBajaAppTableColumns } from './bajaAppAnswerReading';
import { bajaAppAnswers } from './bajaAppSampleRoute.testSupport';

/** A fresh copy of an answer, for a test that changes it. */
function copyAnswer<Answer>(answer: Answer): Answer {
  return structuredClone(answer);
}

describe('readBajaAppEventAnswer', () => {
  it('lists the made-up 26BR’s race, tables and tournament by id and name', () => {
    // Arrange: 26BR as it would read during its competition.
    const answer = bajaAppAnswers.event26BRDuringTheEvent;

    // Act: read it.
    const reading = readBajaAppEventAnswer(answer);

    // Assert: the event's name, the Enduro, 21 tables with Geral overall, the bracket.
    expect(reading.isRead, 'the event must read').toBe(true);
    if (!reading.isRead) {
      return;
    }
    expect(reading.event.eventName, 'the event’s name').toBe('31ª Competição Baja SAE BRASIL');
    expect(reading.event.races, 'the lap-counted Enduro').toEqual([
      { provaId: 'END', name: 'Enduro' },
    ]);
    expect(reading.event.tables, 'every table').toHaveLength(21);
    expect(reading.event.tables[0], 'the first table, not overall').toEqual({
      resultadoId: '26BR_SGE',
      name: 'Segurança Estática',
      isTheOverallTable: false,
    });
    expect(reading.event.tables.at(-1), 'Geral, the overall table').toEqual({
      resultadoId: '26BR_GER',
      name: 'Geral',
      isTheOverallTable: true,
    });
    expect(reading.event.tournaments, 'the Super Prime bracket').toEqual([
      { resultadoId: '26BR_SPR', name: 'Chaveamento Super Prime' },
    ]);
  });

  it('lists no race and no tournament for the real 26BR after its competition', () => {
    // Arrange: the real 26BR answer.
    const answer = bajaAppAnswers.event26BR;

    // Act: read it.
    const reading = readBajaAppEventAnswer(answer);

    // Assert: tables only.
    expect(reading, 'tables only').toMatchObject({
      isRead: true,
      event: { races: [], tournaments: [] },
    });
  });

  it('cleans the names as the flex mapping does', () => {
    // Arrange: 26BR with an entity and a trailing space in its name and in the Enduro's.
    const answer = copyAnswer(bajaAppAnswers.event26BRDuringTheEvent);
    answer.event.name = 'Baja SAE&nbsp;BRASIL - Etapa Nacional ';
    const enduro = answer.provas.find((prova) => prova.id === 'END');
    if (enduro !== undefined) {
      enduro.name = 'Enduro ';
    }

    // Act: read it.
    const reading = readBajaAppEventAnswer(answer);

    // Assert: one plain space, no space at the end.
    expect(reading, 'the names cleaned').toMatchObject({
      isRead: true,
      event: {
        eventName: 'Baja SAE BRASIL - Etapa Nacional',
        races: [{ provaId: 'END', name: 'Enduro' }],
      },
    });
  });

  it('refuses an answer that is not an event', () => {
    // Arrange: the 26BR overall table, given by mistake.
    const answer = bajaAppAnswers.overall26BR;

    // Act: read it as an event.
    const reading = readBajaAppEventAnswer(answer);

    // Assert: refused with the sentence.
    expect(reading, 'not an event').toEqual({
      isRead: false,
      reason: 'A resposta não é um evento do app Baja.',
    });
  });
});

describe('readBajaAppTableColumns', () => {
  it('reads the 26BR overall table’s ranking column and its score columns', () => {
    // Arrange: the real 26BR overall table.
    const answer = bajaAppAnswers.overall26BR;

    // Act: read its columns.
    const reading = readBajaAppTableColumns(answer);

    // Assert: "Total" ranks; the six score columns are offered, in the table's order.
    expect(reading, 'the ranking column and the parts offered').toEqual({
      isRead: true,
      pointsHeader: 'Total',
      partHeaderChoices: ['Região', 'Penalidade', 'Segurança', 'Projeto', 'Dinâmicas', 'Enduro'],
    });
  });

  it('reads a prova’s table, the real 26BR Enduro, ranked by "Pontos"', () => {
    // Arrange: the real 26BR Enduro table.
    const answer = bajaAppAnswers.enduroTable26BR;

    // Act: read its columns.
    const reading = readBajaAppTableColumns(answer);

    // Assert: "Pontos" is the points, "Voltas" the one part offered.
    expect(reading, 'the Enduro’s points and its one part').toEqual({
      isRead: true,
      pointsHeader: 'Pontos',
      partHeaderChoices: ['Voltas'],
    });
  });

  it('takes the points from the column flagged as the ranking one, and offers no column with no title', () => {
    // Arrange: the made-up Enduro table whose ranking.by is a formula variable
    // ("pontos_enduro", no column's header) and which has a column with no title.
    const answer = bajaAppAnswers.enduroTableWithANullHeader26BR;

    // Act: read its columns.
    const reading = readBajaAppTableColumns(answer);

    // Assert: read as a table; the points from "Pontos", flagged `ranking: true`; the
    // column with no title is no part, as nothing could read it by its header.
    expect(reading, 'the flagged column, and "Voltas" alone offered').toEqual({
      isRead: true,
      pointsHeader: 'Pontos',
      partHeaderChoices: ['Voltas'],
    });
  });

  const tablesWithoutPointsScenarios = [
    // A real table that ranks nobody (Segurança Estática, `ranking` null): the operator
    // reads that it ranks nobody, not that the answer is no table.
    {
      name: 'refuses the real 26BR Segurança Estática, which ranks nobody',
      answer: bajaAppAnswers.staticSafetyTableRankingNobody26BR,
      expectedReason: 'A tabela não diz por qual coluna classifica.',
    },
    // A ranking with no column flagged: no points to read, so no source that would fail
    // every poll is made.
    {
      name: 'refuses a table that flags no column as the ranking one',
      answer: bajaAppAnswers.enduroTableWithNoRankingColumn26BR,
      expectedReason: 'A tabela não tem coluna de pontos: nenhuma coluna é a da classificação.',
    },
  ];

  it.each(tablesWithoutPointsScenarios)('$name', ({ answer, expectedReason }) => {
    // Arrange: nothing beyond this row's table.

    // Act: read its columns.
    const reading = readBajaAppTableColumns(answer);

    // Assert: refused with this row's sentence.
    expect(reading, 'no points column to read').toEqual({ isRead: false, reason: expectedReason });
  });
});
