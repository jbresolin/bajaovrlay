import { cleanUpTextFromASource } from '@bajaovrlay/shared';
import { z } from 'zod';

import { ptBR } from '@/i18n/ptBR';

const texts = ptBR.dataSources.bajaApp;

// What the picker needs of evento.php (the Baja app's `docs/results-api.md`). Loose objects:
// the contract only ever adds keys, and a key added must not stop the picker.
const BajaAppEventAnswerSchema = z.looseObject({
  event: z.looseObject({ id: z.string(), name: z.string() }),
  resultados: z.array(
    z.looseObject({
      id: z.string(),
      name: z.string(),
      group: z.string().nullable(),
      type: z.string(),
    }),
  ),
  provas: z.array(
    z.looseObject({
      id: z.string(),
      name: z.string(),
      lap_counted: z.boolean(),
    }),
  ),
});

// What the picker needs of resultado.php: whether it ranks, and every column, as the
// contract writes them: `ranking` null for a table that ranks nobody, a column's `header`
// null when it has no title, and the column `ranking.by` names flagged `ranking: true`
// (`ranking.by` itself may be a formula variable, no column's header).
const BajaAppTableAnswerSchema = z.looseObject({
  ranking: z.looseObject({}).nullable().optional(),
  columns: z.array(
    z.looseObject({
      header: z.string().nullable(),
      kind: z.string(),
      ranking: z.boolean().optional(),
    }),
  ),
});

// What the picker needs of torneio.php for a result read by its id: that it holds rounds,
// and its name.
const BajaAppTournamentAnswerSchema = z.looseObject({
  name: z.string(),
  rounds: z.array(z.unknown()),
});

// A table's own name, read from resultado.php for a result read by its id.
const BajaAppResultNameSchema = z.looseObject({ name: z.string() });

// The API's error body (`{"success": false, "error": "…", "code": "wrong_type"}`): only the
// code is read, as the contract asks ("test `code`").
const BajaAppErrorBodySchema = z.looseObject({ code: z.string() });

// The kinds of column that name the row rather than score it: never a part of the score.
const columnKindsThatAreNotScores = new Set(['position', 'team_number', 'team']);

/** One lap-counted race of an event: its prova, for corrida.php. */
export type BajaAppRaceChoice = { provaId: string; name: string };

/** One results table of an event, for resultado.php. The overall one has no group. */
export type BajaAppTableChoice = { resultadoId: string; name: string; isTheOverallTable: boolean };

/** One tournament of an event, for torneio.php. */
export type BajaAppTournamentChoice = { resultadoId: string; name: string };

/** What an event offers to make a source from, each list in the API's order. */
export type BajaAppEventChoices = {
  eventName: string;
  races: BajaAppRaceChoice[];
  tables: BajaAppTableChoice[];
  tournaments: BajaAppTournamentChoice[];
};

/** The event read, or the pt-BR reason it could not be. */
export type BajaAppEventReading =
  { isRead: true; event: BajaAppEventChoices } | { isRead: false; reason: string };

/** A table's columns read, or the pt-BR reason they could not be. */
export type BajaAppTableColumnsReading =
  | { isRead: true; pointsHeader: string; partHeaderChoices: string[] }
  | { isRead: false; reason: string };

/**
 * Reads evento.php's answer into what can be chosen: its lap-counted provas (a race),
 * its resultados of type "table" and those of type "tournament". Every name is cleaned
 * up as the flex mapping cleans a text (entities decoded, spaces collapsed, trimmed).
 */
export function readBajaAppEventAnswer(answer: unknown): BajaAppEventReading {
  const parsing = BajaAppEventAnswerSchema.safeParse(answer);
  if (!parsing.success) {
    return { isRead: false, reason: texts.notAnEvent };
  }
  const event = parsing.data;

  const races = event.provas
    .filter((prova) => prova.lap_counted)
    .map((prova) => ({ provaId: prova.id, name: cleanUpTextFromASource(prova.name) }));
  const tables = event.resultados
    .filter((resultado) => resultado.type === 'table')
    .map((resultado) => ({
      resultadoId: resultado.id,
      name: cleanUpTextFromASource(resultado.name),
      // The overall table ("Geral") is the one table in no group.
      isTheOverallTable: resultado.group === null,
    }));
  const tournaments = event.resultados
    .filter((resultado) => resultado.type === 'tournament')
    .map((resultado) => ({
      resultadoId: resultado.id,
      name: cleanUpTextFromASource(resultado.name),
    }));

  return {
    isRead: true,
    event: { eventName: cleanUpTextFromASource(event.event.name), races, tables, tournaments },
  };
}

/**
 * Reads resultado.php's answer into its points column (the one flagged `ranking: true`)
 * and the columns that may be parts of the score: every titled column but the points one
 * and those naming the row (position, car, team), in the table's order. A table that ranks
 * nobody, or flags no titled column, has no points to read: refused with its own sentence,
 * so no source is made that would fail every poll.
 */
export function readBajaAppTableColumns(answer: unknown): BajaAppTableColumnsReading {
  const parsing = BajaAppTableAnswerSchema.safeParse(answer);
  if (!parsing.success) {
    return { isRead: false, reason: texts.notATable };
  }
  const table = parsing.data;
  if (table.ranking === null || table.ranking === undefined) {
    return { isRead: false, reason: texts.tableWithoutRanking };
  }
  // A column with no title cannot be read by its header, so it is neither points nor a part.
  const titledColumns = table.columns.flatMap((column) =>
    column.header === null ? [] : [{ ...column, header: column.header }],
  );
  const pointsColumn = titledColumns.find((column) => column.ranking === true);
  if (pointsColumn === undefined) {
    return { isRead: false, reason: texts.tableWithoutPointsColumn };
  }
  const partHeaderChoices = titledColumns
    .filter((column) => !columnKindsThatAreNotScores.has(column.kind))
    .map((column) => column.header)
    .filter((header) => header !== pointsColumn.header);
  return { isRead: true, pointsHeader: pointsColumn.header, partHeaderChoices };
}

/** A tournament read by its id: its name, or the pt-BR reason it is not a tournament. */
export type BajaAppTournamentReading =
  { isRead: true; name: string } | { isRead: false; reason: string };

/** Reads torneio.php's answer for its name, cleaned; refused when it holds no rounds. */
export function readBajaAppTournamentAnswer(answer: unknown): BajaAppTournamentReading {
  const parsing = BajaAppTournamentAnswerSchema.safeParse(answer);
  if (!parsing.success) {
    return { isRead: false, reason: texts.notATournament };
  }
  return { isRead: true, name: cleanUpTextFromASource(parsing.data.name) };
}

/** A table's own name in resultado.php's answer, cleaned; the id typed when it has none. */
export function readBajaAppTableName(answer: unknown, resultadoId: string): string {
  const parsing = BajaAppResultNameSchema.safeParse(answer);
  return parsing.success ? cleanUpTextFromASource(parsing.data.name) : resultadoId;
}

/**
 * Says whether the API refused a result as asked of the wrong endpoint: its 404 with the
 * code `wrong_type` ("a tournament asked of resultado.php"), as the sample route hands on.
 */
export function isAResultOfTheOtherEndpoint(answerOutside2xx: unknown): boolean {
  const failedAnswer = z
    .looseObject({ status: z.number(), body: z.unknown() })
    .safeParse(answerOutside2xx);
  if (!failedAnswer.success) {
    return false;
  }
  const errorBody = BajaAppErrorBodySchema.safeParse(failedAnswer.data.body);
  return errorBody.success && errorBody.data.code === 'wrong_type';
}
