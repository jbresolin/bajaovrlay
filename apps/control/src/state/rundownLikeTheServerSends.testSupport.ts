// Test support: a rundown with items in it, as the server sends it once an operator has
// prepared a session. Like slicesLikeTheServerSends.testSupport.ts, every function builds
// new objects on every call, so no test can change what another test sees.
import type { Item, ItemColor, Rundown, Slices } from '@bajaovrlay/shared';

import {
  buildRaceClockInstanceOnTheClockLayer,
  buildSlicesWithNothingOnAir,
} from './slicesLikeTheServerSends.testSupport';

/** The id the tests give the seeded rundown. The page must read it, never assume it. */
export const mainRundownId = 'sessao-principal';

/** The ids of the three items of the endurance race, in the order they are fired. */
export const enduranceStartItemId = 'item-largada-do-enduro';
export const yellowFlagItemId = 'item-bandeira-amarela';
export const enduranceFinishItemId = 'item-chegada-do-enduro';

/** The rundown the server seeds on first boot, with its cursor on `cursorItemId`. */
export function buildMainRundown(cursorItemId: string | null): Rundown {
  return { id: mainRundownId, name: 'Sessão principal', sessionLabel: '', cursorItemId };
}

/** What makes one race clock item different from another in these tests. */
export type RaceClockItemDescription = {
  id: string;
  order: number;
  label: string;
  color: ItemColor;
  /** The flag the clock shows when this item goes on air, for example 'green'. */
  flagState: string;
};

/** One prepared use of the race clock on the clock layer, in the main rundown. */
export function buildRaceClockItem(description: RaceClockItemDescription): Item {
  return {
    id: description.id,
    home: { kind: 'rundown', rundownId: mainRundownId },
    order: description.order,
    graphicId: 'race-clock',
    layerId: 'clock',
    fields: {
      sessionName: { kind: 'literal', value: 'Enduro de Resistência' },
      state: { kind: 'literal', value: description.flagState },
      clockMode: { kind: 'literal', value: 'elapsed' },
      referenceTimeMs: { kind: 'literal', value: 0 },
      running: { kind: 'literal', value: true },
    },
    label: description.label,
    color: description.color,
    notes: '',
  };
}

/** The start, a yellow flag and the finish of the endurance race, in that order. */
export function buildThreeItemsOfTheEnduranceRace(): Item[] {
  return [
    buildRaceClockItem({
      id: enduranceStartItemId,
      order: 0,
      label: 'Largada do enduro',
      color: 'success',
      flagState: 'green',
    }),
    buildRaceClockItem({
      id: yellowFlagItemId,
      order: 1,
      label: 'Bandeira amarela',
      color: 'warning',
      flagState: 'yellow',
    }),
    buildRaceClockItem({
      id: enduranceFinishItemId,
      order: 2,
      label: 'Chegada do enduro',
      color: 'highlight',
      flagState: 'checkered',
    }),
  ];
}

/**
 * The same three items after the start was moved one place down: yellow flag, start,
 * finish. What the server sends in its items slice once it accepts that reorder.
 */
export function buildEnduranceItemsWithTheStartMovedBelowTheYellowFlag(): Item[] {
  return [
    buildRaceClockItem({
      id: yellowFlagItemId,
      order: 0,
      label: 'Bandeira amarela',
      color: 'warning',
      flagState: 'yellow',
    }),
    buildRaceClockItem({
      id: enduranceStartItemId,
      order: 1,
      label: 'Largada do enduro',
      color: 'success',
      flagState: 'green',
    }),
    buildRaceClockItem({
      id: enduranceFinishItemId,
      order: 2,
      label: 'Chegada do enduro',
      color: 'highlight',
      flagState: 'checkered',
    }),
  ];
}

/**
 * Nothing on air, and the main rundown holding the three endurance items with its cursor
 * on `cursorItemId` (null for "no next item").
 */
export function buildSlicesWithTheEnduranceRundown(cursorItemId: string | null): Slices {
  return {
    ...buildSlicesWithNothingOnAir(),
    rundowns: [buildMainRundown(cursorItemId)],
    items: buildThreeItemsOfTheEnduranceRace(),
  };
}

/**
 * The state right after the operator fired "Largada do enduro": the clock is on air
 * since `takenAt`, stamped with that item's id, and the cursor moved on to the yellow flag.
 */
export function buildSlicesWithTheEnduranceStartOnAir(takenAt: string): Slices {
  return {
    ...buildSlicesWithTheEnduranceRundown(yellowFlagItemId),
    instances: [
      { ...buildRaceClockInstanceOnTheClockLayer(takenAt), itemId: enduranceStartItemId },
    ],
  };
}
