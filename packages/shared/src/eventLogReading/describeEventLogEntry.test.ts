/**
 * One event-log row as the history page shows it (packages/shared)
 *
 * What this module is for:
 *   The history page (BAJAOVRLAY-30) shows each event-log row as when, who and one pt-BR
 *   sentence, marks refusals, and filters by group and layer. The server runs the same
 *   function for older pages, so its text filter matches the sentence the page shows.
 *
 * What these tests prove:
 *   - An accepted row reads its sentence, who sent it, its group and its layers.
 *   - A refused row reads "Recusado: <sentence> — <reason>".
 *   - A command this server no longer knows, and a payload that cannot be read, show the
 *     command's type and why there is no sentence.
 *   - A poll and an import, which the log keeps trimmed, still read as sentences.
 *   - The layers a row touched: the one it names, its item's, its instance's, or every
 *     layer for "Limpar tudo" and the like.
 *
 * What these tests deliberately do not cover:
 *   - The sentence of every command type; sentenceOfEachCommandType.test.ts.
 */
import { describe, expect, it } from 'vitest';

import type { EventLogEntry } from '../slices/eventLogEntry.js';
import { describeEventLogEntry } from './describeEventLogEntry.js';
import { buildEventLogNamesOfRaceDay } from './eventLogNamesOfRaceDay.testSupport.js';

/** Builds an event-log row at 14:32:05, signed by the operator, accepted unless refused. */
function buildEventLogRow(parts: {
  command: string;
  payload: unknown;
  actor?: string;
  refusalReason?: string;
}): EventLogEntry {
  const result: EventLogEntry['result'] =
    parts.refusalReason === undefined
      ? { status: 'ok' }
      : { status: 'failed', error: { code: 'ITEM_NOT_FOUND', message: parts.refusalReason } };
  return {
    id: 4_812,
    ts: '2026-10-09T14:32:05.000Z',
    actor: parts.actor ?? 'operador:conexao-7',
    command: parts.command,
    payload: parts.payload,
    result,
  };
}

const everyLayerOfTheRaceDay = ['clock', 'lower-third', 'notice', 'fullscreen', 'camera-do-box'];

