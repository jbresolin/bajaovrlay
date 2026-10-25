/**
 * The battle card's data: its Zod schema (the boundary check for `load` and
 * `updateAction`), the merge of partial updates, pt-BR descriptions of bad data, and the
 * texts of the cells: each car's laps and the gap. battle-card.ograf.json describes the
 * same data as JSON Schema for renderers and forms; battleCardManifestDataAgreement.test.ts
 * keeps the two in agreement.
 *
 * The fields are flat, one per value, so each can read its own path of the positions shape
 * in the item editor: `positions.entryOfCar.<field>` of the car ahead and of the car behind,
 * live, and the gap from the car behind's `intervalMs`.
 */
import { describeFirstDataProblemInPortuguese } from '@bajaovrlay/graphics-kit/dataProblems';
import { writeSecondsToTheTenthCutAsText } from '@bajaovrlay/shared/raceTimeText';
import { z } from 'zod';

import { type GapReading, isGapOfTheseTwoCars } from './battleTrend.js';
import { ptBR } from './ptBR.js';

// Strict: a field the graphic does not know (usually a typo) is refused, not ignored.
const battleCardDataSchema = z.strictObject({
  aheadPosition: z.int().min(1),
  aheadCarNumber: z.int().min(1),
  aheadTeamName: z.string(),
  aheadSchoolName: z.string(),
  aheadLaps: z.int().min(0),
  behindPosition: z.int().min(1),
  behindCarNumber: z.int().min(1),
  behindTeamName: z.string(),
  behindSchoolName: z.string(),
  behindLaps: z.int().min(0),
  // Optional since gate 2 of PR #27: the leader has no interval, and a required gap would
  // keep a stale one on air (the server keeps a required field that loses its value).
  gapMs: z.int().min(0).optional(),
  manualTrend: z.enum(['closing', 'opening', 'steady']).optional(),
  manualTrendChangeMs: z.int().min(0).optional(),
});

const partialBattleCardDataSchema = battleCardDataSchema.partial();

/** Everything the battle card shows, as the renderer sends it. */
export type BattleCardData = z.infer<typeof battleCardDataSchema>;

/** Either good data, or a pt-BR sentence saying what is wrong with it. */
export type BattleCardDataCheck =
  { isValid: true; data: BattleCardData } | { isValid: false; problem: string };

/** One of the two cars, as its pill shows it. */
export type BattleCar = {
  position: number;
  carNumber: number;
  teamName: string;
  schoolName: string;
  laps: number;
};

/** The car ahead, read from the flat fields. */
export function readCarAhead(data: BattleCardData): BattleCar {
  return {
    position: data.aheadPosition,
    carNumber: data.aheadCarNumber,
    teamName: data.aheadTeamName,
    schoolName: data.aheadSchoolName,
    laps: data.aheadLaps,
  };
}

/** The car behind, read from the flat fields. */
export function readCarBehind(data: BattleCardData): BattleCar {
  return {
    position: data.behindPosition,
    carNumber: data.behindCarNumber,
    teamName: data.behindTeamName,
    schoolName: data.behindSchoolName,
    laps: data.behindLaps,
  };
}

/** Whether a car's position sits on the green leader chip, as on the tower: position 1. */
export function isLeader(car: BattleCar): boolean {
  return car.position === 1;
}

/**
 * Writes the gap as the design does: the car behind's interval in seconds to the tenth,
 * cut like every race time, with a plus and no unit: 2 087 ms is "+2,0".
 */
export function writeGapText(gapMs: number): string {
  return `${ptBR.plusSign}${writeSecondsToTheTenthCutAsText(gapMs)}`;
}

/** The reading the trend follows (battleTrend.ts), taken from this data. */
export function readGapReading(data: BattleCardData): GapReading {
  return {
    aheadCarNumber: data.aheadCarNumber,
    aheadPosition: data.aheadPosition,
    behindCarNumber: data.behindCarNumber,
    behindPosition: data.behindPosition,
    behindLaps: data.behindLaps,
    gapMs: data.gapMs,
  };
}

/**
 * The gap cell's text: "+2,0" while the gap is these two cars' (battleTrend.ts,
 * isGapOfTheseTwoCars), "—" otherwise (no gap, or the cars not one place apart).
 */
export function writeGapCellText(data: BattleCardData): string {
  const reading = readGapReading(data);
  if (!isGapOfTheseTwoCars(reading)) {
    return ptBR.noGapText;
  }
  return writeGapText(reading.gapMs);
}

/** Checks the complete data `load` receives. Never throws; bad data gives a pt-BR problem. */
export function parseCompleteBattleCardData(input: unknown): BattleCardDataCheck {
  const parsed = battleCardDataSchema.safeParse(input);
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
 * data is never modified: a refused update leaves nothing half-applied. A field sent as
 * undefined (an in-page caller clearing the trend set by hand) is cleared.
 */
export function mergePartialUpdateIntoBattleCardData(
  currentData: BattleCardData,
  partialInput: unknown,
): BattleCardDataCheck {
  const parsedUpdate = partialBattleCardDataSchema.safeParse(partialInput);
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
  return parseCompleteBattleCardData(mergedData);
}
