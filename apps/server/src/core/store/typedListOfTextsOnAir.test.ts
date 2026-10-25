/**
 * A typed list of texts taken and updated on the server, with the real message ticker's
 * manifest (apps/server)
 *
 * What this module is for:
 *   The message ticker's messages are the first list of texts an operator types
 *   (BAJAOVRLAY-23). The item form checks them first, but the server's check of the
 *   manifest's schema stays the authority: whatever reaches a take or an on-air update must
 *   fit the ticker's limits (1 to 9 messages, each 1 to 50 characters, at least one
 *   character that is not a space).
 *
 * What these tests prove (with a real SQLite file, and the manifest read from
 * packages/graphics/message-ticker):
 *   - A take of an item with three messages goes on air with the three.
 *   - A take of an item with ten messages is refused with INVALID_GRAPHIC_DATA, and
 *     nothing goes on air.
 *   - An updateInstanceData that sends ["…", ""] is refused, and so is one with a message
 *     of spaces; the three messages stay on air.
 *
 * What these tests deliberately do not cover:
 *   - The form's pt-BR reasons; apps/control's schemaFormTextList.test.ts.
 *   - The graphic's own check; the ticker's manifest-data agreement test.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  createTemporaryDatabasePath,
  openDatabaseForTests,
} from '../db/temporaryDatabase.testSupport.js';
import { createLogger } from '../logger/createLogger.js';
import { createGraphicsFolderWithBuiltPackage } from './builtGraphicsFolder.testSupport.js';
import { createStateStore, type StateStore } from './createStateStore.js';

const operatorActor = 'operador:mesa-principal';

/** The real manifest of the message ticker, as the package ships it. */
function readTheMessageTickerManifest(): object {
  const manifestAddress = new URL(
    '../../../../../packages/graphics/message-ticker/message-ticker.ograf.json',
    import.meta.url,
  );
  return JSON.parse(readFileSync(manifestAddress, 'utf8')) as object;
}

/** A store on a new database file that knows the built message ticker. */
function openStoreWithTheMessageTicker(): StateStore {
  return createStateStore({
    database: openDatabaseForTests(createTemporaryDatabasePath()),
    logger: createLogger({ level: 'silent' }),
    graphicPackagesFolder: createGraphicsFolderWithBuiltPackage(
      'message-ticker',
      readTheMessageTickerManifest(),
    ),
    readCurrentTime: () => new Date('2026-11-14T13:00:00.000Z'),
  });
}

/** The enduro's three announcements. */
function buildThreeAnnouncements(): string[] {
  return [
    'Largada do enduro às 10h00',
    'Box aberto para abastecimento',
    'Premiação às 16h no palco principal',
  ];
}

/** Prepares a ticker item with these messages and takes it; answers the take's outcome. */
function prepareAndTakeTicker(stateStore: StateStore, messages: string[]) {
  const literal = (value: unknown) => ({ kind: 'literal' as const, value });
  const createOutcome = stateStore.applyCommand(
    {
      type: 'createItem',
      home: { kind: 'rundown', rundownId: 'sessao-principal' },
      graphicId: 'message-ticker',
      layerId: 'ticker',
      label: 'Avisos do enduro',
      fields: {
        label: literal('AVISO'),
        messages: literal(messages),
        state: literal('pre'),
        clockMode: literal('elapsed'),
        referenceTimeMs: literal(0),
        referenceWallClockMs: literal(Date.parse('2026-11-14T13:00:00.000Z')),
        running: literal(false),
      },
    },
    operatorActor,
  );
  if (!createOutcome.ok || createOutcome.createdItemId === undefined) {
    return createOutcome;
  }
  return stateStore.applyCommand(
    { type: 'takeItem', itemId: createOutcome.createdItemId },
    operatorActor,
  );
}

/** The ticker on air on the program output, if any. */
function readTickerOnAir(stateStore: StateStore) {
  return stateStore
    .readAllSlices()
    .instances.find((instance) => instance.layerId === 'ticker' && instance.target === 'program');
}

describe('a typed list of texts at the take', () => {
  it('takes three messages on air', () => {
    // Arrange: the store with the real ticker.
    const stateStore = openStoreWithTheMessageTicker();

    // Act: prepare the morning's announcements and take them.
    const outcome = prepareAndTakeTicker(stateStore, buildThreeAnnouncements());

    // Assert: on air with the three messages.
    expect(outcome, 'the take must be accepted').toEqual({ ok: true });
    expect(readTickerOnAir(stateStore)?.resolvedData.messages, 'the three on air').toEqual(
      buildThreeAnnouncements(),
    );
  });

  it('refuses ten messages, one page more than the page cell holds', () => {
    // Arrange: the store with the real ticker, and ten announcements.
    const stateStore = openStoreWithTheMessageTicker();
    const tenMessages = Array.from({ length: 10 }, (_unused, index) => `Aviso ${index + 1}`);

    // Act: prepare and take them.
    const outcome = prepareAndTakeTicker(stateStore, tenMessages);

    // Assert: refused for the data, and nothing on air.
    expect(outcome.ok ? undefined : outcome.error.code, 'ten messages must be refused').toBe(
      'INVALID_GRAPHIC_DATA',
    );
    expect(readTickerOnAir(stateStore), 'nothing goes on air').toBeUndefined();
  });
});

describe('a typed list of texts updated on air', () => {
  const refusedLists = [
    // An empty line, which the form refuses too; a script might still send it.
    { name: 'refuses a list with an empty message', messages: ['Largada do enduro às 10h00', ''] },
    // Spaces only: the manifest's pattern asks for one character that is not a space.
    { name: 'refuses a message of spaces', messages: ['Largada do enduro às 10h00', '   '] },
  ];

  it.each(refusedLists)('$name', ({ messages }) => {
    // Arrange: the three announcements on air.
    const stateStore = openStoreWithTheMessageTicker();
    prepareAndTakeTicker(stateStore, buildThreeAnnouncements());
    const instanceId = readTickerOnAir(stateStore)?.id ?? '';

    // Act: an on-air update with this row's list.
    const outcome = stateStore.applyCommand(
      { type: 'updateInstanceData', instanceId, data: { messages } },
      operatorActor,
    );

    // Assert: refused, and the three messages still on air.
    expect(outcome.ok ? undefined : outcome.error.code, 'the list must be refused').toBe(
      'INVALID_GRAPHIC_DATA',
    );
    expect(readTickerOnAir(stateStore)?.resolvedData.messages, 'the three stay on air').toEqual(
      buildThreeAnnouncements(),
    );
  });
});
