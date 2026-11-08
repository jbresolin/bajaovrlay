/**
 * The authorisation step and the two roles of the operator login (apps/server)
 *
 * What this module is for:
 *   With the PINs set (BAJAOVRLAY-29), a control page's commands are signed with the role
 *   and the station typed at login: `produtor:Mesa 1`, `dados:Mesa 2`. The store's
 *   authorisation step reads the role column of the shared command list: the Produtor may
 *   send every operator command, Dados only those that prepare the show, never one that
 *   changes what is on program or preview. A refusal says "O papel Dados não pode …" and
 *   is written to the event log as failed, under the actor that sent it.
 *
 * What these tests prove:
 *   - For every command type, the hook's answer for `produtor:Mesa 1` and `dados:Mesa 2`
 *     is the shared list's (isCommandTypeOpenToTheRole), so the two cannot drift apart.
 *   - Neither role may send the server's own commands, nor what an operator may never send
 *     (a recorder's failure message, a take carrying a trigger's data).
 *   - Through the whole store: Dados creates an item (logged as `dados:Mesa 2`) but its take
 *     of it is refused in pt-BR, logged as failed, and nothing goes on air; the Produtor's
 *     take of the same item goes on air, logged as `produtor:Mesa 1`.
 *   - A station name with a colon keeps its role: `dados:Cabine: fundos` is Dados.
 *   - With the login off, `operador:<connection id>` still sends every operator command.
 *
 * What these tests deliberately do not cover:
 *   - How a connection gets its actor; core/ws/webSocketHubOperatorSession.test.ts.
 *   - The table of which command each role may send, row by row; commandSenders.test.ts in
 *     packages/shared.
 */
import {
  type Command,
  isCommandTypeOpenToTheRole,
  whoMaySendEachCommandType,
} from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { openTemporaryDatabase } from '../db/temporaryDatabase.testSupport.js';
import { createLogger } from '../logger/createLogger.js';
import { allowCommandForActorRole } from './authorizeCommand.js';
import { createGraphicsFolderWithBuiltRaceClock } from './builtGraphicsFolder.testSupport.js';
import { createStateStore } from './createStateStore.js';
import {
  createRaceClockItemOnTheStore,
  shortcutsPanelHome,
} from './raceClockItemOnTheStore.testSupport.js';

const producerActor = 'produtor:Mesa 1';
const dataRoleActor = 'dados:Mesa 2';
const operatorActorWithTheLoginOff = 'operador:3f2a9c1e-8b47-4d06-9e15-7c0d2b6a4f81';

/**
 * A command carrying only its type. For an operator the hook reads nothing but the type,
 * except a takeItem's triggerFill and a stopRecording's failureMessage, which the tests
 * below send in full; so the type alone stands for the whole command here.
 */
function buildCommandWithOnlyItsType(commandType: Command['type']): Command {
  return { type: commandType } as Command;
}

const everyCommandType = Object.keys(whoMaySendEachCommandType) as Array<Command['type']>;

