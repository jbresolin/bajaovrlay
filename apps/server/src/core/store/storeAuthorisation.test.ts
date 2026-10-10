/**
 * Who may send which command, through the whole store (apps/server)
 *
 * What this module is for:
 *   The renderer reports what is really on screen with `reportInstanceStatus`. That
 *   report is trusted only from a renderer, and a renderer is trusted with nothing
 *   else. A store created without a hook of its own uses the default one, which decides
 *   by the role at the start of the actor name (`renderer:` or anything else).
 *
 * What these tests prove (with a real SQLite file and the store's default hook):
 *   - A renderer's report moves a loading instance to on-air and is logged as ok.
 *   - The same report from an operator is refused with NOT_ALLOWED in pt-BR, logged as
 *     failed, and the instance stays loading.
 *   - A take from a renderer is refused with NOT_ALLOWED and nothing goes on air.
 *
 * What these tests deliberately do not cover:
 *   - Every command and role pair; authorizeCommand.test.ts lists them against the hook
 *     alone.
 *   - A store given its own hook; createStateStore.test.ts covers that.
 */
import { describe, expect, it } from 'vitest';

import { openTemporaryDatabase } from '../db/temporaryDatabase.testSupport.js';
import { createLogger } from '../logger/createLogger.js';
import { createGraphicsFolderWithBuiltRaceClock } from './builtGraphicsFolder.testSupport.js';
import { createStateStore } from './createStateStore.js';

const idOfTheRaceClockInstance = '0b6c8f2e-3d1a-4c55-8e2f-9a7b6c5d4e3f';
const operatorActor = 'operador:3f2a9c1e-8b47-4d06-9e15-7c0d2b6a4f81';
const rendererActor = 'renderer:b8d4e6f0-1a2c-4e3b-9d5f-6a7c8e9f0b12';

const takeRaceClockOnTheClockLayer = {
  type: 'takeGraphic',
  graphicId: 'race-clock',
  layerId: 'clock',
  data: {
    sessionName: 'Enduro de Resistência',
    state: 'green',
    clockMode: 'elapsed',
    referenceTimeMs: 3_900_000,
    referenceWallClockMs: 1_791_550_800_000,
    running: true,
  },
};
const reportRaceClockOnAir = {
  type: 'reportInstanceStatus',
  instanceId: idOfTheRaceClockInstance,
  status: 'on-air',
};

const expectedNotAllowedError = {
  code: 'NOT_ALLOWED',
  message: 'Você não tem permissão para executar este comando.',
};

/**
 * Builds a store with the default authorisation hook on a fresh temporary database,
 * with the race clock registered and a fixed id for every new instance.
 */
function createStoreWithTheDefaultAuthorisation() {
  return createStateStore({
    database: openTemporaryDatabase().database,
    logger: createLogger({ level: 'silent' }),
    graphicPackagesFolder: createGraphicsFolderWithBuiltRaceClock(),
    readCurrentTime: () => new Date('2026-10-09T14:32:05.000Z'),
    createInstanceId: () => idOfTheRaceClockInstance,
  });
}

describe('reportInstanceStatus through the store', () => {
  it('is accepted from a renderer and moves the loading instance to on-air', () => {
    // Arrange: a store where an operator has just taken the race clock.
    const store = createStoreWithTheDefaultAuthorisation();
    store.applyCommand(takeRaceClockOnTheClockLayer, operatorActor);

    // Act: the renderer reports that the clock's play finished.
    const outcome = store.applyCommand(reportRaceClockOnAir, rendererActor);

    // Assert: ok, the instance is on air, and the event log names the renderer.
    const slicesAfter = store.readAllSlices();
    expect(outcome, 'a renderer must be allowed to report').toEqual({ ok: true });
    expect(
      slicesAfter.instances.map((instance) => instance.status),
      'the reported instance must now be on air',
    ).toEqual(['on-air']);
    expect(
      slicesAfter.eventLog.map((entry) => [entry.actor, entry.command, entry.result.status]),
      'the report must be in the event log under the renderer, after the take',
    ).toEqual([
      [operatorActor, 'takeGraphic', 'ok'],
      [rendererActor, 'reportInstanceStatus', 'ok'],
    ]);
  });

  it('is refused from an operator with NOT_ALLOWED, and the instance stays loading', () => {
    // Arrange: a store where an operator has just taken the race clock.
    const store = createStoreWithTheDefaultAuthorisation();
    store.applyCommand(takeRaceClockOnTheClockLayer, operatorActor);

    // Act: the operator's connection claims the clock is on air.
    const outcome = store.applyCommand(reportRaceClockOnAir, operatorActor);

    // Assert: refused in pt-BR, logged as failed, and the instance did not move.
    const slicesAfter = store.readAllSlices();
    expect(outcome, 'only a renderer may report what is on screen').toEqual({
      ok: false,
      error: expectedNotAllowedError,
    });
    expect(slicesAfter.eventLog[1]?.result, 'the refusal must be logged as failed').toEqual({
      status: 'failed',
      error: expectedNotAllowedError,
    });
    expect(
      slicesAfter.instances.map((instance) => instance.status),
      'the instance must still be waiting for a real renderer',
    ).toEqual(['loading']);
  });
});

describe('takeGraphic through the store', () => {
  it('is refused from a renderer with NOT_ALLOWED, and nothing goes on air', () => {
    // Arrange: a store with the race clock registered and nothing on air.
    const store = createStoreWithTheDefaultAuthorisation();

    // Act: a renderer connection tries to take the race clock.
    const outcome = store.applyCommand(takeRaceClockOnTheClockLayer, rendererActor);

    // Assert: refused in pt-BR and the instances slice is still empty.
    expect(outcome, 'a renderer must not be able to put a graphic on air').toEqual({
      ok: false,
      error: expectedNotAllowedError,
    });
    expect(store.readAllSlices().instances, 'nothing may go on air').toEqual([]);
  });
});