describe('describeEventLogEntry', () => {
  it('reads an accepted take with its sentence, who, group and layer', () => {
    // Arrange: the operator's take of Ana Souza's lower third.
    const row = buildEventLogRow({
      command: 'takeItem',
      payload: { type: 'takeItem', itemId: 'item-tarja-ana-souza' },
    });

    // Act: describe it with the race day's names.
    const described = describeEventLogEntry(row, buildEventLogNamesOfRaceDay());

    // Assert: everything the history row shows and filters on.
    expect(described, 'an accepted take must read as the operator’s take on "Tarja"').toEqual({
      id: 4_812,
      ts: '2026-10-09T14:32:05.000Z',
      who: { kind: 'operador', label: 'Operador' },
      sentence: 'Tomou "Tarja – Ana Souza" na camada Tarja (Programa)',
      isRefusal: false,
      group: 'takesAndClears',
      layerIds: ['lower-third'],
    });
  });

  it('reads a refused row as "Recusado", with the sentence and the reason', () => {
    // Arrange: Companion's take of an item deleted since, refused by the server.
    const row = buildEventLogRow({
      command: 'takeItem',
      payload: { type: 'takeItem', itemId: 'item-tarja-bruno-lima' },
      actor: 'api:companion',
      refusalReason: 'O item "item-tarja-bruno-lima" não existe; ele pode ter sido excluído.',
    });

    // Act: describe it.
    const described = describeEventLogEntry(row, buildEventLogNamesOfRaceDay());

    // Assert: marked, worded as a refusal, and signed by the device.
    expect(described.isRefusal, 'a failed row must be marked as a refusal').toBe(true);
    expect(described.sentence, 'a refusal must say what was tried and why not').toBe(
      'Recusado: Tomou item excluído (item-tarja-bruno-lima) — O item "item-tarja-bruno-lima" não existe; ele pode ter sido excluído.',
    );
    expect(described.who.label, 'the row must name the device').toBe('API · companion');
  });

  it('shows the type of a command this server no longer knows, and says why', () => {
    // Arrange: a row of takeGraphic, removed by BAJAOVRLAY-37 but still in an old database.
    const row = buildEventLogRow({
      command: 'takeGraphic',
      payload: { type: 'takeGraphic', graphicId: 'race-clock', layerId: 'clock', data: {} },
    });

    // Act: describe it.
    const described = describeEventLogEntry(row, buildEventLogNamesOfRaceDay());

    // Assert: its type, the reason, and no group.
    expect(described.sentence, 'an unknown command must show its type and why').toBe(
      'Comando "takeGraphic" (sem descrição: este servidor não conhece mais esse comando)',
    );
    expect(described.group, 'a command this server does not know has no group').toBeNull();
  });

  it('shows the type of a command whose payload cannot be read, and says why', () => {
    // Arrange: a take refused at validation, its item id sent as a number.
    const row = buildEventLogRow({
      command: 'takeItem',
      payload: { type: 'takeItem', itemId: 42 },
      refusalReason: 'O campo "itemId" está errado.',
    });

    // Act: describe it.
    const described = describeEventLogEntry(row, buildEventLogNamesOfRaceDay());

    // Assert: its type, the reason, still in its group.
    expect(described.sentence, 'an unreadable payload must show its type and why').toBe(
      'Recusado: Comando "takeItem" (sem descrição: os dados do comando não puderam ser lidos) — O campo "itemId" está errado.',
    );
    expect(described.group, 'a known type keeps its group').toBe('takesAndClears');
  });

  it('reads a failed poll from the trimmed payload the log keeps', () => {
    // Arrange: the simulator going stale, as its poller's row is stored (no shapes).
    const row = buildEventLogRow({
      command: 'recordDataSourcePoll',
      actor: 'sistema:fonte:simulador-enduro',
      payload: {
        type: 'recordDataSourcePoll',
        sourceId: 'simulador-enduro',
        result: { ok: false, attemptedAtMs: 1_791_557_525_000, error: 'Tempo esgotado após 5 s.' },
      },
    });

    // Act: describe it.
    const described = describeEventLogEntry(row, buildEventLogNamesOfRaceDay());

    // Assert: the source and its error, signed by "Fonte".
    expect(described.sentence, 'a trimmed poll must still read as a sentence').toBe(
      'A fonte "Simulador — Enduro" falhou: Tempo esgotado após 5 s.',
    );
    expect(described.who.label, 'a poller’s row is the source’s').toBe('Fonte');
  });

  it('reads an import from the trimmed payload the log keeps', () => {
    // Arrange: sixty teams imported, as the row stores it (keys, no records).
    const row = buildEventLogRow({
      command: 'importEntities',
      payload: {
        type: 'importEntities',
        entityType: 'team',
        recordCount: 60,
        recordKeys: Array.from({ length: 60 }, (_unused, index) => index + 1),
      },
    });

    // Act: describe it.
    const described = describeEventLogEntry(row, buildEventLogNamesOfRaceDay());

    // Assert: how many of which kind.
    expect(described.sentence, 'a trimmed import must still read as a sentence').toBe(
      'Importou 60 equipes',
    );
  });
});

const layerScenarios = [
  // A command that names its layer.
  {
    name: 'a clear touches the layer it names',
    payload: { type: 'clearLayer', layerId: 'clock' },
    expected: ['clock'],
  },
  // A take names an item; its layer is the item's.
  {
    name: 'a take touches its item’s layer',
    payload: { type: 'takeItem', itemId: 'item-relogio-enduro' },
    expected: ['clock'],
  },
  // An edit on air names an instance still on "Tarja".
  {
    name: 'an edit on air touches its instance’s layer',
    payload: {
      type: 'updateInstanceData',
      instanceId: 'instancia-tarja-ana-souza',
      data: { personName: 'Ana Souza' },
    },
    expected: ['lower-third'],
  },
  // "Limpar tudo" touches every layer, so the layer filter keeps it.
  {
    name: '"Limpar tudo" touches every layer',
    payload: { type: 'clearAll' },
    expected: everyLayerOfTheRaceDay,
  },
  // "Descartar" of every preview names no layer, and touches them all.
  {
    name: 'discarding every preview touches every layer',
    payload: { type: 'stopPreview', layerId: null },
    expected: everyLayerOfTheRaceDay,
  },
  // A take of an item deleted since: its layer is no longer known.
  {
    name: 'a take of an item gone touches no known layer',
    payload: { type: 'takeItem', itemId: 'item-tarja-bruno-lima' },
    expected: [],
  },
  // Nothing about layers at all.
  {
    name: 'a source being turned off touches no layer',
    payload: { type: 'setDataSourceEnabled', sourceId: 'simulador-enduro', isEnabled: false },
    expected: [],
  },
];

describe('the layers a row touched', () => {
  it.each(layerScenarios)('$name', ({ payload, expected }) => {
    // Arrange: the row of the command (in the table above).
    const row = buildEventLogRow({ command: payload.type, payload });

    // Act: describe it.
    const described = describeEventLogEntry(row, buildEventLogNamesOfRaceDay());

    // Assert: the layers the layer filter matches it by.
    expect(described.layerIds, 'the row must touch exactly these layers').toEqual(expected);
  });
});
