/**
 * A quick-fire button's state for the D200: GET /api/v1/state/shortcut/:panelId/:buttonNumber
 * (apps/server)
 *
 * What this module is for:
 *   A D200 button that fires `fire-shortcut/<panel>/<n>` polls this route with the same
 *   panel and number, so it lights while the item it fires is on air (BAJAOVRLAY-56). The
 *   buttons are counted exactly as fire-shortcut counts them: from 1, in the panel's order.
 *   The answer is flat, `{ isOnAir, isInPreview }`, for the plugin's one-word JSON path.
 *
 * What these tests prove (on a real store, through the app, open to the studio network;
 * "Atalhos" holds 1 the corner clock, 2 the podium, 3 the green flag, 1 and 3 on one layer):
 *   - Button 1 is on air while the corner clock is on air, and in preview while it waits in
 *     Prévia.
 *   - Button 1 stays dark while another button of the panel is on air, even on its own layer.
 *   - Button 1 stays on air while its layer is marked "vai limpar", until the take.
 *   - A panel, a number past the last button, or a number that is not a number answers 404
 *     in the shared error shape, with the reason fire-shortcut gives.
 *
 * What these tests deliberately do not cover:
 *   - How fire-shortcut counts the buttons; commandShortcutRoutes.test.ts. Both routes call
 *     the one finder in quickFireButtonByPlace.ts.
 *   - Access and the quiet request log; buttonStateRoutesAccess.test.ts.
 */
import { describe, expect, it } from 'vitest';

import type { StateStore } from '../../core/store/createStateStore.js';
import {
  askTheStateAsTheD200,
  createOpenAppWithTheRaceDay,
  type RaceDayWithTheGreenFlagButton,
} from './buttonStateOnTheApp.testSupport.js';
import { applyOrThrow } from './commandApiOnTheApp.testSupport.js';

/** One situation on the race day, and what button 1 of "Atalhos" must read there. */
type ShortcutStateScenario = {
  name: string;
  /** What the operator did on the control page before the poll. */
  prepareTheStore: (stateStore: StateStore, raceDay: RaceDayWithTheGreenFlagButton) => void;
  expectedAnswer: { isOnAir: boolean; isInPreview: boolean };
};

const shortcutStateScenarios: ShortcutStateScenario[] = [
  // Nothing taken yet: the button shows its dark image.
  {
    name: 'button 1 is dark with nothing on air',
    prepareTheStore: () => {},
    expectedAnswer: { isOnAir: false, isInPreview: false },
  },
  // Gate 2's very case: the button lights while the item it fires is on air.
  {
    name: 'button 1 is on air while the corner clock is on air',
    prepareTheStore: (stateStore, raceDay) =>
      applyOrThrow(stateStore, { type: 'takeItem', itemId: raceDay.cornerClockItemId }),
    expectedAnswer: { isOnAir: true, isInPreview: false },
  },
  // The same item waiting in Prévia: the second look, not the lit one.
  {
    name: 'button 1 is in preview while the corner clock waits in Prévia',
    prepareTheStore: (stateStore, raceDay) =>
      applyOrThrow(stateStore, { type: 'previewItem', itemId: raceDay.cornerClockItemId }),
    expectedAnswer: { isOnAir: false, isInPreview: true },
  },
  // Another button of the panel on another layer: this button's item is not on air.
  {
    name: 'button 1 is dark while the podium (button 2) is on air',
    prepareTheStore: (stateStore, raceDay) =>
      applyOrThrow(stateStore, { type: 'takeItem', itemId: raceDay.podiumItemId }),
    expectedAnswer: { isOnAir: false, isInPreview: false },
  },
  // Another button on the very same layer: the layer is on air, but with another item, so
  // a button that read the layer instead of the item would light by mistake.
  {
    name: 'button 1 is dark while the green flag (button 3) is on air on its layer',
    prepareTheStore: (stateStore, raceDay) =>
      applyOrThrow(stateStore, { type: 'takeItem', itemId: raceDay.greenFlagCornerItemId }),
    expectedAnswer: { isOnAir: false, isInPreview: false },
  },
  // "Prévia: limpar" does not touch program until the take, so the clock is still on air.
  {
    name: 'button 1 stays on air while its layer is marked "vai limpar"',
    prepareTheStore: (stateStore, raceDay) => {
      applyOrThrow(stateStore, { type: 'takeItem', itemId: raceDay.cornerClockItemId });
      applyOrThrow(stateStore, { type: 'previewClearLayer', layerId: 'bug' });
    },
    expectedAnswer: { isOnAir: true, isInPreview: false },
  },
];

describe('GET /api/v1/state/shortcut/:panelId/:buttonNumber', () => {
  it.each(shortcutStateScenarios)('$name', async ({ prepareTheStore, expectedAnswer }) => {
    // Arrange: the race day open to the studio network, and the row's situation on it.
    const { app, stateStore, raceDay } = createOpenAppWithTheRaceDay();
    prepareTheStore(stateStore, raceDay);

    // Act: the D200 polls the state of button 1 of "Atalhos".
    const { httpStatus, answer } = await askTheStateAsTheD200(
      app,
      '/api/v1/state/shortcut/atalhos/1',
    );

    // Assert: 200, and exactly the two values of the row, as JSON booleans.
    expect(httpStatus, 'a button that exists answers 200').toBe(200);
    expect(answer, 'button 1 must read as the row says').toStrictEqual(expectedAnswer);
  });
});

/** A button the D200 may be set up with that names nothing, and the 404 it must get. */
type UnknownShortcutScenario = {
  name: string;
  path: string;
  expectedError: { code: string; message: string };
};

const unknownShortcutScenarios: UnknownShortcutScenario[] = [
  // A panel id mistyped in Ulanzi Studio.
  {
    name: 'a panel that does not exist',
    path: '/api/v1/state/shortcut/painel-da-largada/1',
    expectedError: {
      code: 'QUICK_FIRE_PANEL_NOT_FOUND',
      message: 'O painel de atalhos "painel-da-largada" não existe.',
    },
  },
  // A button deleted from the panel after the D200 was set up.
  {
    name: 'a number past the last button',
    path: '/api/v1/state/shortcut/atalhos/4',
    expectedError: {
      code: 'QUICK_FIRE_BUTTON_NOT_FOUND',
      message: 'O painel "Atalhos" não tem o botão "4"; seus botões vão de 1 a 3.',
    },
  },
  // Counting starts at 1, as the digit keys and fire-shortcut count.
  {
    name: 'button 0',
    path: '/api/v1/state/shortcut/atalhos/0',
    expectedError: {
      code: 'QUICK_FIRE_BUTTON_NOT_FOUND',
      message: 'O painel "Atalhos" não tem o botão "0"; seus botões vão de 1 a 3.',
    },
  },
];

describe('GET /api/v1/state/shortcut/:panelId/:buttonNumber for a button that does not exist', () => {
  it.each(unknownShortcutScenarios)('answers 404 for $name', async ({ path, expectedError }) => {
    // Arrange: the race day, "Atalhos" with three buttons.
    const { app } = createOpenAppWithTheRaceDay();

    // Act: the D200 polls the row's address.
    const { httpStatus, answer } = await askTheStateAsTheD200(app, path);

    // Assert: 404, so the plugin shows its "unmatched" image, with fire-shortcut's reason.
    expect(httpStatus, 'a button that names nothing answers 404').toBe(404);
    expect(answer, 'the shared error shape, with the pt-BR reason').toEqual({
      error: expectedError,
    });
  });
});
