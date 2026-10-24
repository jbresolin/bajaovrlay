/**
 * The standings' data: its Zod schema (the boundary check for `load` and `updateAction`),
 * the merge of partial updates, the settings with their defaults applied, and pt-BR
 * descriptions of bad data. standings.ograf.json describes the same data as JSON Schema
 * for renderers and forms; standingsManifest*.test.ts keep the two in agreement.
 *
 * The entries follow the canonical standings shape (packages/shared, BAJAOVRLAY-24), which
 * already refuses a disqualified entry with a rank, a ranked entry after a disqualified
 * one and a `pointsByPart` key that names no part. The graphic does not repeat those
 * rules: it draws what it is given, and a rank left out reads "—" whatever the reason.
 */
import { describeFirstDataProblemInPortuguese } from '@bajaovrlay/graphics-kit/dataProblems';
import { z } from 'zod';

import { ptBR } from './ptBR.js';

// Loose on purpose, like the tower's entries: a canonical entry passes as is even when
// the shape gains a field the standings do not draw yet.
const standingsEntrySchema = z.looseObject({
  rank: z.int().min(1).optional(),
  carNumber: z.int().min(1),
  teamName: z.string(),
  schoolName: z.string(),
  // Fractional (903.48) and, for a part like PEN., negative.
  points: z.number(),
  pointsByPart: z.record(z.string(), z.number()).optional(),
  isDisqualified: z.boolean().optional(),
});

const scorePartSchema = z.looseObject({
  partId: z.string(),
  label: z.string(),
});

// Strict at the top: a field the graphic does not know (usually a typo) is refused.
const standingsDataSchema = z.strictObject({
  entries: z.array(standingsEntrySchema),
  scoreParts: z.array(scorePartSchema).optional(),
  title: z.string().optional(),
  eventLine: z.string().optional(),
});

const partialStandingsDataSchema = standingsDataSchema.partial();

/** One team as the standings read it (extra fields of a canonical entry ride along). */
export type StandingsEntry = z.infer<typeof standingsEntrySchema>;

/** One part of the overall score, in display order: `{ partId: 'projeto', label: 'PROJETO' }`. */
export type ScorePart = z.infer<typeof scorePartSchema>;

/** Everything the standings show, as the renderer sends it. */
export type StandingsData = z.infer<typeof standingsDataSchema>;

/** What the standings draw with, every setting present (defaults applied). */
export type StandingsSettings = {
  title: string;
  /** The event under the title; empty when the item gives none (the line is then left out). */
  eventLine: string;
  /** The score's parts; empty means the board in three columns with the total alone. */
  scoreParts: ScorePart[];
};

/** Either good data, or a pt-BR sentence saying what is wrong with it. */
export type StandingsDataCheck =
  { isValid: true; data: StandingsData } | { isValid: false; problem: string };

/**
 * Reads the settings from the data, applying the manifest's defaults to whatever was left
 * out: the title "CLASSIFICAÇÃO GERAL", no event line, no score parts. The one place the
 * defaults live in code.
 */
export function readStandingsSettings(data: StandingsData): StandingsSettings {
  return {
    title: data.title ?? ptBR.defaultTitle,
    eventLine: data.eventLine ?? '',
    scoreParts: data.scoreParts ?? [],
  };
}

/** Checks the complete data `load` receives. Never throws; bad data gives a pt-BR problem. */
export function parseCompleteStandingsData(input: unknown): StandingsDataCheck {
  const parsed = standingsDataSchema.safeParse(input);
  if (parsed.success) {
    return { isValid: true, data: parsed.data };
  }
  return {
    isValid: false,
    problem: describeFirstDataProblemInPortuguese(input, parsed.error, ptBR.validationProblems),
  };
}

/**
 * Merges the partial data `updateAction` receives into the current data. The current
 * data is never modified: a refused update leaves nothing half-applied.
 */
export function mergePartialUpdateIntoStandingsData(
  currentData: StandingsData,
  partialInput: unknown,
): StandingsDataCheck {
  const parsedUpdate = partialStandingsDataSchema.safeParse(partialInput);
  if (!parsedUpdate.success) {
    return {
      isValid: false,
      problem: describeFirstDataProblemInPortuguese(
        partialInput,
        parsedUpdate.error,
        ptBR.validationProblems,
      ),
    };
  }
  const mergedData = { ...currentData, ...parsedUpdate.data };
  return parseCompleteStandingsData(mergedData);
}
