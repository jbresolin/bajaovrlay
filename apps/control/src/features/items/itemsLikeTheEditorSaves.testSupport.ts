// Test support: the rundown, items and extra graphic the item editor tests start from,
// written to read like a real Baja SAE Brasil weekend. Each function builds new objects
// on every call, so no test can change what another test sees.
import type { Graphic, Item } from '@bajaovrlay/shared';

/** The id of the rundown the server seeds on its first boot ("Sessão principal"). */
export const idOfTheMainSessionRundown = 'sessao-principal';

/** Friday 18:30 in Brasília, the evening before the race, when the items are prepared. */
export const momentTheItemWasSavedInMilliseconds = Date.parse('2026-10-09T21:30:00.000Z');

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
 * A second graphic, which the item editor has no form for yet: the lower third that
 * names a driver, registered on the lower-third layer.
 */
export function buildDriverLowerThirdGraphic(): Graphic {
  return {
    id: 'driver-lower-third',
    manifest: {
      id: 'baja-driver-lower-third',
      name: 'Tarja de piloto',
      main: 'driver-lower-third.js',
    },
    defaultLayerId: 'lower-third',
    category: 'lower-third',
    thumbnailUrl: null,
    defaultFields: {},
  };
}

/**
 * An item of that second graphic, as a script could have created it through the API:
 * the lower third for team 42, off air by itself after 8 seconds.
 */
export function buildDriverLowerThirdItem(): Item {
  return {
    id: '5e1a9c73-2b64-4f08-b3d1-7a9e0c6d8f25',
    rundownId: idOfTheMainSessionRundown,
    order: 1,
    graphicId: 'driver-lower-third',
    layerId: 'lower-third',
    fields: {
      teamNumber: { kind: 'literal', value: 42 },
      teamName: { kind: 'literal', value: 'Baja UFPR' },
    },
    autoOutAfterMs: 8_000,
    label: 'Tarja da equipe 42',
    color: 'info',
    notes: '',
  };
}
