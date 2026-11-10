/**
 * The rules of the event inbox, through a real store (apps/server)
 *
 * What this module is for:
 *   Each kind of event has one rule (the `eventRules` slice): ask the operator, go on
 *   air by itself, or ignore; the prepared item that shows it; how long it stays on air;
 *   and how long it may wait before it expires. João's defaults are seeded: fastest lap
 *   and leader change on air by themselves, penalties and manual events waiting for the
 *   operator, and a Super Chat rule that can only ask. "Regras" changes them with
 *   updateEventRule, and they are saved.
 *
 * What these tests prove:
 *   - A new database starts with the five rules and their defaults.
 *   - A database written before the inbox existed gets them at its next boot.
 *   - updateEventRule changes only what it carries, and a restart keeps the change.
 *   - A Super Chat rule set to auto, or a manual one set to ignore, is refused by the
 *     command's schema; an item that does not exist, or one no event fills (the tower
 *     picked by mistake would leave the air after the rule's time), by the reducer.
 *   - Leader changes are seeded as ignored until a notice is designed for them (gate 2
 *     of PR #22).
 *
 * What these tests deliberately do not cover:
 *   - What each mode does to a detected event; eventDetectionOnTheStore.test.ts and the
 *     runner's tests.
 *   - Who may change a rule; authorizeEventCommands.test.ts.
 */
import type { EventRule } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { openDatabaseForTests } from '../../core/db/temporaryDatabase.testSupport.js';
import {
  applyOrThrow,
  createClockItemForEvents,
  createPlainClockItem,
  openEventInboxOnTheStore,
  operatorActor,
  restartTheServer,
} from './eventInboxOnTheStore.testSupport.js';

/**
 * João's defaults, with the three seeded notice items: "Penalidade" for incidents and
 * manual events, "Volta mais rápida" for fastest laps, "Super Chat" for Super Chats
 * (seededEventItems.test.ts).
 */
const seededRules: EventRule[] = [
  { kind: 'newIncident', mode: 'ask', itemId: 'penalidade', durationMs: 10_000, maxAgeMs: null },
  {
    kind: 'fastestLap',
    mode: 'auto',
    itemId: 'volta-mais-rapida',
    durationMs: 8_000,
    maxAgeMs: 120_000,
  },
  { kind: 'leaderChanged', mode: 'ignore', itemId: null, durationMs: 6_000, maxAgeMs: 120_000 },
  { kind: 'manual', mode: 'ask', itemId: 'penalidade', durationMs: 10_000, maxAgeMs: null },
  { kind: 'superChat', mode: 'ask', itemId: 'super-chat', durationMs: 15_000, maxAgeMs: null },
];

describe('the seeded event rules', () => {
  it('start a new database with one rule per kind and their defaults', () => {
    // Arrange: nothing; a new database.

    // Act: open the store on it.
    const inbox = openEventInboxOnTheStore();

    // Assert: the five rules, in this order.
    expect(inbox.stateStore.readAllSlices().eventRules, 'the defaults must be seeded').toEqual(
      seededRules,
    );
  });

  it('are added to a database written before the inbox existed', () => {
    // Arrange: a database whose rules row is gone, as one written before BAJAOVRLAY-44.
    const inboxBefore = openEventInboxOnTheStore();
    inboxBefore.shutDown();
    const olderDatabase = openDatabaseForTests(inboxBefore.databasePath);
    olderDatabase.$client.prepare("DELETE FROM slices WHERE name = 'eventRules'").run();
    olderDatabase.$client.close();

    // Act: boot on it.
    const inbox = openEventInboxOnTheStore(inboxBefore);

    // Assert: the defaults are there again.
    expect(inbox.stateStore.readAllSlices().eventRules, 'an older database gets the rules').toEqual(
      seededRules,
    );
  });
});

describe('updateEventRule, "Regras"', () => {
  it('changes only what it carries, and a restart keeps the change', () => {
    // Arrange: a race clock item to show penalties with.
    const inbox = openEventInboxOnTheStore();
    const itemId = createClockItemForEvents(inbox.stateStore, 'Relógio — aviso');

    // Act: give the incidents rule that item and 12 s, then restart.
    applyOrThrow(inbox.stateStore, {
      type: 'updateEventRule',
      kind: 'newIncident',
      itemId,
      durationMs: 12_000,
    });
    const inboxAfterRestart = restartTheServer(inbox);

    // Assert: only that rule changed, mode and max age kept, and it survived the restart.
    expect(
      inboxAfterRestart.stateStore.readAllSlices().eventRules[0],
      'the incidents rule must keep its mode and take the item and duration',
    ).toEqual({ kind: 'newIncident', mode: 'ask', itemId, durationMs: 12_000, maxAgeMs: null });
    expect(
      inboxAfterRestart.stateStore.readAllSlices().eventRules.slice(1),
      'the other rules must be untouched',
    ).toEqual(seededRules.slice(1));
  });

  const refusedRuleScenarios = [
    // João's rule: a viewer's content is never shown without approval.
    {
      name: 'refuses a Super Chat rule that would go on air by itself',
      command: { type: 'updateEventRule', kind: 'superChat', mode: 'auto' },
      expectedError: {
        code: 'INVALID_COMMAND',
        message: 'Comando inválido: o campo "mode" está ausente ou tem um valor errado.',
      },
    },
    // An event the operator typed would vanish as it was typed.
    {
      name: 'refuses a manual rule that would ignore what the operator types',
      command: { type: 'updateEventRule', kind: 'manual', mode: 'ignore' },
      expectedError: {
        code: 'INVALID_COMMAND',
        message: 'Comando inválido: o campo "mode" está ausente ou tem um valor errado.',
      },
    },
    // An item no event fills: a tower picked by mistake would go on air in place of a
    // notice and leave after the rule's 10 s (gate 2 of PR #22).
    {
      name: 'refuses an item that no event fills',
      command: { type: 'updateEventRule', kind: 'newIncident', itemId: 'relogio-da-prova' },
      expectedError: {
        code: 'ITEM_NOT_FILLED_BY_EVENT',
        message:
          'O item "Relógio da prova" não é preenchido por um evento: escolha um item com campos "Evento".',
      },
    },
    // A rule pointing at a deleted item could never show anything.
    {
      name: 'refuses an item that does not exist',
      command: { type: 'updateEventRule', kind: 'fastestLap', itemId: 'item-apagado' },
      expectedError: {
        code: 'ITEM_NOT_FOUND',
        message: 'O item "item-apagado" não existe; ele pode ter sido excluído.',
      },
    },
  ];

  it.each(refusedRuleScenarios)('$name', ({ command, expectedError }) => {
    // Arrange: the seeded rules, and a plain race clock, "Relógio da prova", which no event
    // fills.
    const inbox = openEventInboxOnTheStore(undefined, () => 'relogio-da-prova');
    createPlainClockItem(inbox.stateStore, 'Relógio da prova');

    // Act: send this row's change.
    const outcome = inbox.stateStore.applyCommand(command, operatorActor);

    // Assert: refused with this row's reason, and the rules are as seeded.
    expect(outcome, 'the change must be refused').toEqual({ ok: false, error: expectedError });
    expect(inbox.stateStore.readAllSlices().eventRules, 'no rule may change').toEqual(seededRules);
  });
});
