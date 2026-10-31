/**
 * The feed that colours Companion's buttons: GET /api/v1/layers/status (apps/server)
 *
 * What this module is for:
 *   A pad's button turns red while its graphic is on air and green while it waits in
 *   Prévia (BAJAOVRLAY-28). Companion polls this route every second, so it answers only
 *   what a button needs: for each output and each of its layers, whether something is on
 *   air or in preview and the name of its item; the macro running; and the name of the
 *   token that asked, so a misconfigured device shows up at once.
 *
 * What these tests prove (on a real store):
 *   - With nothing on air, every output is listed with its layers, in order, all off, no macro.
 *   - An item on air and another in preview are named on their layers; the running macro
 *     is named, and marked stopping once "Parar" was pressed.
 *   - An instance whose item was deleted counts as on air, with no item name.
 *   - A layer whose id is `__proto__` is listed like any other, not swallowed as the
 *     object's prototype.
 *
 * What these tests deliberately do not cover:
 *   - The token check; apiTokenAuth.test.ts.
 *   - How fast it answers: it reads the slices in memory and touches no database.
 */
import { describe, expect, it } from 'vitest';

import {
  apiTokensOfTheDesk,
  companionToken,
} from '../../core/apiAccess/fakeApiTokens.testSupport.js';
import {
  applyOrThrow,
  createAppWithTheCommandApi,
  prepareTheRaceDay,
  sendApiRequest,
} from './commandApiOnTheApp.testSupport.js';
import { buildLayersStatus } from './layersStatusRoute.js';

/** One layer of the answer, as the tests read it. */
type LayerStatus = {
  name: string;
  isOnAir: boolean;
  onAirItemName: string | null;
  isInPreview: boolean;
  previewItemName: string | null;
};

/** The answer, as the tests read it. */
type LayersStatus = {
  tokenName: string;
  runningMacro: { macroId: string; label: string; isStopping: boolean } | null;
  outputs: Record<string, { name: string; layers: Record<string, LayerStatus> }>;
};

/** Reads the status as Companion does, with its token. */
async function readTheStatusAsCompanion(app: Parameters<typeof sendApiRequest>[0]) {
  const response = await sendApiRequest(app, {
    method: 'GET',
    path: '/api/v1/layers/status',
    token: companionToken,
  });
  return { response, status: (await response.json()) as LayersStatus };
}

/** Reads one layer of the program output at its path, as a Companion expression does. */
function findProgramLayer(status: LayersStatus, layerId: string): LayerStatus | undefined {
  return status.outputs.program?.layers[layerId];
}

