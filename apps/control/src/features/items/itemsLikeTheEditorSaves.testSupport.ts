// Test support: the rundown, graphics, items and on-air instances the item editor tests
// start from, written to read like a real Baja SAE Brasil weekend. Each function builds
// new objects on every call, so no test can change what another test sees.
import raceClockManifest from '@bajaovrlay/race-clock/race-clock.ograf.json';
import type { Instance, Item, Slices } from '@bajaovrlay/shared';

import { buildLowerThirdFixtureGraphic } from '@/state/lowerThirdFixtureGraphic.testSupport';
import {
  buildRaceClockGraphic,
  buildSlicesWithNothingOnAir,
} from '@/state/slicesLikeTheServerSends.testSupport';

/** The id of the rundown the server seeds on its first boot ("Sessão principal"). */
export const idOfTheMainSessionRundown = 'sessao-principal';

/** Friday 18:30 in Brasília, the evening before the race, when the items are prepared. */
export const momentTheItemWasSavedInMilliseconds = Date.parse('2026-10-09T21:30:00.000Z');

// The titles the race clock's manifest gives its three number fields. They are read from
// the manifest, so the tests follow it if the wording changes.
export const raceClockReferenceTimeLabel =
  raceClockManifest.schema.properties.referenceTimeMs.title;
export const raceClockReferenceMomentLabel =
  raceClockManifest.schema.properties.referenceWallClockMs.title;
export const raceClockLapsLabel = raceClockManifest.schema.properties.lapsCompletedByLeader.title;

/**
 * What the server sends after boot when it knows two graphics: the race clock with its
 * real manifest (first, so a new item starts on it) and the interview lower third.
 * Nothing is on air.
 */
export function buildSlicesWithTheRaceClockAndTheLowerThird(): Slices {
  return {
    ...buildSlicesWithNothingOnAir(),
    graphics: [buildRaceClockGraphic(), buildLowerThirdFixtureGraphic()],
  };
}

/**
 * The item prepared on Friday for the start of the four-hour endurance race, as the
 * editor saves it: the race clock on the clock layer, stopped at 240:00 (14 400 000 ms)
 * and counting down, under the pre-start flag, with no laps shown, and its reference
 * moment left to be stamped at the take. It is green in the rundown, has a note for the
 * operator and no auto-out.
 */
export function buildEnduranceStartClockItem(): Item {
  return {
    id: '0b6f2d1e-8c47-4e39-9a15-3d7c5e2f4a90',
    rundownId: idOfTheMainSessionRundown,
    order: 0,
    graphicId: 'race-clock',
    layerId: 'clock',
    fields: {
      sessionName: { kind: 'literal', value: 'Enduro de Resistência' },
      state: { kind: 'literal', value: 'pre' },
      clockMode: { kind: 'literal', value: 'remaining' },
      referenceTimeMs: { kind: 'literal', value: 14_400_000 },
      referenceWallClockMs: { kind: 'takeTime' },
      running: { kind: 'literal', value: false },
    },
    label: 'Largada do Enduro',
    color: 'success',
    notes: 'Entrar quando os carros alinharem.',
  };
}

/** The endurance start item after the leader's seventh lap was typed into it. */
export function buildEnduranceStartClockItemWithSevenLaps(): Item {
  const enduranceStartItem = buildEnduranceStartClockItem();
  return {
    ...enduranceStartItem,
    fields: {
      ...enduranceStartItem.fields,
      lapsCompletedByLeader: { kind: 'literal', value: 7 },
    },
  };
}

/**
 * The same item as an earlier version of the editor saved it (or as a script stores it
 * through the API): its reference moment is a plain number, the moment of the SAVE on
 * Friday evening, instead of "the moment of the take".
 */
export function buildEnduranceStartClockItemSavedWithTheMomentOfTheSave(): Item {
  const enduranceStartItem = buildEnduranceStartClockItem();
  return {
    ...enduranceStartItem,
    fields: {
      ...enduranceStartItem.fields,
      referenceWallClockMs: { kind: 'literal', value: momentTheItemWasSavedInMilliseconds },
    },
  };
}

/**
 * An item of the second graphic: the lower third for the interview with Ana Souza,
 * captain of Baja UFPR (car 42), off air by itself after 8 seconds. It has no interview
 * time and no car weight, the two optional fields left without a value.
 */
export function buildInterviewLowerThirdItem(): Item {
  return {
    id: '5e1a9c73-2b64-4f08-b3d1-7a9e0c6d8f25',
    rundownId: idOfTheMainSessionRundown,
    order: 1,
    graphicId: 'lower-third-fixture',
    layerId: 'lower-third',
    fields: {
      nome: { kind: 'literal', value: 'Ana Souza' },
      cargo: { kind: 'literal', value: 'Capitã' },
      equipe: { kind: 'literal', value: 'baja-ufpr' },
      duracaoMs: { kind: 'literal', value: 8_000 },
      destaque: { kind: 'literal', value: false },
      numeroDoCarro: { kind: 'literal', value: 42 },
    },
    autoOutAfterMs: 8_000,
    label: 'Tarja da equipe 42',
    color: 'info',
    notes: '',
  };
}

/** What makes one instance taken from an item different from another in the tests. */
export type InstanceTakenFromItemDescription = {
  id: string;
  item: Item;
  layerId: string;
  target: 'program' | 'preview';
  takenAt: string;
};

/**
 * An instance on air that the server made by taking an item: it carries the item's id
 * and graphic, and shows the item's literal values. (A field the server stamps at the
 * take is left out here; no test of the editor reads it.)
 */
export function buildInstanceTakenFromItem(
  description: InstanceTakenFromItemDescription,
): Instance {
  const valueOfEachLiteralField: Array<[string, unknown]> = [];
  for (const [fieldKey, storedField] of Object.entries(description.item.fields)) {
    if (storedField.kind === 'literal') {
      valueOfEachLiteralField.push([fieldKey, storedField.value]);
    }
  }
  return {
    id: description.id,
    layerId: description.layerId,
    graphicId: description.item.graphicId,
    target: description.target,
    resolvedData: Object.fromEntries(valueOfEachLiteralField),
    currentStep: 0,
    status: 'on-air',
    takenAt: description.takenAt,
    itemId: description.item.id,
  };
}
