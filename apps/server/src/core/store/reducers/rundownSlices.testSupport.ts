// Test support: the slices of a race day with rundowns and prepared items, for the tests
// of the seven rundown commands. Every function builds fresh objects on each call, so
// no test can change what another one sees.
import type { Instance, Item, ItemFields, Rundown } from '@bajaovrlay/shared';

import { seededLayers } from '../seedLayers.js';
import type { ReducerContext, SlicesChangedByCommands } from './reducerTypes.js';

/** The rundown of the enduro, the one the server seeds as "Sessão principal". */
export const mainSessionRundownId = 'sessao-principal';

/** A second rundown, for the podium ceremony, to prove rundowns do not mix. */
export const podiumRundownId = 'cerimonia-do-podio';

/** The ids and time the store would hand a reducer at 14:32:05 UTC on 9 October 2026. */
export const contextOfTheRundownCommand: ReducerContext = {
  newInstanceId: '0b6c8f2e-3d1a-4c55-8e2f-9a7b6c5d4e3f',
  newItemId: '5e8a2c1d-9f3b-4a7e-b6d4-2c1f0e9a8b7c',
  now: '2026-10-09T14:32:05.000Z',
};

/**
 * Builds complete race clock data for the given flag: the enduro, 1:05:00 in and
 * running. All six fields the real race clock requires are there, so a take built from
 * it is one the graphic accepts.
 */
export function buildEnduroClockData(flagState: string): Record<string, unknown> {
  return {
    sessionName: 'Enduro de Resistência',
    state: flagState,
    clockMode: 'elapsed',
    referenceTimeMs: 3_900_000,
    referenceWallClockMs: 1_791_550_800_000,
    running: true,
  };
}

/** Builds the same race clock data as item fields: every value typed in by the operator. */
export function buildEnduroClockFields(flagState: string): ItemFields {
  return {
    sessionName: { kind: 'literal', value: 'Enduro de Resistência' },
    state: { kind: 'literal', value: flagState },
    clockMode: { kind: 'literal', value: 'elapsed' },
    referenceTimeMs: { kind: 'literal', value: 3_900_000 },
    referenceWallClockMs: { kind: 'literal', value: 1_791_550_800_000 },
    running: { kind: 'literal', value: true },
  };
}

/** Builds the main session rundown with its cursor on the given item (or on nothing). */
export function buildMainSessionRundown(cursorItemId: string | null): Rundown {
  return {
    id: mainSessionRundownId,
    name: 'Sessão principal',
    sessionLabel: 'Enduro de Resistência',
    cursorItemId,
  };
}

/** Builds the podium ceremony rundown with its cursor on the given item (or on nothing). */
export function buildPodiumRundown(cursorItemId: string | null): Rundown {
  return {
    id: podiumRundownId,
    name: 'Cerimônia do pódio',
    sessionLabel: 'Premiação',
    cursorItemId,
  };
}

/** Builds "Largada do enduro": the race clock under green flag, at the given position. */
export function buildEnduroStartItem(order: number): Item {
  return {
    id: 'item-largada-do-enduro',
    rundownId: mainSessionRundownId,
    order,
    graphicId: 'race-clock',
    layerId: 'clock',
    fields: buildEnduroClockFields('green'),
    label: 'Largada do enduro',
    color: 'success',
    notes: 'Entrar quando o diretor de prova baixar a bandeira.',
  };
}

/** Builds "Bandeira amarela": the race clock under yellow flag, at the given position. */
export function buildYellowFlagItem(order: number): Item {
  return {
    id: 'item-bandeira-amarela',
    rundownId: mainSessionRundownId,
    order,
    graphicId: 'race-clock',
    layerId: 'clock',
    fields: buildEnduroClockFields('yellow'),
    label: 'Bandeira amarela',
    color: 'warning',
    notes: '',
  };
}

/** Builds "Chegada do enduro": the race clock under checkered flag, at the given position. */
export function buildEnduroFinishItem(order: number): Item {
  return {
    id: 'item-chegada-do-enduro',
    rundownId: mainSessionRundownId,
    order,
    graphicId: 'race-clock',
    layerId: 'clock',
    fields: buildEnduroClockFields('checkered'),
    label: 'Chegada do enduro',
    color: 'neutral',
    notes: '',
  };
}

/** Builds "Pódio — Baja UFPR": a lower third for team 42, in the podium rundown. */
export function buildPodiumTeamItem(order: number): Item {
  return {
    id: 'item-podio-baja-ufpr',
    rundownId: podiumRundownId,
    order,
    graphicId: 'team-lower-third',
    layerId: 'lower-third',
    fields: {
      teamNumber: { kind: 'literal', value: 42 },
      teamName: { kind: 'literal', value: 'Baja UFPR' },
    },
    label: 'Pódio — Baja UFPR',
    color: 'highlight',
    notes: '',
  };
}

/** Builds a lower third for team 42 already on the program output, taken by hand. */
export function buildTeam42LowerThirdTakenByHand(): Instance {
  return {
    id: 'c41f0e9a-2b7d-4e3c-8a65-1d2e3f4a5b6c',
    layerId: 'lower-third',
    graphicId: 'team-lower-third',
    target: 'program',
    resolvedData: { teamNumber: 42, teamName: 'Baja UFPR' },
    currentStep: 0,
    status: 'on-air',
    takenAt: '2026-10-09T14:00:00.000Z',
  };
}

/**
 * Reads a rundown as the operator sees it: each item's label with its `order`, sorted by
 * `order`. The numbers stay in the result so a gap or a repeat shows up in the assertion.
 */
export function readLabelsAndOrdersOfRundown(
  items: Item[] | undefined,
  rundownId: string,
): Array<[string, number]> {
  const itemsOfRundown = (items ?? []).filter((item) => item.rundownId === rundownId);
  const itemsByOrder = itemsOfRundown.sort((first, second) => first.order - second.order);
  return itemsByOrder.map((item) => [item.label, item.order]);
}

/**
 * Builds race day slices: the five seeded layers, the race clock and a team lower third
 * as graphics (neither declares a data schema, so any data is accepted), both rundowns
 * unless others are given, and the given items and instances.
 */
export function buildRaceDaySlicesWithRundown(parts: {
  rundowns?: Rundown[];
  items: Item[];
  instances?: Instance[];
}): SlicesChangedByCommands {
  return {
    layers: seededLayers,
    graphics: [
      {
        id: 'race-clock',
        manifest: { id: 'baja-race-clock', name: 'Relógio de prova', main: 'race-clock.js' },
        defaultLayerId: 'clock',
        category: 'clock',
        thumbnailUrl: null,
        defaultFields: {},
      },
      {
        id: 'team-lower-third',
        manifest: { id: 'baja-team-lower-third', name: 'Tarja de equipe', main: 'tarja.js' },
        defaultLayerId: 'lower-third',
        category: 'lower-third',
        thumbnailUrl: null,
        defaultFields: {},
      },
    ],
    instances: parts.instances ?? [],
    rundowns: parts.rundowns ?? [buildMainSessionRundown(null), buildPodiumRundown(null)],
    items: parts.items,
  };
}
