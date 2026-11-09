import {
  entryOfCarPathPrefix,
  findBindablePath,
  firstEntriesWithTheirOwnPaths,
} from '../dataShapes/bindablePaths.js';
import { type CarFieldMeaning, CarFieldMeaningSchema } from './carGroup.js';

/** The highest place a car can be picked at: the places that have paths of their own. */
export const highestPlaceACarCanBePickedAt = firstEntriesWithTheirOwnPaths;

/** The positions path of one field of a car picked by its number ("entryOfCar.teamName"). */
export function buildPathOfCarFieldChosenByNumber(meaning: CarFieldMeaning): string {
  return `${entryOfCarPathPrefix}${meaning}`;
}

/**
 * The positions path of one field of the car running at a place, counted from 1 like the
 * operator counts ("entries.1.laps" for the 2nd place).
 */
export function buildPathOfCarFieldAtPlace(meaning: CarFieldMeaning, placeNumber: number): string {
  return `entries.${placeNumber - 1}.${meaning}`;
}

/** Which car a positions path follows, and which of its fields it reads. */
export type CarPickOfPath =
  | { pickedBy: 'number'; meaning: CarFieldMeaning }
  | { pickedBy: 'place'; placeNumber: number; meaning: CarFieldMeaning };

// "entries.<index>.<field>": one field of the car at a place.
const pathAtPlacePattern = /^entries\.(\d+)\.([A-Za-z]+)$/;

/**
 * Reads a positions path back into the car it follows and the field it reads, or
 * undefined for a path that is no field of one car (the whole list), or not listed.
 */
export function readCarPickOfPositionsPath(path: string): CarPickOfPath | undefined {
  if (findBindablePath('positions', path) === undefined) {
    return undefined;
  }
  if (path.startsWith(entryOfCarPathPrefix)) {
    const meaningReading = CarFieldMeaningSchema.safeParse(path.slice(entryOfCarPathPrefix.length));
    return meaningReading.success
      ? { pickedBy: 'number', meaning: meaningReading.data }
      : undefined;
  }
  const placeMatch = pathAtPlacePattern.exec(path);
  if (placeMatch === null) {
    return undefined;
  }
  const meaningReading = CarFieldMeaningSchema.safeParse(placeMatch[2]);
  if (!meaningReading.success) {
    return undefined;
  }
  const placeNumber = Number(placeMatch[1]) + 1;
  return { pickedBy: 'place', placeNumber, meaning: meaningReading.data };
}