describe('allowCommandForActorRole for a logged-in operator', () => {
  it.each(everyCommandType)('answers %s as the shared role column does', (commandType) => {
    // Arrange: the command of the row, and the shared list's answer for each role.
    const command = buildCommandWithOnlyItsType(commandType);
    const isOpenToTheProducer = isCommandTypeOpenToTheRole(commandType, 'produtor');
    const isOpenToTheDataRole = isCommandTypeOpenToTheRole(commandType, 'dados');

    // Act: ask the hook for the Produtor at "Mesa 1" and for Dados at "Mesa 2".
    const isAllowedForTheProducer = allowCommandForActorRole(command, producerActor);
    const isAllowedForTheDataRole = allowCommandForActorRole(command, dataRoleActor);

    // Assert: the same answers.
    expect(isAllowedForTheProducer, `the Produtor and ${commandType}`).toBe(isOpenToTheProducer);
    expect(isAllowedForTheDataRole, `Dados and ${commandType}`).toBe(isOpenToTheDataRole);
  });

  it('refuses both roles a stopRecording that carries a failure message', () => {
    // Arrange: the recorder's own stop, with its reason.
    const command: Command = {
      type: 'stopRecording',
      sourceId: 'cronometragem',
      failureMessage: 'Disco cheio.',
    };

    // Act: ask the hook for both roles.
    const isAllowedForTheProducer = allowCommandForActorRole(command, producerActor);
    const isAllowedForTheDataRole = allowCommandForActorRole(command, dataRoleActor);

    // Assert: refused for both; only the recorder says why a recording failed.
    expect(isAllowedForTheProducer, 'the Produtor may not fake a failure').toBe(false);
    expect(isAllowedForTheDataRole, 'Dados may not fake a failure').toBe(false);
  });

  it('refuses the Produtor a take carrying a trigger’s data', () => {
    // Arrange: a take with a trigger's fill, which only the macro runner sends.
    const command: Command = {
      type: 'takeItem',
      itemId: 'item-tarja',
      triggerFill: { fields: {}, data: { piloto: 'Ana Souza' } },
    };

    // Act: ask the hook for the Produtor.
    const isAllowed = allowCommandForActorRole(command, producerActor);

    // Assert: refused.
    expect(isAllowed, 'no page may put text on air as if a trigger brought it').toBe(false);
  });

  it('reads the role of a station whose name holds a colon', () => {
    // Arrange: Dados at "Cabine: fundos", and a take.
    const command: Command = { type: 'takeItem', itemId: 'item-relogio' };

    // Act: ask the hook.
    const isAllowed = allowCommandForActorRole(command, 'dados:Cabine: fundos');

    // Assert: still Dados, so refused.
    expect(isAllowed, 'only the first colon parts the role from the station').toBe(false);
  });

  it('lets an operator with the login off send a take, as before', () => {
    // Arrange: a take from a control page with no PINs set.
    const command: Command = { type: 'takeItem', itemId: 'item-relogio' };

    // Act: ask the hook.
    const isAllowed = allowCommandForActorRole(command, operatorActorWithTheLoginOff);

    // Assert: allowed.
    expect(isAllowed, 'with the login off an operator sends every operator command').toBe(true);
  });
});

/** A store with the default hook on a new database, its clock held at 14:32:05. */
function createStoreWithTheDefaultAuthorisation() {
  return createStateStore({
    database: openTemporaryDatabase().database,
    logger: createLogger({ level: 'silent' }),
    graphicPackagesFolder: createGraphicsFolderWithBuiltRaceClock(),
    readCurrentTime: () => new Date('2026-11-07T14:32:05.000Z'),
  });
}

describe('the two roles through the whole store', () => {
  it('lets Dados prepare an item, and refuses its take in pt-BR, logged under its actor', () => {
    // Arrange: Dados at "Mesa 2" creates the race clock as a button of "Atalhos".
    const store = createStoreWithTheDefaultAuthorisation();
    const itemId = createRaceClockItemOnTheStore(store, {
      home: shortcutsPanelHome,
      actor: dataRoleActor,
    });

    // Act: Dados tries to take it.
    const outcome = store.applyCommand({ type: 'takeItem', itemId }, dataRoleActor);

    // Assert: refused with the role's sentence, logged as failed, nothing on air.
    const expectedRefusal = {
      code: 'NOT_ALLOWED',
      message: 'O papel Dados não pode mudar o que está no ar. Peça ao Produtor.',
    };
    expect(outcome, 'Dados may not take').toEqual({ ok: false, error: expectedRefusal });
    const eventLog = store.readAllSlices().eventLog;
    expect(eventLog.at(-2)?.actor, 'the item’s creation is logged under Dados’s actor').toBe(
      dataRoleActor,
    );
    expect(eventLog.at(-1), 'the refused take is logged as failed, under its actor').toMatchObject({
      actor: dataRoleActor,
      command: 'takeItem',
      result: { status: 'failed', error: expectedRefusal },
    });
    expect(store.readAllSlices().instances, 'nothing went on air').toEqual([]);
  });

  it('lets the Produtor take what Dados prepared, logged under the Produtor’s actor', () => {
    // Arrange: Dados at "Mesa 2" creates the race clock as a button of "Atalhos".
    const store = createStoreWithTheDefaultAuthorisation();
    const itemId = createRaceClockItemOnTheStore(store, {
      home: shortcutsPanelHome,
      actor: dataRoleActor,
    });

    // Act: the Produtor at "Mesa 1" takes it.
    const outcome = store.applyCommand({ type: 'takeItem', itemId }, producerActor);

    // Assert: on air, and the event log names the Produtor at "Mesa 1".
    expect(outcome, 'the Produtor may take').toEqual({ ok: true });
    expect(store.readAllSlices().instances.length, 'the clock is on air').toBe(1);
    expect(store.readAllSlices().eventLog.at(-1)?.actor, 'logged as the Produtor').toBe(
      producerActor,
    );
  });
});
