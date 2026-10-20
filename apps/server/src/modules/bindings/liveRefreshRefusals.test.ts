/**
 * A refresh the graphic refuses, logged once (apps/server)
 *
 * What this module is for:
 *   A source's value can break the graphic's schema (a session name longer than the
 *   graphic's box). The refresh is then refused like any update, and the graphic keeps
 *   its last good data. The refusal is written to the event log once per instance, until
 *   a refresh of it succeeds again, not once per poll: the routine-poll reasoning of
 *   PR #16, since a source polled every two seconds would bury the operator's history.
 *
 * What these tests prove:
 *   - Three polls whose session name breaks the placar's maximum length leave the title
 *     on air as it was and write one failed row.
 *   - After a good refresh, the next refusal is logged again: two rows in all.
 *
 * What these tests deliberately do not cover:
 *   - The routine refreshes; liveRefreshThroughTheStore.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { createGraphicsFolderWithBuiltScoreboard } from '../../core/store/builtGraphicsFolder.testSupport.js';
import {
  applyOrThrow,
  buildEnduroSession,
  buildSessionBinding,
  openStoreWithTheRefresher,
  operatorActor,
  pollTheSimulatorWithSession,
  readInstanceOn,
} from './liveRefresh.testSupport.js';

/** A placar whose title has room for 30 letters, on the fullscreen layer. */
const placarManifest = {
  id: 'baja-placar',
  name: 'Placar',
  main: 'placar.js',
  schema: {
    type: 'object',
    properties: { title: { type: 'string', title: 'Título', maxLength: 30 } },
    required: ['title'],
    additionalProperties: false,
  },
  v_baja: { defaultLayerId: 'fullscreen', category: 'scoreboard' },
};

/** A session name of 46 letters, longer than the placar's box. */
const sessionNameTooLong = 'Enduro de Resistência — Etapa Nacional de 2027';

/** Opens the store with the placar, its title bound live to the simulator's session name. */
function putThePlacarOnAir() {
  const store = openStoreWithTheRefresher(createGraphicsFolderWithBuiltScoreboard(placarManifest));
  pollTheSimulatorWithSession(store.stateStore, buildEnduroSession());
  const outcome = store.stateStore.applyCommand(
    {
      type: 'createItem',
      home: { kind: 'rundown', rundownId: 'sessao-principal' },
      graphicId: 'scoreboard',
      layerId: 'fullscreen',
      label: 'Placar — nome da sessão',
      fields: { title: buildSessionBinding('sessionName') },
    },
    operatorActor,
  );
  applyOrThrow(store.stateStore, {
    type: 'takeItem',
    itemId: outcome.ok ? outcome.createdItemId : '',
  });
  return store;
}

/** The failed refreshBoundInstanceData rows of the event log. */
function readRefusedRefreshRows(slices: ReturnType<typeof putThePlacarOnAir>['stateStore']) {
  return slices
    .readAllSlices()
    .eventLog.filter(
      (row) => row.command === 'refreshBoundInstanceData' && row.result.status === 'failed',
    );
}

describe('a refresh the graphic refuses', () => {
  it('keeps the title on air and writes one row over three refused refreshes', () => {
    // Arrange: the placar on air with the session name.
    const { stateStore, refreshTimer } = putThePlacarOnAir();

    // Act: three polls whose name is too long for the placar.
    for (let pollNumber = 1; pollNumber <= 3; pollNumber += 1) {
      pollTheSimulatorWithSession(
        stateStore,
        buildEnduroSession({
          sessionName: sessionNameTooLong,
          lapsCompletedByLeader: 34 + pollNumber,
        }),
      );
      refreshTimer.runThePendingRefresh();
    }

    // Assert: the last good title stays, and the refusal is logged once, as failed.
    expect(
      readInstanceOn(stateStore, 'fullscreen', 'program')?.resolvedData.title,
      'the last good title must stay on air',
    ).toBe('Enduro de Resistência');
    const refusedRows = readRefusedRefreshRows(stateStore);
    expect(refusedRows, 'one row for the first refusal only').toHaveLength(1);
    expect(refusedRows[0]?.actor, 'signed by the refresher').toBe('sistema:vinculos');
  });

  it('logs the next refusal again once a refresh has succeeded', () => {
    // Arrange: the placar on air, its refresh refused once.
    const { stateStore, refreshTimer } = putThePlacarOnAir();
    pollTheSimulatorWithSession(
      stateStore,
      buildEnduroSession({ sessionName: sessionNameTooLong }),
    );
    refreshTimer.runThePendingRefresh();

    // Act: a name that fits, then one too long again.
    pollTheSimulatorWithSession(stateStore, buildEnduroSession({ sessionName: 'Enduro — final' }));
    refreshTimer.runThePendingRefresh();
    pollTheSimulatorWithSession(
      stateStore,
      buildEnduroSession({ sessionName: sessionNameTooLong, lapsCompletedByLeader: 36 }),
    );
    refreshTimer.runThePendingRefresh();

    // Assert: the good name reached the air in between, and each refusal spell has a row.
    expect(readRefusedRefreshRows(stateStore), 'one row per spell of refusals').toHaveLength(2);
    expect(
      readInstanceOn(stateStore, 'fullscreen', 'program')?.resolvedData.title,
      'the name that fitted stays on air',
    ).toBe('Enduro — final');
  });
});
