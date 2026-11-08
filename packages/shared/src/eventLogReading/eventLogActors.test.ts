/**
 * Who sent each event-log row, as the history page says it (packages/shared)
 *
 * What this module is for:
 *   The event log signs every command with an actor name (`produtor:Mesa 1`,
 *   `operador:<connection>`, `api:companion`, `sistema:macro:<id>`). The history page
 *   (BAJAOVRLAY-30) never shows that raw name: it shows "Produtor · Mesa 1", "Dados · Mesa
 *   2", "Operador", "API · companion", "Gatilho", "Macro", "Fonte" or "Sistema", and
 *   filters by those kinds.
 *
 * What these tests prove:
 *   - Each actor the server signs with reads as its kind and label: a logged-in operator
 *     (BAJAOVRLAY-29) by role and station, an operator with the login off as "Operador".
 *   - The macro watchdog is not taken for a macro, and a renderer reads as "Sistema".
 *
 * What these tests deliberately do not cover:
 *   - Which actor may send which command; apps/server's authorizeCommand.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { eventLogActorKindLabels, readWhoSentEventLogRow } from './eventLogActors.js';

const actorScenarios = [
  // A logged-in producer (BAJAOVRLAY-29) is named by the role and the station typed at login.
  {
    name: 'the producer at "Mesa 1" reads as "Produtor · Mesa 1"',
    actor: 'produtor:Mesa 1',
    expected: { kind: 'produtor', label: 'Produtor · Mesa 1' },
  },
  // The data role the same way, its station kept as typed.
  {
    name: 'the data role at "Mesa 2" reads as "Dados · Mesa 2"',
    actor: 'dados:Mesa 2',
    expected: { kind: 'dados', label: 'Dados · Mesa 2' },
  },
  // A station name may hold a colon: only the first one parts the role from the station.
  {
    name: 'a station named "Cabine: fundos" keeps its colon',
    actor: 'dados:Cabine: fundos',
    expected: { kind: 'dados', label: 'Dados · Cabine: fundos' },
  },
  // The control page with the login off (no PINs set), by its connection.
  {
    name: 'an operator’s connection with the login off reads as "Operador"',
    actor: 'operador:3f2a9c1e-8b47-4d06-9e15-7c0d2b6a4f81',
    expected: { kind: 'operador', label: 'Operador' },
  },
  // A device with its own token names itself.
  {
    name: 'Companion’s token reads as "API · companion"',
    actor: 'api:companion',
    expected: { kind: 'api', label: 'API · companion' },
  },
  // The open API signs every call with no token as "rede".
  {
    name: 'a call to the open API reads as "API · rede"',
    actor: 'api:rede',
    expected: { kind: 'api', label: 'API · rede' },
  },
  // The trigger service of BAJAOVRLAY-48.
  {
    name: 'the trigger service reads as "Gatilho"',
    actor: 'sistema:gatilhos',
    expected: { kind: 'gatilho', label: 'Gatilho' },
  },
  // A macro's runner signs with the macro's id.
  {
    name: 'a macro’s runner reads as "Macro"',
    actor: 'sistema:macro:macro-abertura',
    expected: { kind: 'macro', label: 'Macro' },
  },
  // The watchdog's name starts like a runner's but has no colon after "macro".
  {
    name: 'the macro watchdog is not a macro: it reads as "Sistema"',
    actor: 'sistema:macro-watchdog',
    expected: { kind: 'sistema', label: 'Sistema' },
  },
  // A source's poller signs with the source's id.
  {
    name: 'a data source’s poller reads as "Fonte"',
    actor: 'sistema:fonte:simulador-enduro',
    expected: { kind: 'fonte', label: 'Fonte' },
  },
  // The auto-out is the server by itself.
  {
    name: 'the auto-out reads as "Sistema"',
    actor: 'sistema:auto-out',
    expected: { kind: 'sistema', label: 'Sistema' },
  },
  // A renderer's report is the server's side of the show too.
  {
    name: 'a renderer reads as "Sistema"',
    actor: 'renderer:5d1c9e2a',
    expected: { kind: 'sistema', label: 'Sistema' },
  },
];

describe('readWhoSentEventLogRow', () => {
  it.each(actorScenarios)('$name', ({ actor, expected }) => {
    // Arrange: the actor name as the event log stores it (in the table above).

    // Act: read who sent the row.
    const who = readWhoSentEventLogRow(actor);

    // Assert: the kind and the label the page shows.
    expect(who, 'the row must say who sent it in the operator’s words').toEqual(expected);
  });
});

describe('eventLogActorKindLabels', () => {
  it('names every kind of the "Quem" filter in pt-BR', () => {
    // Arrange: nothing beyond the labels themselves.

    // Act: read them in the filter's order.
    const labels = Object.values(eventLogActorKindLabels);

    // Assert: the eight kinds, in pt-BR, the two roles first.
    expect(labels, 'the filter must offer the eight kinds in pt-BR').toEqual([
      'Produtor',
      'Dados',
      'Operador',
      'API',
      'Gatilho',
      'Macro',
      'Fonte',
      'Sistema',
    ]);
  });
});
