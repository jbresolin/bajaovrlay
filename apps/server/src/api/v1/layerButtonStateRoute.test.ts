/**
 * A layer's state for one D200 button: GET /api/v1/state/layer/:layerId (apps/server)
 *
 * What this module is for:
 *   The Ulanzi D200's HTTP plugin polls a status URL every second, reads one value by a
 *   one-word JSON path and compares it with an expected value to pick the button's image
 *   (BAJAOVRLAY-56). Whether its path can go deeper than one key is unknown, so this route
 *   answers one layer's state with every value at the top level: `isOnAir`, `isInPreview`,
 *   `isMarkedToClear` ("vai limpar" in Prévia) and `itemName`, the item on program.
 *
 * What these tests prove (on a real store, through the app, open to the studio network):
 *   - One row per real situation on the bug layer: empty, the corner clock on air, the same
 *     clock only in Prévia, on air with another item in Prévia, on air and marked "vai
 *     limpar", and on air after its item was deleted.
 *   - The values are JSON booleans, and `itemName` is "" when nothing (or nothing named) is
 *     on air, never null, so the D200 always finds a value at the path.
 *   - A layer that does not exist answers 404 in the shared error shape, with a pt-BR reason.
 *
 * What these tests deliberately do not cover:
 *   - Access (open, tokens, off) and the quiet request log; buttonStateRoutesAccess.test.ts.
 *   - Which instance counts as on air (loading, failed...): the same rule as /layers/status,
 *     whose tests cover it; this route reads the same instances.
 */
import { describe, expect, it } from 'vitest';

import type { StateStore } from '../../core/store/createStateStore.js';
import {
  askTheStateAsTheD200,
  createOpenAppWithTheRaceDay,
  type RaceDayWithTheGreenFlagButton,
} from './buttonStateOnTheApp.testSupport.js';
import { applyOrThrow } from './commandApiOnTheApp.testSupport.js';

/** One situation on the bug layer, and what the D200 must read there. */
type LayerStateScenario = {
  name: string;
  /** What the operator did on the control page before the poll. */
  prepareTheStore: (stateStore: StateStore, raceDay: RaceDayWithTheGreenFlagButton) => void;
  expectedAnswer: {
    isOnAir: boolean;
    isInPreview: boolean;
    isMarkedToClear: boolean;
    itemName: string;
  };
};

const layerStateScenarios: LayerStateScenario[] = [
  // The start of the day: the button shows its dark image, and the name is "" rather
  // than missing, so the plugin still finds a value at its path.
  {
    name: 'an empty layer is off everywhere, with an empty name',
    prepareTheStore: () => {},
    expectedAnswer: { isOnAir: false, isInPreview: false, isMarkedToClear: false, itemName: '' },
  },
  // The case the button exists for: its graphic is on air.
  {
    name: 'the corner clock on air is on air, by its name',
    prepareTheStore: (stateStore, raceDay) =>
      applyOrThrow(stateStore, { type: 'takeItem', itemId: raceDay.cornerClockItemId }),
    expectedAnswer: {
      isOnAir: true,
      isInPreview: false,
      isMarkedToClear: false,
      itemName: 'Relógio no canto',
    },
  },
  // The same item only waiting in Prévia: not on air, and the name stays empty because
  // itemName is what is on program, not what waits.
  {
    name: 'the same clock only in Prévia is in preview, with no name on air',
    prepareTheStore: (stateStore, raceDay) =>
      applyOrThrow(stateStore, { type: 'previewItem', itemId: raceDay.cornerClockItemId }),
    expectedAnswer: { isOnAir: false, isInPreview: true, isMarkedToClear: false, itemName: '' },
  },
  // Both at once on one layer: the name is the one on program, not the one in Prévia.
  {
    name: 'the clock on air with the green flag in Prévia names the clock',
    prepareTheStore: (stateStore, raceDay) => {
      applyOrThrow(stateStore, { type: 'takeItem', itemId: raceDay.cornerClockItemId });
      applyOrThrow(stateStore, { type: 'previewItem', itemId: raceDay.greenFlagCornerItemId });
    },
    expectedAnswer: {
      isOnAir: true,
      isInPreview: true,
      isMarkedToClear: false,
      itemName: 'Relógio no canto',
    },
  },
  // "Prévia: limpar" on the bug row: still on air until the take, and the mark is what a
  // "LIMPAR" button can show as its second look.
  {
    name: 'a layer marked "vai limpar" stays on air and is marked to clear',
    prepareTheStore: (stateStore, raceDay) => {
      applyOrThrow(stateStore, { type: 'takeItem', itemId: raceDay.cornerClockItemId });
      applyOrThrow(stateStore, { type: 'previewClearLayer', layerId: 'bug' });
    },
    expectedAnswer: {
      isOnAir: true,
      isInPreview: false,
      isMarkedToClear: true,
      itemName: 'Relógio no canto',
    },
  },
  // A button deleted from "Atalhos" while its graphic is on air: the graphic is still on
  // the screen, so the layer is on air; its name is no longer known.
  {
    name: 'a graphic whose item was deleted is on air with an empty name',
    prepareTheStore: (stateStore, raceDay) => {
      applyOrThrow(stateStore, { type: 'takeItem', itemId: raceDay.cornerClockItemId });
      applyOrThrow(stateStore, { type: 'deleteItem', itemId: raceDay.cornerClockItemId });
    },
    expectedAnswer: { isOnAir: true, isInPreview: false, isMarkedToClear: false, itemName: '' },
  },
];

describe('GET /api/v1/state/layer/:layerId', () => {
  it.each(layerStateScenarios)('$name', async ({ prepareTheStore, expectedAnswer }) => {
    // Arrange: the race day open to the studio network, and the row's situation on it.
    const { app, stateStore, raceDay } = createOpenAppWithTheRaceDay();
    prepareTheStore(stateStore, raceDay);

    // Act: the D200 polls the bug layer's state.
    const { httpStatus, answer } = await askTheStateAsTheD200(app, '/api/v1/state/layer/bug');

    // Assert: 200, and exactly the four values of the row, booleans as JSON booleans.
    expect(httpStatus, 'a layer that exists answers 200').toBe(200);
    expect(answer, 'the bug layer must read as the row says').toStrictEqual(expectedAnswer);
  });

  it('answers 404 in the error shape for a layer that does not exist', async () => {
    // Arrange: the race day; no layer is called "placar-inexistente".
    const { app } = createOpenAppWithTheRaceDay();

    // Act: a D200 button set up with a mistyped layer id polls it.
    const { httpStatus, answer } = await askTheStateAsTheD200(
      app,
      '/api/v1/state/layer/placar-inexistente',
    );

    // Assert: 404, so the plugin shows its "unmatched" image, and the reason in pt-BR.
    expect(httpStatus, 'an unknown layer answers 404').toBe(404);
    expect(answer, 'the shared error shape, naming the layer').toEqual({
      error: { code: 'LAYER_NOT_FOUND', message: 'A camada "placar-inexistente" não existe.' },
    });
  });
});