describe('GET /api/v1/layers/status', () => {
  it('lists every layer of the program output as off when nothing is on air', async () => {
    // Arrange: a fresh race day with nothing taken.
    const { app, stateStore } = createAppWithTheCommandApi({
      apiTokensVariable: apiTokensOfTheDesk,
    });
    prepareTheRaceDay(stateStore);

    // Act: read the status.
    const { response, status } = await readTheStatusAsCompanion(app);

    // Assert: 200, Companion named, no macro, and the seven seeded layers, all off.
    expect(response.status, 'the feed answers 200').toBe(200);
    expect(status.tokenName, 'the token that asked').toBe('companion');
    expect(status.runningMacro, 'no macro is running').toBeNull();
    const programLayers = status.outputs.program?.layers ?? {};
    const seededLayerIds = stateStore.readAllSlices().layers.map((layer) => layer.id);
    expect(Object.keys(status.outputs), 'program is the only output').toEqual(['program']);
    expect(Object.keys(programLayers), 'every layer of program is listed, in order').toEqual(
      seededLayerIds,
    );
    expect(
      Object.values(programLayers).every((layer) => !layer.isOnAir && !layer.isInPreview),
      'nothing is on air or in preview',
    ).toBe(true);
  });

  it('names the item on air, the item in preview and the macro running', async () => {
    // Arrange: the enduro clock on air, "Abrir a sessão" stopping, then the corner clock in
    // Prévia (in that order: starting a macro throws every preview away).
    const { app, stateStore } = createAppWithTheCommandApi({
      apiTokensVariable: apiTokensOfTheDesk,
    });
    const raceDay = prepareTheRaceDay(stateStore);
    applyOrThrow(stateStore, { type: 'takeItem', itemId: raceDay.enduroClockItemId });
    applyOrThrow(stateStore, { type: 'runMacro', macroId: raceDay.openTheSessionMacroId });
    applyOrThrow(stateStore, { type: 'stopMacro', macroId: raceDay.openTheSessionMacroId });
    applyOrThrow(stateStore, { type: 'previewItem', itemId: raceDay.cornerClockItemId });

    // Act: read the status.
    const { status } = await readTheStatusAsCompanion(app);

    // Assert: the clock layer on air, the bug layer in preview, the macro stopping.
    expect(findProgramLayer(status, 'clock'), 'the enduro clock is on air').toEqual({
      name: expect.any(String) as unknown,
      isOnAir: true,
      onAirItemName: 'Relógio do enduro',
      isInPreview: false,
      previewItemName: null,
    });
    expect(findProgramLayer(status, 'bug'), 'the corner clock waits in Prévia').toEqual({
      name: expect.any(String) as unknown,
      isOnAir: false,
      onAirItemName: null,
      isInPreview: true,
      previewItemName: 'Relógio no canto',
    });
    expect(status.runningMacro, '"Abrir a sessão" runs and was asked to stop').toEqual({
      macroId: raceDay.openTheSessionMacroId,
      label: 'Abrir a sessão',
      isStopping: true,
    });
  });

  it('counts a graphic whose item was deleted as on air, with no item name', async () => {
    // Arrange: the corner clock on air, then its button deleted from "Atalhos".
    const { app, stateStore } = createAppWithTheCommandApi({
      apiTokensVariable: apiTokensOfTheDesk,
    });
    const raceDay = prepareTheRaceDay(stateStore);
    applyOrThrow(stateStore, { type: 'takeItem', itemId: raceDay.cornerClockItemId });
    applyOrThrow(stateStore, { type: 'deleteItem', itemId: raceDay.cornerClockItemId });

    // Act: read the status.
    const { status } = await readTheStatusAsCompanion(app);

    // Assert: still on air, the name unknown.
    const bugLayer = findProgramLayer(status, 'bug');
    expect([bugLayer?.isOnAir, bugLayer?.onAirItemName], 'on air, with no name').toEqual([
      true,
      null,
    ]);
  });

  it('lists a layer whose id is __proto__ like any other', () => {
    // Arrange: the seeded slices plus a layer named, by accident or not, "__proto__". A
    // plain object would treat that key as its prototype and drop the layer.
    const { stateStore } = createAppWithTheCommandApi({ apiTokensVariable: apiTokensOfTheDesk });
    const seededSlices = stateStore.readAllSlices();
    const slicesWithTheOddLayer = {
      ...seededSlices,
      layers: [
        ...seededSlices.layers,
        {
          id: '__proto__',
          outputId: 'program',
          name: 'Camada de teste',
          zIndex: 990,
          replacePolicy: 'cut' as const,
          persistent: false,
        },
      ],
    };

    // Act: build the status and send it through JSON, as the route does.
    const status = JSON.parse(
      JSON.stringify(buildLayersStatus(slicesWithTheOddLayer, 'companion')),
    ) as LayersStatus;

    // Assert: the layer is there, under its own id, with nothing on it.
    const programLayers = status.outputs.program?.layers ?? {};
    expect(Object.keys(programLayers), 'the odd layer is listed last').toContain('__proto__');
    expect(
      Object.getOwnPropertyDescriptor(programLayers, '__proto__')?.value,
      'its status',
    ).toEqual({
      name: 'Camada de teste',
      isOnAir: false,
      onAirItemName: null,
      isInPreview: false,
      previewItemName: null,
    });
  });
});
