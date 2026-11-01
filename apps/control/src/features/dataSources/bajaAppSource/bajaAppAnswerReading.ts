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

// What the picker needs of resultado.php: the column it ranks by, and every column.
const BajaAppTableAnswerSchema = z.looseObject({
  ranking: z.looseObject({ by: z.string() }).optional(),
  columns: z.array(z.looseObject({ header: z.string(), kind: z.string() })),
});

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
 * Reads resultado.php's answer into its ranking column (`ranking.by`, the points) and the
 * columns that may be parts of the score: every column but the ranking one and those
 * naming the row (position, car, team), in the table's order.
 */
export function readBajaAppTableColumns(answer: unknown): BajaAppTableColumnsReading {
  const parsing = BajaAppTableAnswerSchema.safeParse(answer);
  if (!parsing.success) {
    return { isRead: false, reason: texts.notATable };
  }
  const pointsHeader = parsing.data.ranking?.by;
  if (pointsHeader === undefined) {
    return { isRead: false, reason: texts.tableWithoutRanking };
  }
  const partHeaderChoices = parsing.data.columns
    .filter((column) => !columnKindsThatAreNotScores.has(column.kind))
    .map((column) => column.header)
    .filter((header) => header !== pointsHeader);
  return { isRead: true, pointsHeader, partHeaderChoices };
}
