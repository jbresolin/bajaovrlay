/**
 * The positions tower's data: its Zod schema (the boundary check for `load` and
 * `updateAction`), the merge of partial updates, the settings with their defaults applied,
 * and pt-BR descriptions of bad data. positions-tower.ograf.json describes the same data
 * as JSON Schema for renderers and forms; positionsTowerManifest*.test.ts keep the two in
 * agreement.
 */
import { z } from 'zod';

import { ptBR } from './ptBR.js';

/** The two layouts: the scoreboard's four columns, or the timing board's full set. */
export const towerLayouts = ['compact', 'detailed'] as const;

/** How the tower handles more cars than fit: turn pages, or hold the first page. */
export const pagingModes = ['cycle', 'firstPageOnly'] as const;

/** What a car is doing; the canonical positions shape's closed list, in the same order. */
export const positionStatuses = [
  'running',
  'inPit',
  'stopped',
  'retired',
  'disqualified',
  'notStarted',
] as const;

/**
 * Every column the tower can draw, in the order they are laid out. The compact layout
 * draws the first five and the status; the detailed layout adds the timing columns.
 */
export type TowerColumnKey =
  | 'pos'
  | 'cue'
  | 'car'
  | 'team'
  | 'laps'
  | 'gap'
  | 'interval'
  | 'lastLap'
  | 'bestLap'
  | 'pitStops'
  | 'fuelStops'
  | 'status';

export type TowerLayout = (typeof towerLayouts)[number];
export type PagingMode = (typeof pagingModes)[number];
export type PositionStatus = (typeof positionStatuses)[number];

// Loose on purpose: a canonical entry passes as is even when the shape gains a field the
// tower does not draw yet (decision 10 of the context pack). The limits repeat the
// canonical shape's: no lap takes no time, counts start at 0.
const towerEntrySchema = z.looseObject({
  position: z.int().min(1),
  carNumber: z.int().min(1),
  teamName: z.string(),
  schoolName: z.string(),
  laps: z.int().min(0),
  lastLapMs: z.int().min(1).optional(),
  bestLapMs: z.int().min(1).optional(),
  gapToLeaderMs: z.int().min(0).optional(),
  gapToLeaderLaps: z.int().min(0).optional(),
  intervalMs: z.int().min(0).optional(),
  pitStops: z.int().min(0).optional(),
  fuelStops: z.int().min(0).optional(),
  status: z.enum(positionStatuses),
});

// Strict at the top: a setting the graphic does not know (usually a typo) is refused.
const positionsTowerDataSchema = z.strictObject({
  entries: z.array(towerEntrySchema),
  layout: z.enum(towerLayouts).optional(),
  showGap: z.boolean().optional(),
  showInterval: z.boolean().optional(),
  showLastLap: z.boolean().optional(),
  showBestLap: z.boolean().optional(),
  showPitStops: z.boolean().optional(),
  showFuelStops: z.boolean().optional(),
  showStatus: z.boolean().optional(),
  paging: z.enum(pagingModes).optional(),
});

const partialPositionsTowerDataSchema = positionsTowerDataSchema.partial();

/** One car as the tower reads it (extra fields of a canonical entry ride along). */
export type TowerEntry = z.infer<typeof towerEntrySchema>;

/** Everything the tower shows, as the renderer sends it. */
export type PositionsTowerData = z.infer<typeof positionsTowerDataSchema>;

/** The settings the tower draws with, every one present (defaults applied). */
export type TowerSettings = {
  layout: TowerLayout;
  showGap: boolean;
  showInterval: boolean;
  showLastLap: boolean;
  showBestLap: boolean;
  showPitStops: boolean;
  showFuelStops: boolean;
  showStatus: boolean;
  paging: PagingMode;
};

/** Either good data, or a pt-BR sentence saying what is wrong with it. */
export type PositionsTowerDataCheck =
  { isValid: true; data: PositionsTowerData } | { isValid: false; problem: string };

/**
 * Reads the settings from the data, applying the manifest's defaults to whatever was
 * left out: compact, every detailed column on except the refuels (the real scoring app
 * may not count them), pages cycling. The one place the defaults live in code.
 */
