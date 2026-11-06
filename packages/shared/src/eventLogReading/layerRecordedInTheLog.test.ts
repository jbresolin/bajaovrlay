/**
 * A take read on the layer it was taken on (packages/shared)
 *
 * What this module is for:
 *   A history sentence is written with the names the slices hold now (BAJAOVRLAY-30). For
 *   a take or a preview that named the item's layer as it is now, so once the item moved
 *   to another layer the history reported a take that never happened there. Since gate 2
 *   of PR #44 the server writes the layer, and its output, into the row's details when it
 *   applies the take (details.placedOn), and the sentence and the layer filter read them
 *   from there. A row written before has none and reads the item's layer now, as before.
 *
 * What these tests prove (on the race day's names, after Ana Souza's lower third was moved
 * to the "Aviso" layer and the "Tarja" layer to the PiP output):
 *   - A take and a preview with details read the layer and output they were applied on, and
 *     the layer filter matches them by that layer.
 *   - A take of an item deleted since still names the layer it was taken on.
 *   - A row with no details (written before) reads the item's layer now.
 *
 * What these tests deliberately do not cover:
 *   - That the server writes the details; apps/server's storeEventLogDetails.test.ts.
 *   - Every other command's sentence; sentenceOfEachCommandType.test.ts.
 */
import { describe, expect, it } from 'vitest';

import type { EventLogEntry } from '../slices/eventLogEntry.js';
import { describeEventLogEntry } from './describeEventLogEntry.js';
import type { EventLogNames } from './eventLogNames.js';
import { buildEventLogNamesOfRaceDay } from './eventLogNamesOfRaceDay.testSupport.js';

/** Where the take was applied: "Tarja" on "Programa", before anything moved. */
const takenOnTarjaOfProgram = { placedOn: { layerId: 'lower-third', outputId: 'program' } };

/** The race day's names after the moves: Ana Souza's item on "Aviso", "Tarja" on the PiP. */
function buildNamesAfterTheItemAndTheLayerMoved(): EventLogNames {
  const raceDay = buildEventLogNamesOfRaceDay();
  return {
    ...raceDay,
    items: raceDay.items.map((item) =>
      item.id === 'item-tarja-ana-souza' ? { ...item, layerId: 'notice' } : item,
    ),
    layers: raceDay.layers.map((layer) =>
      layer.id === 'lower-third' ? { ...layer, outputId: 'pip' } : layer,
    ),
  };
}

/** An accepted row of the operator's at 14:32:05, with the given details or none. */
function buildAcceptedRow(
  payload: { type: string; itemId: string; origin?: string },
  details?: EventLogEntry['details'],
): EventLogEntry {
  const row: EventLogEntry = {
    id: 4_812,
    ts: '2026-10-09T14:32:05.000Z',
    actor: 'operador:conexao-7',
    command: payload.type,
    payload,
    result: { status: 'ok' },
  };
  if (details !== undefined) {
    row.details = details;
  }
  return row;
}

const recordedLayerScenarios = [
  // The bug of gate 2: the take happened on "Tarja (Programa)", whatever moved since.
  {
    name: 'a take reads the layer and output it was taken on',
    row: buildAcceptedRow(
      { type: 'takeItem', itemId: 'item-tarja-ana-souza' },
      takenOnTarjaOfProgram,
    ),
    expectedSentence: 'Tomou "Tarja – Ana Souza" na camada Tarja (Programa)',
    expectedLayerIds: ['lower-third'],
  },
  // A preview names its item's layer the same way, so it is recorded the same way.
  {
    name: 'a preview reads the layer and output it was previewed on',
    row: buildAcceptedRow(
      { type: 'previewItem', itemId: 'item-tarja-ana-souza', origin: 'manual' },
      takenOnTarjaOfProgram,
    ),
    expectedSentence: 'Pôs em prévia "Tarja – Ana Souza" na camada Tarja (Programa)',
    expectedLayerIds: ['lower-third'],
  },
  // Bruno Lima's item was deleted since; the row still knows where it went on air.
  {
    name: 'a take of an item deleted since still names the layer it was taken on',
    row: buildAcceptedRow(
      { type: 'takeItem', itemId: 'item-tarja-bruno-lima' },
      takenOnTarjaOfProgram,
    ),
    expectedSentence: 'Tomou item excluído (item-tarja-bruno-lima) na camada Tarja (Programa)',
    expectedLayerIds: ['lower-third'],
  },
  // A row written before the layer was recorded: the item's layer now is all there is.
  {
    name: 'a row with no details reads the item’s layer now',
    row: buildAcceptedRow({ type: 'takeItem', itemId: 'item-tarja-ana-souza' }),
    expectedSentence: 'Tomou "Tarja – Ana Souza" na camada Aviso (Programa)',
    expectedLayerIds: ['notice'],
  },
];

describe('the layer a take was applied on, read from the row', () => {
  it.each(recordedLayerScenarios)('$name', ({ row, expectedSentence, expectedLayerIds }) => {
    // Arrange: the names after the item and the layer moved.
    const names = buildNamesAfterTheItemAndTheLayerMoved();

    // Act: describe the row (in the table above).
    const described = describeEventLogEntry(row, names);

    // Assert: the sentence names where it happened, and the layer filter matches it there.
    expect(described.sentence, 'the sentence must name where the command was applied').toBe(
      expectedSentence,
    );
    expect(described.layerIds, 'the layer filter must match the layer it was applied on').toEqual(
      expectedLayerIds,
    );
  });
});
