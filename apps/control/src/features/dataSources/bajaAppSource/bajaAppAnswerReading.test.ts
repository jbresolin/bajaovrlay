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
 *     parts, never the position, the car, the team or the ranking column itself.
 *   - A table that names no ranking column is refused with a sentence.
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

  it('refuses a table that names no ranking column', () => {
    // Arrange: the 26BR table without its ranking.
    const answer: { ranking?: unknown } = copyAnswer(bajaAppAnswers.overall26BR);
    delete answer.ranking;

    // Act: read its columns.
    const reading = readBajaAppTableColumns(answer);

    // Assert: refused with the sentence.
    expect(reading, 'no ranking column').toEqual({
      isRead: false,
      reason: 'A tabela não diz por qual coluna classifica.',
    });
  });
});
