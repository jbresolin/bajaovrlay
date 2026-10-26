/**
 * A step brought back leaves a trace, at a command and at boot (apps/server)
 *
 * What this module is for:
 *   A graphic whose steps are counted from its data (the bracket, BAJAOVRLAY-25) can be left
 *   past its count: by an update with fewer rounds, or by a graphic rebuilt with fewer steps
 *   between two boots. The reducers put it on its last step (instanceStepsWithinTheirCount.ts);
 *   the step then moved without anyone pressing anything, so the store writes a log line
 *   saying which instance, from what step to what step, and the boot does the same for what
 *   it loads, so Camadas never reads "Passo 6 de 3" (gate 2 of PR #30).
 *
 * What these tests prove (with a real SQLite file and a stand-in graphics folder, both in
 * temporary folders):
 *   - An update that shrinks a bracket on air writes one info line naming the command, the
 *     instance, step 5 before and step 2 after.
 *   - A boot over a graphic rebuilt with fewer steps than the step stored puts the instance
 *     on its last step, in memory and in the database, with one info line.
 *
 * What these tests deliberately do not cover:
 *   - The clamp's own rule: reducers/instanceStepsWithinTheirCount.test.ts.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { readAllSliceRows } from '../db/sliceRowStorage.js';
import { openTemporaryDatabase } from '../db/temporaryDatabase.testSupport.js';
import { createRecordingLogger } from '../logger/recordingLogger.testSupport.js';
import { createGraphicsFolderWithBuiltScoreboard } from './builtGraphicsFolder.testSupport.js';
import { createStateStore } from './createStateStore.js';
import { createItemOnTheStore, mainSessionHome } from './raceClockItemOnTheStore.testSupport.js';

const operatorActor = 'operador:conexao-7';
const idOfTheBracketOnAir = '5a1f7c3e-8b2d-4e6f-9a0c-1d2e3f4a5b6c';

/** A stand-in bracket's manifest: its steps counted from its rounds, or a fixed count. */
function buildStandInBracketManifest(stepCount: number) {
  return {
    id: 'baja-scoreboard',
    name: 'Chaveamento de teste',
    main: 'scoreboard.js',
    stepCount,
    v_baja: { defaultLayerId: 'fullscreen', category: 'standings', stepCounter: 'bracketSteps' },
    schema: {
      type: 'object',
      properties: { rounds: { type: 'array' } },
      required: ['rounds'],
    },
  };
}

/** The real Super Prime's rounds, from the shared sample: 7 steps. */
function readTheRealSuperPrimeRounds(): unknown[] {
  const sampleUrl = new URL(
    '../../../../../packages/shared/src/dataShapes/samples/brackets.super-prime.json',
    import.meta.url,
  );
  return (JSON.parse(readFileSync(sampleUrl, 'utf8')) as { rounds: unknown[] }).rounds;
}

/** An eight-car elimination's rounds with no results yet: 3 steps. */
function buildEightCarRounds(): unknown[] {
  const buildRound = (name: string, matchCount: number) => ({
    name,
    matches: Array.from({ length: matchCount }, (_unused, index) => ({
      matchId: `${name}-${String(index + 1)}`,
    })),
  });
  return [buildRound('Quartas de final', 4), buildRound('Semifinal', 2), buildRound('Final', 1)];
}

/** A store on `database` over a stand-in bracket of `stepCount`, logging to memory. */
function createStoreOverTheStandIn(
  database: ReturnType<typeof openTemporaryDatabase>['database'],
  stepCount: number,
) {
  const { logger, readRecordedLines } = createRecordingLogger();
  const store = createStateStore({
    database,
    logger,
    graphicPackagesFolder: createGraphicsFolderWithBuiltScoreboard(
      buildStandInBracketManifest(stepCount),
    ),
    readCurrentTime: () => new Date('2026-10-31T18:40:00.000Z'),
    createInstanceId: () => idOfTheBracketOnAir,
  });
  return { store, readRecordedLines };
}

/** Takes the stand-in bracket with the real Super Prime and presses Próximo five times. */
function putTheSuperPrimeOnAirAtItsSixthStep(store: ReturnType<typeof createStateStore>): void {
  const itemId = createItemOnTheStore(store, {
    type: 'createItem',
    home: mainSessionHome,
    graphicId: 'scoreboard',
    layerId: 'fullscreen',
    fields: { rounds: { kind: 'literal', value: readTheRealSuperPrimeRounds() } },
    label: 'Super Prime',
  });
  store.applyCommand({ type: 'takeItem', itemId }, operatorActor);
  for (let fromStep = 0; fromStep < 5; fromStep += 1) {
    store.applyCommand({ type: 'nextOnLayer', layerId: 'fullscreen', fromStep }, operatorActor);
  }
}

/** The step of the bracket on air, in memory. */
function readStepOnAir(store: ReturnType<typeof createStateStore>): number | undefined {
  return store.readAllSlices().instances.find((instance) => instance.id === idOfTheBracketOnAir)
    ?.currentStep;
}

describe('a step brought back', () => {
  it('writes a log line naming the command, the instance and both steps', () => {
    // Arrange: the Super Prime on air at its 6th step (index 5).
    const { database } = openTemporaryDatabase();
    const { store, readRecordedLines } = createStoreOverTheStandIn(database, -1);
    putTheSuperPrimeOnAirAtItsSixthStep(store);

    // Act: the operator sends an eight-car bracket (3 steps) on air.
    const outcome = store.applyCommand(
      {
        type: 'updateInstanceData',
        instanceId: idOfTheBracketOnAir,
        data: { rounds: buildEightCarRounds() },
      },
      operatorActor,
    );

    // Assert: applied, on its last step, and one line saying so.
    expect(outcome, 'the update is applied').toEqual({ ok: true });
    expect(readStepOnAir(store), 'the bracket is on its last step').toBe(2);
    expect(
      readRecordedLines().filter(
        (line) => line.message === 'instance brought back to the last step its data has',
      ),
      'one info line names the move',
    ).toEqual([
      expect.objectContaining({
        level: 'info',
        command: 'updateInstanceData',
        instance_id: idOfTheBracketOnAir,
        step_before: 5,
        step_after: 2,
      }),
    ]);
  });

  it('brings an instance back at boot when its graphic was rebuilt with fewer steps', () => {
    // Arrange: the Super Prime on air at index 5 and saved; then the graphic rebuilt with
    // a fixed count of three steps.
    const { database } = openTemporaryDatabase();
    const firstBoot = createStoreOverTheStandIn(database, -1);
    putTheSuperPrimeOnAirAtItsSixthStep(firstBoot.store);

    // Act: the server boots again over the rebuilt graphic.
    const secondBoot = createStoreOverTheStandIn(database, 3);
    const storedInstances = readAllSliceRows(database).find((row) => row.name === 'instances')
      ?.json as Array<{ id: string; currentStep: number }> | undefined;

    // Assert: on its last step in memory and in the database, with one line.
    expect(readStepOnAir(secondBoot.store), 'on its last step in memory').toBe(2);
    expect(
      storedInstances?.find((instance) => instance.id === idOfTheBracketOnAir)?.currentStep,
      'and in the database',
    ).toBe(2);
    expect(
      secondBoot
        .readRecordedLines()
        .filter(
          (line) =>
            line.message === 'instance brought back at boot to the last step its graphic has',
        ),
      'one info line names the move',
    ).toEqual([
      expect.objectContaining({
        level: 'info',
        instance_id: idOfTheBracketOnAir,
        step_before: 5,
        step_after: 2,
      }),
    ]);
  });
});