export function readTowerSettings(data: PositionsTowerData): TowerSettings {
  return {
    layout: data.layout ?? 'compact',
    showGap: data.showGap ?? true,
    showInterval: data.showInterval ?? true,
    showLastLap: data.showLastLap ?? true,
    showBestLap: data.showBestLap ?? true,
    showPitStops: data.showPitStops ?? true,
    showFuelStops: data.showFuelStops ?? false,
    showStatus: data.showStatus ?? true,
    paging: data.paging ?? 'cycle',
  };
}

/**
 * Whether two settings differ in the layout or in any column switch (paging is not a
 * column): when they do, the tower rebuilds its rows' cells on air.
 */
export function haveColumnsChanged(before: TowerSettings, after: TowerSettings): boolean {
  return (
    before.layout !== after.layout ||
    before.showGap !== after.showGap ||
    before.showInterval !== after.showInterval ||
    before.showLastLap !== after.showLastLap ||
    before.showBestLap !== after.showBestLap ||
    before.showPitStops !== after.showPitStops ||
    before.showFuelStops !== after.showFuelStops ||
    before.showStatus !== after.showStatus
  );
}

/** Checks the complete data `load` receives. Never throws; bad data gives a pt-BR problem. */
export function parseCompletePositionsTowerData(input: unknown): PositionsTowerDataCheck {
  const parsed = positionsTowerDataSchema.safeParse(input);
  if (parsed.success) {
    return { isValid: true, data: parsed.data };
  }
  return { isValid: false, problem: describeFirstProblemInPortuguese(input, parsed.error) };
}

/**
 * Merges the partial data `updateAction` receives into the current data. The current
 * data is never modified: a refused update leaves nothing half-applied.
 */
export function mergePartialUpdateIntoPositionsTowerData(
  currentData: PositionsTowerData,
  partialInput: unknown,
): PositionsTowerDataCheck {
  const parsedUpdate = partialPositionsTowerDataSchema.safeParse(partialInput);
  if (!parsedUpdate.success) {
    return {
      isValid: false,
      problem: describeFirstProblemInPortuguese(partialInput, parsedUpdate.error),
    };
  }
  const mergedData = { ...currentData, ...parsedUpdate.data };
  return parseCompletePositionsTowerData(mergedData);
}

/** Writes a Zod path the way an operator reads it: `entries[3].teamName`. */
function writePathAsFieldName(path: PropertyKey[]): string {
  let fieldName = '';
  for (const step of path) {
    if (typeof step === 'number') {
      fieldName += `[${step}]`;
    } else {
      fieldName += fieldName === '' ? String(step) : `.${String(step)}`;
    }
  }
  return fieldName;
}

/** Walks the input along a Zod path; undefined when any step is not there. */
function readValueAtPath(input: unknown, path: PropertyKey[]): unknown {
  let value = input;
  for (const step of path) {
    if (typeof value !== 'object' || value === null) {
      return undefined;
    }
    value = (value as Record<PropertyKey, unknown>)[step];
  }
  return value;
}

/**
 * Turns the first Zod issue into one pt-BR sentence naming the field, with the entry's
 * index when the problem is inside the list. Only the first is reported: one clear
 * message is more useful to an operator than a list.
 */
function describeFirstProblemInPortuguese(input: unknown, error: z.ZodError): string {
  const isAnObject = typeof input === 'object' && input !== null && !Array.isArray(input);
  if (!isAnObject) {
    return ptBR.validationProblems.notAnObject;
  }

  const firstIssue = error.issues[0];
  if (firstIssue === undefined) {
    return ptBR.validationProblems.notAnObject;
  }

  if (firstIssue.code === 'unrecognized_keys') {
    const firstUnknownField = firstIssue.keys[0] ?? '';
    return ptBR.validationProblems.unknownField(firstUnknownField);
  }

  const fieldName = writePathAsFieldName(firstIssue.path);
  const fieldValue = readValueAtPath(input, firstIssue.path);
  if (fieldValue === undefined) {
    return ptBR.validationProblems.missingField(fieldName);
  }
  return ptBR.validationProblems.invalidField(fieldName);
}
