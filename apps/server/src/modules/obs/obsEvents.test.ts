/**
 * OBS's events fill the obs slice (apps/server, modules/obs)
 *
 * What this module is for:
 *   Once connected, the server never polls OBS: OBS sends an event when someone works it
 *   by hand (a scene clicked, renamed or added, Studio Mode turned on or off) and the
 *   server reads OBS's scenes anew and writes the whole status to the `obs` slice, so the
 *   tally on the control page follows OBS within moments.
 *
 * What these tests prove:
 *   - A scene switched by hand in OBS becomes the slice's Program scene.
 *   - A scene renamed in OBS is renamed in the list, in its place, and on Program.
 *   - A scene added in OBS joins the list where OBS shows it (at the top).
 *   - Studio Mode on names the Preview scene; a scene lined up on Preview by hand follows;
 *     Studio Mode off forgets Preview again.
 *   - None of these leaves an event-log row.
 *
 * What these tests deliberately do not cover:
 *   - The connection itself (obsConnection.test.ts) and the server's own scene switch
 *     (switchObsScene.test.ts).
 */
import { describe, expect, it } from 'vitest';

import { startStoreConnectedToFakeObs, waitForTheObsSlice } from './obsOnTheStore.testSupport.js';

describe('OBS worked by hand', () => {
  it('follows a scene switched by hand onto Program', async () => {
    // Arrange: connected, with "Intervalo" on Program.
    const { store, fakeObs } = await startStoreConnectedToFakeObs();

    // Act: the director clicks "Pista" in OBS.
    fakeObs.switchProgramSceneByHand('Pista');
    const obs = await waitForTheObsSlice(store, (slice) => slice.programSceneName === 'Pista');

    // Assert: the tally's Program is "Pista", and the list did not move.
    expect(obs.programSceneName, 'Program must be the scene clicked in OBS').toBe('Pista');
    expect(obs.sceneNames, 'a switch does not change the list').toEqual([
      'Pista',
      'Box',
      'Pódio',
      'Intervalo',
    ]);
  });

  it('renames a scene renamed in OBS, in its place and on Program', async () => {
    // Arrange: connected, with "Intervalo" on Program.
    const { store, fakeObs } = await startStoreConnectedToFakeObs();

    // Act: someone renames "Intervalo" to "Intervalo do almoço" in OBS.
    fakeObs.renameSceneByHand('Intervalo', 'Intervalo do almoço');
    const obs = await waitForTheObsSlice(store, (slice) =>
      slice.sceneNames.includes('Intervalo do almoço'),
    );

    // Assert: the new name sits where the old one was, and Program carries it too.
    expect(obs.sceneNames, 'the renamed scene keeps its place').toEqual([
      'Pista',
      'Box',
      'Pódio',
      'Intervalo do almoço',
    ]);
    expect(obs.programSceneName, 'Program must carry the new name').toBe('Intervalo do almoço');
  });

  it('adds a scene added in OBS, at the top where OBS puts it', async () => {
    // Arrange: connected.
    const { store, fakeObs } = await startStoreConnectedToFakeObs();

    // Act: someone adds the scene "Largada" in OBS.
    fakeObs.addSceneByHand('Largada');
    const obs = await waitForTheObsSlice(store, (slice) => slice.sceneNames.includes('Largada'));

    // Assert: the macro editor can offer it, in OBS's order.
    expect(obs.sceneNames, 'the new scene must be offered in OBS’s order').toEqual([
      'Largada',
      'Pista',
      'Box',
      'Pódio',
      'Intervalo',
    ]);
  });

  it('names Preview while Studio Mode is on, follows it, and forgets it when it goes off', async () => {
    // Arrange: connected, Studio Mode off.
    const { store, fakeObs } = await startStoreConnectedToFakeObs();

    // Act: Studio Mode goes on (Preview starts on the Program scene), the director lines
    // up "Pódio" on Preview, then turns Studio Mode off.
    fakeObs.setStudioModeByHand(true);
    const withStudioModeOn = await waitForTheObsSlice(store, (slice) => slice.isStudioModeOn);
    fakeObs.switchPreviewSceneByHand('Pódio');
    const withPodiumLinedUp = await waitForTheObsSlice(
      store,
      (slice) => slice.previewSceneName === 'Pódio',
    );
    fakeObs.setStudioModeByHand(false);
    const withStudioModeOff = await waitForTheObsSlice(store, (slice) => !slice.isStudioModeOn);

    // Assert: Preview is named only while Studio Mode is on.
    expect(withStudioModeOn.previewSceneName, 'Studio Mode starts on the Program scene').toBe(
      'Intervalo',
    );
    expect(withPodiumLinedUp.previewSceneName, 'Preview must follow OBS').toBe('Pódio');
    expect(withStudioModeOff.previewSceneName, 'without Studio Mode there is no Preview').toBe(
      null,
    );
  });

  it('writes no event-log row for anything OBS did by itself', async () => {
    // Arrange: connected.
    const { store, fakeObs } = await startStoreConnectedToFakeObs();
    const eventLogBefore = store.readAllSlices().eventLog;

    // Act: a switch and a rename by hand.
    fakeObs.switchProgramSceneByHand('Box');
    fakeObs.renameSceneByHand('Box', 'Box de reparos');
    await waitForTheObsSlice(store, (slice) => slice.programSceneName === 'Box de reparos');

    // Assert: the event log is the very same list.
    expect(store.readAllSlices().eventLog, 'OBS’s own changes stay out of the log').toBe(
      eventLogBefore,
    );
  });
});
