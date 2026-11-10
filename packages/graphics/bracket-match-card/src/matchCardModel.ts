/**
 * The "a seguir" card's data: its Zod schema (the boundary check for `load` and
 * `updateAction`), the merge of partial updates, pt-BR descriptions of bad data, and the
 * look the data asks for. bracket-match-card.ograf.json describes the same data as JSON
 * Schema; matchCardManifestDataAgreement.test.ts keeps the two in agreement.
 *
 * Every field is optional, on purpose: the item reads "Chaves › Partida a seguir"
 * (BAJAOVRLAY-65), and an empty slot delivers nothing, which must draw nothing rather than
 * refuse the take or keep a stale match. A match is shown only when both teams arrive
 * (number and name). The logo, the school, the city and the state come from Cadastros and
 * may be missing: a side without a logo shows its car-number chip in its place.
 */
import { describeFirstDataProblemInPortuguese } from '@bajaovrlay/graphics-kit/dataProblems';
import { writeMatchTimeText } from '@bajaovrlay/graphics-kit/matchTimeText';
import { z } from 'zod';

import { ptBR } from './ptBR.js';

// Strict: a field the graphic does not know (usually a typo) is refused, not ignored.
const matchCardDataSchema = z.strictObject({
  roundName: z.string().optional(),
  bestOf: z.number().int().min(1).optional(),
  carANumber: z.number().int().min(1).optional(),
  carATeamName: z.string().optional(),
  carASchoolName: z.string().optional(),
  carACity: z.string().optional(),
  carAState: z.string().optional(),
  carALogoUrl: z.string().optional(),
  carALogoOnLightPlate: z.boolean().optional(),
  carAWins: z.number().int().min(0).optional(),
  carATimeMs: z.number().int().min(0).optional(),
  carBNumber: z.number().int().min(1).optional(),
  carBTeamName: z.string().optional(),
  carBSchoolName: z.string().optional(),
  carBCity: z.string().optional(),
  carBState: z.string().optional(),
  carBLogoUrl: z.string().optional(),
  carBLogoOnLightPlate: z.boolean().optional(),
  carBWins: z.number().int().min(0).optional(),
  carBTimeMs: z.number().int().min(0).optional(),
});

/** Everything the card shows, as the renderer sends it. */
export type MatchCardData = z.infer<typeof matchCardDataSchema>;

/** Either good data, or a pt-BR sentence saying what is wrong with it. */
export type MatchCardDataCheck =
  { isValid: true; data: MatchCardData } | { isValid: false; problem: string };

/** One side of the card as it is drawn. */
export type MatchCardCarLook = {
  carNumber: number;
  teamName: string;
  /** "UPE · Recife · PE": what is known of school, city and state; undefined when nothing is. */
  detailsLine: string | undefined;
  /** The team's logo and whether it sits on the light plate; undefined draws the chip. */
  logo: { url: string; isOnLightPlate: boolean } | undefined;
  /** Its wins in a series, its time in a timed match; only once the match has started. */
  resultText: string | undefined;
};

/** The match the card shows. */
export type MatchCardMatchLook = {
  roundName: string | undefined;
  /** "MD3" for a best of 3; undefined for a single race. */
  seriesTag: string | undefined;
  /** Whether a race of it has been run: the score line shows only then. */
  hasStarted: boolean;
  cars: [MatchCardCarLook, MatchCardCarLook];
};

/** What the card shows: the match, or undefined when there is none to show. */
export type MatchCardLook = { match: MatchCardMatchLook | undefined };

/** One side's fields as the data carries them, before they are read. */
type CarFields = {
  carNumber: number | undefined;
  teamName: string | undefined;
  schoolName: string | undefined;
  city: string | undefined;
  state: string | undefined;
  logoUrl: string | undefined;
  logoOnLightPlate: boolean | undefined;
  wins: number | undefined;
  timeMs: number | undefined;
};

/** Says whether a text has something in it once trimmed. */
function isTextGiven(text: string | undefined): text is string {
  return text !== undefined && text.trim() !== '';
}

/** "UPE · Recife · PE": the parts that are known, in that order, or undefined for none. */
function writeDetailsLine(car: CarFields): string | undefined {
  const knownParts = [car.schoolName, car.city, car.state]
    .filter(isTextGiven)
    .map((part) => part.trim());
  if (knownParts.length === 0) {
    return undefined;
  }
  return knownParts.join(ptBR.detailsSeparator);
}

