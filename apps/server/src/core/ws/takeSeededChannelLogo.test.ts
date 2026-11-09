/**
 * A take of the seeded "Logo do canal" before an image is picked (apps/server)
 *
 * What this module is for:
 *   Every new database comes with a "Logo do canal" item (BAJAOVRLAY-63) with no image:
 *   the operator picks the file in the item editor, whose required "Imagem" field refuses
 *   a save without one. A take can still come from elsewhere before then (the rundown's
 *   "Disparar", a macro, the command API), so the server's own check of the data against
 *   the logo bug's manifest is what keeps an empty logo off the air.
 *
 * What these tests prove (with a real server on a random port, a real SQLite file and the
 * logo bug's real manifest):
 *   - A take of the seeded item is refused INVALID_GRAPHIC_DATA with a pt-BR message that
 *     names the field the way the operator sees it in the form, "Imagem", and never by
 *     its key in the data, "logoUrl".
 *   - Nothing goes on program: there is no instance on any layer afterwards.
 *
 * What these tests deliberately do not cover:
 *   - The seed itself (store/seededChannelLogo.test.ts) and the form's refusal
 *     (apps/control's ItemEditorPanelChannelLogo.test.tsx).
 *   - How every kind of data problem is named (store/graphicDataValidation.test.ts).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import type { ServerMessage } from '@bajaovrlay/shared';
import { describe, expect, it, onTestFinished } from 'vitest';

import { noSourceHostAllowlist } from '../../modules/dataSources/index.js';
import { startServer } from '../boot/startServer.js';
import { createTemporaryDataFolder } from '../boot/temporaryDataFolder.testSupport.js';
import { committedMigrationsFolder } from '../db/openDatabase.js';
import { createTemporaryDatabasePath } from '../db/temporaryDatabase.testSupport.js';
import { createLogger } from '../logger/createLogger.js';
import { createGraphicsFolderWithBuiltPackage } from '../store/builtGraphicsFolder.testSupport.js';
import { connectWebSocketTestClient } from './webSocketTestClient.testSupport.js';

/** The logo bug's manifest as packages/graphics/logo-bug ships it. */
function readTheLogoBugManifest(): object {
  const manifestPath = fileURLToPath(
    new URL('../../../../../packages/graphics/logo-bug/logo-bug.ograf.json', import.meta.url),
  );
  return JSON.parse(readFileSync(manifestPath, 'utf8')) as object;
}

/**
 * Starts the whole server, silent, on a random free port with a fresh database (so the
 * channel logo's layer and item are seeded) and the logo bug registered. It is shut down
 * when the test ends.
 */
async function startServerWithTheLogoBugOnARandomPort() {
  const runningServer = await startServer({
    logger: createLogger({ level: 'silent' }),
    version: '0.3.1',
    host: '127.0.0.1',
    port: 0,
    databasePath: createTemporaryDatabasePath(),
    migrationsFolder: committedMigrationsFolder,
    graphicPackagesFolder: createGraphicsFolderWithBuiltPackage(
      'logo-bug',
      readTheLogoBugManifest(),
    ),
    dataFolder: createTemporaryDataFolder(),
    sourceHostAllowlist: noSourceHostAllowlist,
  });
  onTestFinished(() => runningServer.close());
  return runningServer;
}

/** True for any `commandResult` message. */
function isCommandResultMessage(message: ServerMessage): boolean {
  return message.type === 'commandResult';
}

describe('a take of the seeded "Logo do canal" with no image picked', () => {
  it('is refused in pt-BR naming "Imagem", and nothing goes on program', async () => {
    // Arrange: a new server, its seeded logo item untouched, and the control page connected.
    const runningServer = await startServerWithTheLogoBugOnARandomPort();
    const controlPage = await connectWebSocketTestClient(runningServer.port);

    // Act: take the seeded item and wait for the answer.
    controlPage.sendJson({
      type: 'command',
      requestId: 'pedido-logo-1',
      command: { type: 'takeItem', itemId: 'logo-do-canal' },
    });
    const commandResult = await controlPage.waitForMessage('commandResult', isCommandResultMessage);

    // Assert: refused, naming the form's "Imagem" and not the data's "logoUrl"; no instance.
    expect(commandResult, 'the refusal must name the field as the form does').toEqual({
      type: 'commandResult',
      requestId: 'pedido-logo-1',
      ok: false,
      error: {
        code: 'INVALID_GRAPHIC_DATA',
        message:
          'Dados inválidos para o gráfico "logo-bug": o campo "Imagem" é obrigatório e não foi enviado.',
      },
    });
    expect(
      JSON.stringify(commandResult),
      'the key in the data means nothing to the operator',
    ).not.toContain('logoUrl');
    expect(
      runningServer.stateStore.readAllSlices().instances,
      'a refused take must leave program empty',
    ).toEqual([]);
  });
});
