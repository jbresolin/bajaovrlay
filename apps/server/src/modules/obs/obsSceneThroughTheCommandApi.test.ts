/**
 * switchObsScene through the command API (apps/server, modules/obs with api/v1)
 *
 * What this module is for:
 *   switchObsScene is an operator's command, so a pad (Companion, a Stream Deck) can send
 *   it through POST /api/v1/commands like any other. A pad's scene button does best with
 *   a fixed URL and no body, so POST /api/v1/obs-scene/{sceneName} sends it for Program,
 *   the scene name URL-encoded. Both go through the store's one path, signed `api:<name>`.
 *
 * What these tests prove (a real app on a store connected to a fake OBS):
 *   - POST /commands with switchObsScene switches OBS, answers 200 and logs the row as
 *     `api:companion`.
 *   - POST /obs-scene/P%C3%B3dio switches OBS to "Pódio" on Program: the name is decoded.
 *   - The shortcut's refusals carry the store's code and pt-BR message: a scene OBS does
 *     not have is 422, OBS not connected is 409.
 *
 * What these tests deliberately do not cover:
 *   - The token check (apiTokenAuth.test.ts) and the other shortcuts
 *     (commandShortcutRoutes.test.ts).
 *   - Each refusal of the reducer (switchObsScene.test.ts).
 */
import { describe, expect, it } from 'vitest';

import { parseApiTokens } from '../../core/apiAccess/apiTokens.js';
import {
  apiTokensOfTheDesk,
  companionToken,
} from '../../core/apiAccess/fakeApiTokens.testSupport.js';
import { createServerApp } from '../../core/http/createServerApp.js';
import { createLogger } from '../../core/logger/createLogger.js';
import { operatorLoginOff } from '../../core/operatorLogin/operatorLoginOff.testSupport.js';
import type { StateStore } from '../../core/store/createStateStore.js';
import { startStoreConnectedToFakeObs, waitForTheObsSlice } from './obsOnTheStore.testSupport.js';

/** The app as production builds it, on the given store, with Companion's token. */
function createAppOnTheStore(stateStore: StateStore) {
  const parsing = parseApiTokens(apiTokensOfTheDesk);
  if (!parsing.isValid) {
    throw new Error(`The test's BAJAOVRLAY_API_TOKENS is refused: ${parsing.problem}`);
  }
  return createServerApp({
    operatorLogin: operatorLoginOff,
    logger: createLogger({ level: 'silent' }),
    version: '0.3.1',
    stateStore,
    apiTokens: parsing.apiTokens,
    isApiOpenToTheNetwork: false,
  });
}

/** Sends a POST as Companion does: its token, and a JSON body when there is one. */
function postAsCompanion(
  app: ReturnType<typeof createAppOnTheStore>,
  path: string,
  body?: unknown,
) {
  const headers: Record<string, string> = { Authorization: `Bearer ${companionToken}` };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  return app.request(`http://localhost${path}`, {
    method: 'POST',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe('switchObsScene over HTTP', () => {
  it('POST /commands switches OBS, answers 200 and logs the row as the device', async () => {
    // Arrange: connected to OBS, and the app on the same store.
    const { store, fakeObs } = await startStoreConnectedToFakeObs();
    const app = createAppOnTheStore(store);

    // Act: Companion sends the command in the envelope.
    const response = await postAsCompanion(app, '/api/v1/commands', {
      type: 'command',
      command: { type: 'switchObsScene', sceneName: 'Box' },
    });
    const body: unknown = await response.json();

    // Assert: 200, done in OBS, signed by the device.
    expect(body, 'an accepted switch answers ok').toEqual({
      type: 'commandResult',
      requestId: null,
      ok: true,
    });
    expect(response.status, 'an accepted switch answers 200').toBe(200);
    await waitForTheObsSlice(store, (slice) => slice.sceneSwitch?.status === 'feita');
    expect(fakeObs.readRequestsReceived().at(-1), 'OBS must be asked for "Box"').toEqual({
      requestType: 'SetCurrentProgramScene',
      requestData: { sceneName: 'Box' },
    });
    const logRow = store.readAllSlices().eventLog.find((row) => row.command === 'switchObsScene');
    expect(logRow?.actor, 'the row names the device').toBe('api:companion');
  });

  it('POST /obs-scene/{sceneName} decodes the name and switches Program', async () => {
    // Arrange: connected to OBS, and the app on the same store.
    const { store, fakeObs } = await startStoreConnectedToFakeObs();
    const app = createAppOnTheStore(store);

    // Act: the pad's "Pódio" button, its scene name URL-encoded as a pad sends it.
    const response = await postAsCompanion(app, '/api/v1/obs-scene/P%C3%B3dio');
    await waitForTheObsSlice(store, (slice) => slice.sceneSwitch?.status === 'feita');

    // Assert: 200, and OBS asked for "Pódio" with its accent.
    expect(response.status, 'an accepted switch answers 200').toBe(200);
    expect(fakeObs.readRequestsReceived().at(-1), 'OBS must be asked for "Pódio"').toEqual({
      requestType: 'SetCurrentProgramScene',
      requestData: { sceneName: 'Pódio' },
    });
  });

  it('answers a scene OBS does not have with 422 and the pt-BR reason', async () => {
    // Arrange: connected to OBS, and the app on the same store.
    const { store } = await startStoreConnectedToFakeObs();
    const app = createAppOnTheStore(store);

    // Act: a button left over from last year's scene collection.
    const response = await postAsCompanion(app, '/api/v1/obs-scene/Chegada%202025');
    const body = (await response.json()) as { error?: unknown };

    // Assert: 422 (pressing again will not help until the button or OBS is changed).
    expect(response.status, 'a scene OBS does not have is 422').toBe(422);
    expect(body.error, 'the reason in pt-BR').toEqual({
      code: 'OBS_SCENE_NOT_FOUND',
      message: 'O OBS não tem a cena "Chegada 2025". Confira o nome no OBS.',
    });
  });

  it('answers OBS not connected with 409', async () => {
    // Arrange: connected to OBS, then OBS quits.
    const { store, fakeObs } = await startStoreConnectedToFakeObs();
    const app = createAppOnTheStore(store);
    fakeObs.close();
    await waitForTheObsSlice(store, (slice) => slice.connectionState === 'erro');

    // Act: the pad's "Pista" button.
    const response = await postAsCompanion(app, '/api/v1/obs-scene/Pista');
    const body = (await response.json()) as { error?: { code?: string } };

    // Assert: 409 (pressing again once OBS is back will work).
    expect(response.status, 'OBS not connected is 409').toBe(409);
    expect(body.error?.code, 'the code says OBS is not connected').toBe('OBS_NOT_CONNECTED');
  });
});