/** Whether a race of the match has been run: a win in the series, or a car's time. */
function hasMatchStarted(cars: CarFields[], isSeries: boolean): boolean {
  if (isSeries) {
    return cars.some((car) => car.wins !== undefined && car.wins > 0);
  }
  return cars.some((car) => car.timeMs !== undefined);
}

/** The side's result once the match has started: its wins, or its time when it has run. */
function writeResultText(car: CarFields, isSeries: boolean, hasStarted: boolean): string | undefined {
  if (!hasStarted) {
    return undefined;
  }
  if (isSeries) {
    return String(car.wins ?? 0);
  }
  return car.timeMs === undefined ? undefined : writeMatchTimeText(car.timeMs);
}

/** One side's look, or undefined when its number or team name did not arrive. */
function readCarLook(
  car: CarFields,
  isSeries: boolean,
  hasStarted: boolean,
): MatchCardCarLook | undefined {
  if (car.carNumber === undefined || !isTextGiven(car.teamName)) {
    return undefined;
  }
  const logo = isTextGiven(car.logoUrl)
    ? { url: car.logoUrl, isOnLightPlate: car.logoOnLightPlate === true }
    : undefined;
  return {
    carNumber: car.carNumber,
    teamName: car.teamName.trim(),
    detailsLine: writeDetailsLine(car),
    logo,
    resultText: writeResultText(car, isSeries, hasStarted),
  };
}

/** Reads both sides' fields out of the flat data, carA first. */
function readCarFields(data: MatchCardData): [CarFields, CarFields] {
  return [
    {
      carNumber: data.carANumber,
      teamName: data.carATeamName,
      schoolName: data.carASchoolName,
      city: data.carACity,
      state: data.carAState,
      logoUrl: data.carALogoUrl,
      logoOnLightPlate: data.carALogoOnLightPlate,
      wins: data.carAWins,
      timeMs: data.carATimeMs,
    },
    {
      carNumber: data.carBNumber,
      teamName: data.carBTeamName,
      schoolName: data.carBSchoolName,
      city: data.carBCity,
      state: data.carBState,
      logoUrl: data.carBLogoUrl,
      logoOnLightPlate: data.carBLogoOnLightPlate,
      wins: data.carBWins,
      timeMs: data.carBTimeMs,
    },
  ];
}

/**
 * Reads what the card shows: the match only when both teams arrived, "MD3" only for a
 * best of N above 1, and the score only once the match has started.
 */
export function readMatchCardLook(data: MatchCardData): MatchCardLook {
  const isSeries = data.bestOf !== undefined && data.bestOf > 1;
  const [carAFields, carBFields] = readCarFields(data);
  const hasStarted = hasMatchStarted([carAFields, carBFields], isSeries);
  const carA = readCarLook(carAFields, isSeries, hasStarted);
  const carB = readCarLook(carBFields, isSeries, hasStarted);
  if (carA === undefined || carB === undefined) {
    return { match: undefined };
  }
  return {
    match: {
      roundName: isTextGiven(data.roundName) ? data.roundName.trim() : undefined,
      seriesTag: isSeries ? ptBR.seriesTag(data.bestOf ?? 1) : undefined,
      hasStarted,
      cars: [carA, carB],
    },
  };
}

/** Checks the complete data `load` receives. Never throws; bad data gives a pt-BR problem. */
export function parseCompleteMatchCardData(input: unknown): MatchCardDataCheck {
  const parsed = matchCardDataSchema.safeParse(input);
  if (parsed.success) {
    return { isValid: true, data: parsed.data };
  }
  return {
    isValid: false,
    problem: describeFirstDataProblemInPortuguese(input, parsed.error, ptBR.validationProblems),
  };
}

/**
 * Merges the partial data `updateAction` receives into the current data. A field sent as
 * undefined (the renderer's way of saying it left the air) is cleared. The current data
 * is never modified: a refused update leaves nothing half-applied.
 */
export function mergePartialUpdateIntoMatchCardData(
  currentData: MatchCardData,
  partialInput: unknown,
): MatchCardDataCheck {
  const parsedUpdate = matchCardDataSchema.safeParse(partialInput);
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
  return parseCompleteMatchCardData(mergedData);
}
