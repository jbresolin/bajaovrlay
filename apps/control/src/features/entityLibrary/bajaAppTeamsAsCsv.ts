import { BrazilianStateCodeSchema, cleanUpTextFromASource, type Team } from '@bajaovrlay/shared';
import { z } from 'zod';

import { ptBR } from '@/i18n/ptBR';

import { writeCsvTextForThePasteBox } from './csvText';

const texts = ptBR.entityLibrary.bajaApp;

// What the import needs of equipes.php (the Baja app's `docs/results-api.md`). Loose: the
// contract only ever adds keys. Every text may be null or "" (26SE has no short names).
const nullableText = z.string().nullable().optional();
const BajaAppTeamsAnswerSchema = z.looseObject({
  teams: z.array(
    z.looseObject({
      number: z.number().int(),
      name: nullableText,
      short_name: nullableText,
      school: nullableText,
      school_short: nullableText,
      city: nullableText,
      state: nullableText,
    }),
  ),
});

/** One team of the answer, as the schema reads it. */
type BajaAppTeam = z.infer<typeof BajaAppTeamsAnswerSchema>['teams'][number];

// The Equipes tab's CSV columns this import fills (entityCsvColumns.ts), in that order. The
// "placa_clara" column is left out, so the import says nothing about it and keeps it.
const teamsCsvHeader = ['carro', 'equipe', 'escola', 'escola_completa', 'cidade', 'uf'];

/** The CSV text for the import panel, or the pt-BR reason there is none. */
export type BajaAppTeamsCsv =
  { isWritten: true; csvText: string; teamCount: number } | { isWritten: false; reason: string };

/**
 * Writes the teams of equipes.php as the Equipes tab's CSV, for "Importar CSV"'s own
 * preview and importEntities: carro ← number; equipe ← the short name, else the stored
 * team's, else the full one; escola ← the short school, else the stored team's, else the
 * full one; escola_completa ← the school; cidade; uf (only a Brazilian state). A blank of
 * the app takes the stored team's value, so the import never clears what an operator
 * typed. Every text is cleaned up as the flex mapping cleans one.
 */
export function writeBajaAppTeamsAsCsvText(answer: unknown, storedTeams: Team[]): BajaAppTeamsCsv {
  const parsing = BajaAppTeamsAnswerSchema.safeParse(answer);
  if (!parsing.success) {
    return { isWritten: false, reason: texts.notATeamsList };
  }
  const teams = parsing.data.teams;
  if (teams.length === 0) {
    return { isWritten: false, reason: texts.noTeams };
  }
  const rows = teams.map((team) => {
    const storedTeam = storedTeams.find((stored) => stored.carNumber === team.number);
    return writeCellsOfTeam(team, storedTeam);
  });
  return {
    isWritten: true,
    csvText: writeCsvTextForThePasteBox(teamsCsvHeader, rows),
    teamCount: teams.length,
  };
}

/** One team's cells, in the header's order. */
function writeCellsOfTeam(team: BajaAppTeam, storedTeam: Team | undefined): string[] {
  const teamName = pickFirstText(
    cleanUp(team.short_name),
    storedTeam?.teamName,
    cleanUp(team.name),
  );
  const schoolName = pickFirstText(
    cleanUp(team.school_short),
    storedTeam?.schoolName,
    cleanUp(team.school),
  );
  const schoolFullName = pickFirstText(cleanUp(team.school), storedTeam?.schoolFullName);
  const city = pickFirstText(cleanUp(team.city), storedTeam?.city);
  const state = pickFirstText(readBrazilianState(team.state), storedTeam?.state);
  return [String(team.number), teamName, schoolName, schoolFullName, city, state];
}

/** A text of the app cleaned up, or "" for none. */
function cleanUp(text: string | null | undefined): string {
  return cleanUpTextFromASource(text ?? '');
}

/** The app's state when it is a Brazilian state's code ("SP"), else "" (26SE's "EX"). */
function readBrazilianState(state: string | null | undefined): string {
  const parsing = BrazilianStateCodeSchema.safeParse(cleanUp(state));
  return parsing.success ? parsing.data : '';
}

/** The first text that is not empty, in the order given, or "" when all are. */
function pickFirstText(...candidates: Array<string | undefined>): string {
  return candidates.find((candidate) => candidate !== undefined && candidate !== '') ?? '';
}
