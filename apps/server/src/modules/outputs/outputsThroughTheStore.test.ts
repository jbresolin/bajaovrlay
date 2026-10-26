/**
 * The output and layer commands through the store (apps/server)
 *
 * What this module is for:
 *   The nine commands that edit outputs and layers (BAJAOVRLAY-49) go through the one
 *   command path like every other: validate, authorise, reduce, save, log, broadcast.
 *   They are an operator's: no screen and no server job may send them.
 *
 * What these tests prove (with a real SQLite file in a temporary folder):
 *   - Setting up João's PiP from the page (add the output, add, rename, lift, reorder and
 *     move layers, delete one, delete an output, reorder the outputs) writes one ok
 *     event-log row per command, in order.
 *   - A refused one writes a failed row carrying its pt-BR reason.
 *   - A renderer, a monitor and a server job are refused NOT_ALLOWED, one row each.
 *   - A new store on the same file has the PiP output and its layer.
 *   - Deleting the layer a built graphic defaults to logs a warning naming the graphic.
 *
 * What these tests deliberately do not cover:
 *   - Each command's rules; outputCommands, layerCommands and deleteLayer tests.
 */
import type { Command } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import {
  createTemporaryDatabasePath,
  openDatabaseForTests,
} from '../../core/db/temporaryDatabase.testSupport.js';
import { createLogger, type ServerLogger } from '../../core/logger/createLogger.js';
import { createRecordingLogger } from '../../core/logger/recordingLogger.testSupport.js';
import { createGraphicsFolderWithBuiltRaceClock } from '../../core/store/builtGraphicsFolder.testSupport.js';
import { createStateStore } from '../../core/store/createStateStore.js';

const operatorActor = 'operador:conexao-7';

/** Opens a store on the given database file with the race clock built. */
function openStore(options: {
  databasePath: string;
  graphicPackagesFolder: string;
  logger?: ServerLogger;
}) {
  return createStateStore({
    database: openDatabaseForTests(options.databasePath),
    logger: options.logger ?? createLogger({ level: 'silent' }),
    graphicPackagesFolder: options.graphicPackagesFolder,
    readCurrentTime: () => new Date('2026-10-25T19:00:00.000Z'),
  });
}

/** A fresh database with the race clock built, and a store on it. */
function createStoreOnFreshDatabase(logger?: ServerLogger) {
  const databasePath = createTemporaryDatabasePath();
  const graphicPackagesFolder = createGraphicsFolderWithBuiltRaceClock();
  const store = openStore({ databasePath, graphicPackagesFolder, logger });
  return { store, databasePath, graphicPackagesFolder };
}

/** The createOutput and createLayer that add the PiP output and its frame. */
const commandsThatAddThePipAndItsFrame: Command[] = [
  { type: 'createOutput', outputId: 'pip', name: 'PiP' },
  {
    type: 'createLayer',
    layerId: 'moldura-pip',
    outputId: 'pip',
    name: 'Moldura',
    zIndex: 10,
    replacePolicy: 'cut',
    persistent: true,
  },
];

describe('setting up the PiP through the store', () => {
  it('writes one ok event-log row per command, in order', () => {
    // Arrange: a fresh store, and the walk João does on "Saídas e camadas".
    const { store } = createStoreOnFreshDatabase();
    const setUpWalk: Command[] = [
      ...commandsThatAddThePipAndItsFrame,
      { type: 'renameOutput', outputId: 'pip', name: 'PiP da câmera' },
      {
        type: 'createLayer',
        layerId: 'legenda-pip',
        outputId: 'pip',
        name: 'Legenda',
        zIndex: 20,
        replacePolicy: 'out-then-in',
        persistent: false,
      },
      { type: 'updateLayer', layerId: 'legenda-pip', zIndex: 30 },
      {
        type: 'reorderLayers',
        outputId: 'pip',
        orderedLayerIds: ['legenda-pip', 'moldura-pip'],
      },
      { type: 'moveLayerToOutput', layerId: 'tower', outputId: 'pip' },
      { type: 'deleteLayer', layerId: 'tower' },
      { type: 'createOutput', outputId: 'camera-2', name: 'Câmera 2' },
      { type: 'reorderOutputs', orderedOutputIds: ['program', 'camera-2', 'pip'] },
      { type: 'deleteOutput', outputId: 'camera-2' },
    ];

    // Act: send every command as the operator.
    const answers = setUpWalk.map((command) => store.applyCommand(command, operatorActor));

    // Assert: every answer ok, and the newest rows name the commands, in order, all ok.
    expect(
      answers.every((answer) => answer.ok),
      'every step of the walk is accepted',
    ).toBe(true);
    const newestRows = store.readAllSlices().eventLog.slice(-setUpWalk.length);
    expect(
      newestRows.map((row) => [row.command, row.actor, row.result.status]),
      'one ok row per command, signed by the operator',
    ).toEqual(setUpWalk.map((command) => [command.type, operatorActor, 'ok']));
  });

  it('writes a failed row carrying the reason of a refusal', () => {
    // Arrange: a fresh store with the PiP and its frame.
    const { store } = createStoreOnFreshDatabase();
    for (const command of commandsThatAddThePipAndItsFrame) {
      store.applyCommand(command, operatorActor);
    }

    // Act: try to delete the PiP while its frame is still there.
    const answer = store.applyCommand({ type: 'deleteOutput', outputId: 'pip' }, operatorActor);

    // Assert: refused, and the newest row says so with the same reason.
    const expectedError = {
      code: 'OUTPUT_HAS_LAYERS',
      message:
        'A saída "PiP" ainda tem 1 camada: "Moldura". Exclua as camadas ou mude-as de saída antes de excluir a saída.',
    };
    expect(answer, 'the operator is told why').toEqual({ ok: false, error: expectedError });
    expect(store.readAllSlices().eventLog.at(-1)?.result, 'the row carries the reason').toEqual({
      status: 'failed',
      error: expectedError,
    });
  });
});

