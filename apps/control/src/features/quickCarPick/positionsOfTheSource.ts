/**
 * The positions "Escolher carros" (BAJAOVRLAY-82) reads its suggestions and its read-out
 * from: the source's last good positions, with the operator's corrections laid over them,
 * read through the same shared resolver as a take (so a corrected team name shows here as
 * it will on air), and which source the cars are picked on when the item has none yet.
 */
import {
  type BindingFieldValue,
  type PositionEntry,
  PositionEntrySchema,
  resolveBindingAgainstSources,
  type Slices,
} from '@bajaovrlay/shared';
import { z } from 'zod';

/** The slices the positions are read from. */
export type SlicesForPositions = Pick<
  Slices,
  'dataSources' | 'dataSnapshots' | 'overrides' | 'bracketMatchFocuses' | 'teams'
>;

const listOfCarsSchema = z.array(PositionEntrySchema);

/**
 * The cars a source lists now, in their order, corrections included; undefined when it has
 * sent no positions (or the source is unknown). Read like a field bound to the whole list,
 * so nothing here knows how snapshots or corrections are stored.
 */
export function readPositionsOfSourceNow(
  sourceId: string,
  slices: SlicesForPositions,
): PositionEntry[] | undefined {
  const wholeListBinding: BindingFieldValue = {
    kind: 'binding',
    sourceId,
    shapeKey: 'positions',
    path: 'entries',
    isLive: true,
  };
  const resolution = resolveBindingAgainstSources(wholeListBinding, slices, {
    teams: slices.teams,
  });
  if (resolution.status !== 'resolved') {
    return undefined;
  }
  const listReading = listOfCarsSchema.safeParse(resolution.value);
  return listReading.success ? listReading.data : undefined;
}

/**
 * Which source a pick is made on, or why none can be told: no source sends positions, or
 * several do and the item reads none of them (the box then says which, in pt-BR).
 */
export type SourceChoiceOfQuickCarPick =
  | { status: 'source'; sourceId: string }
  | { status: 'noSourceWithPositions' }
  | { status: 'severalSourcesWithPositions' };

/**
 * The source a pick is made on: the one the item's cars already read, or else the only
 * source that sends positions now, or else the only source there is. With two sources
 * sending positions and an item that reads neither, a guess would be wrong half the time:
 * the operator chooses then in the item editor, where the source is a choice of its own.
 */
export function chooseSourceForQuickCarPick(
  sourceIdOfTheItem: string | undefined,
  slices: SlicesForPositions,
): SourceChoiceOfQuickCarPick {
  if (sourceIdOfTheItem !== undefined) {
    return { status: 'source', sourceId: sourceIdOfTheItem };
  }
  const sourcesWithPositions = slices.dataSources.filter(
    (dataSource) => readPositionsOfSourceNow(dataSource.id, slices) !== undefined,
  );
  if (sourcesWithPositions.length > 1) {
    return { status: 'severalSourcesWithPositions' };
  }
  const onlySourceWithPositions = sourcesWithPositions[0];
  if (onlySourceWithPositions !== undefined) {
    return { status: 'source', sourceId: onlySourceWithPositions.id };
  }
  const onlySource = slices.dataSources.length === 1 ? slices.dataSources[0] : undefined;
  return onlySource === undefined
    ? { status: 'noSourceWithPositions' }
    : { status: 'source', sourceId: onlySource.id };
}

/** The car of this number in the list, or undefined when the source does not list it. */
export function findCarByNumber(
  positions: PositionEntry[],
  carNumber: number,
): PositionEntry | undefined {
  return positions.find((entry) => entry.carNumber === carNumber);
}

/**
 * The car at a place, counted from 1, read by its index in the list exactly as a binding
 * by place reads it (`entries.<place − 1>`), so the read-out names the car a take shows.
 */
export function findCarAtPlace(
  positions: PositionEntry[],
  placeNumber: number,
): PositionEntry | undefined {
  return positions[placeNumber - 1];
}