const actorsThatMayNotEditOutputs = [
  // The page OBS loads only reports what it drew.
  { name: 'a renderer', actor: 'renderer:conexao-obs' },
  // The control page's "Programa" and "Prévia" frames only draw.
  { name: 'a monitor', actor: 'monitor:conexao-previa' },
  // A server job (the auto-out) may only clear a layer.
  { name: 'a server job', actor: 'sistema:auto-out' },
];

describe('who may edit outputs and layers', () => {
  it.each(actorsThatMayNotEditOutputs)('refuses $name', ({ actor }) => {
    // Arrange: a fresh store.
    const { store } = createStoreOnFreshDatabase();

    // Act: that actor tries to add the PiP output.
    const answer = store.applyCommand(
      { type: 'createOutput', outputId: 'pip', name: 'PiP' },
      actor,
    );

    // Assert: refused NOT_ALLOWED, and nothing added.
    expect(answer.ok === false && answer.error.code, 'only an operator edits outputs').toBe(
      'NOT_ALLOWED',
    );
    expect(
      store.readAllSlices().outputs.map((output) => output.outputId),
      'program is still the only output',
    ).toEqual(['program']);
  });
});

describe('outputs and layers across a restart', () => {
  it('brings back the PiP output and its frame', () => {
    // Arrange: a store where the operator added the PiP and its frame.
    const { store, databasePath, graphicPackagesFolder } = createStoreOnFreshDatabase();
    for (const command of commandsThatAddThePipAndItsFrame) {
      store.applyCommand(command, operatorActor);
    }

    // Act: open a new store on the same file, as a restart does.
    const storeAfterTheRestart = openStore({ databasePath, graphicPackagesFolder });

    // Assert: the PiP and its frame are there.
    const slicesAfterTheRestart = storeAfterTheRestart.readAllSlices();
    expect(
      slicesAfterTheRestart.outputs.map((output) => output.outputId),
      'the PiP output was saved',
    ).toEqual(['program', 'pip']);
    expect(
      slicesAfterTheRestart.layers.find((layer) => layer.id === 'moldura-pip')?.outputId,
      'the frame was saved on the PiP',
    ).toBe('pip');
  });
});

describe("deleting a graphic's default layer through the store", () => {
  it('logs a warning naming the graphic that now defaults to fullscreen', () => {
    // Arrange: a fresh store whose race clock defaults to the clock layer, and a logger
    // we can read.
    const { logger, readRecordedLines } = createRecordingLogger();
    const { store } = createStoreOnFreshDatabase(logger);

    // Act: delete the clock layer.
    const answer = store.applyCommand({ type: 'deleteLayer', layerId: 'clock' }, operatorActor);

    // Assert: accepted, the clock defaults to fullscreen, and a warning says so.
    expect(answer, 'the delete is accepted').toEqual({ ok: true });
    expect(
      store.readAllSlices().graphics.find((graphic) => graphic.id === 'race-clock')?.defaultLayerId,
      'the race clock now defaults to fullscreen',
    ).toBe('fullscreen');
    expect(readRecordedLines(), 'a warning names the graphic').toContainEqual(
      expect.objectContaining({
        level: 'warn',
        message: 'graphics whose default layer was deleted now default to the fullscreen layer',
        deleted_layer_id: 'clock',
        graphic_ids: ['race-clock'],
      }),
    );
  });
});
