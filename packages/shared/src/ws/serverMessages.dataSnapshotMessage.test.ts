/**
 * The `dataSnapshot` message: one source's last good data (packages/shared)
 *
 * What this module is for:
 *   Since BAJAOVRLAY-40 the server no longer resends the whole `dataSnapshots` slice when
 *   one source is polled. It sends each operator page one `dataSnapshot` message per
 *   source whose snapshot changed: the source's id, its new snapshot (or null when the
 *   source was deleted) and the server's clock. A `slice` message named `dataSnapshots`
 *   no longer exists. The page checks every message against ServerMessageSchema.
 *
 * What these tests prove:
 *   - A message with the source's snapshot, and one with null, are accepted unchanged.
 *   - A message whose snapshot belongs to another source is refused, as is one without
 *     `serverNowMs` and one whose snapshot fails the snapshot schema.
 *   - A `slice` message named `dataSnapshots` is refused.
 *
 * What these tests deliberately do not cover:
 *   - When the server sends the message; apps/server's webSocketHub tests.
 *   - How the control page merges it; apps/control's serverStateStoreDataSources.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { ServerMessageSchema } from './serverMessages.js';

const receivedAtMs = Date.parse('2027-08-14T14:32:05.000Z');

/** Builds the last good data of the seeded simulator: car 42, Baja UFPR, leading. */
function buildEnduroSimulatorSnapshot(lastLapMs: number) {
  return {
    sourceId: 'simulador-enduro',
    receivedAtMs,
    shapes: {
      positions: {
        sessionId: 'enduro-2027-nacional',
        updatedAtMs: receivedAtMs,
        entries: [
          {
            position: 1,
            carNumber: 42,
            teamName: 'Baja UFPR',
            schoolName: 'UFPR',
            laps: 34,
            lastLapMs,
            status: 'running',
          },
        ],
      },
    },
  };
}

describe('ServerMessageSchema, for a dataSnapshot message', () => {
  const dataSnapshotScenarios = [
    // A good poll of the simulator: its new data, for its own source.
    {
      name: "accepts a source's new snapshot",
      message: {
        type: 'dataSnapshot',
        sourceId: 'simulador-enduro',
        snapshot: buildEnduroSimulatorSnapshot(278_293),
        serverNowMs: receivedAtMs + 3,
      },
      isAccepted: true,
    },
    // "Excluir": the source has no data any more, so the page drops its entry.
    {
      name: 'accepts null for a source that was deleted',
      message: {
        type: 'dataSnapshot',
        sourceId: 'simulador-enduro',
        snapshot: null,
        serverNowMs: receivedAtMs,
      },
      isAccepted: true,
    },
    // A server bug that filed one source's data under another must not reach the page.
    {
      name: 'refuses a snapshot that belongs to another source',
      message: {
        type: 'dataSnapshot',
        sourceId: 'reproducao-sexta',
        snapshot: buildEnduroSimulatorSnapshot(278_293),
        serverNowMs: receivedAtMs,
      },
      isAccepted: false,
    },
    // Required, as on `slices`: no stand-in server sends this message.
    {
      name: 'refuses a message without the server clock',
      message: {
        type: 'dataSnapshot',
        sourceId: 'simulador-enduro',
        snapshot: buildEnduroSimulatorSnapshot(278_293),
      },
      isAccepted: false,
    },
    // The snapshot is checked by its own schema: a lap of 0 ms is not a lap.
    {
      name: 'refuses a snapshot that fails the snapshot schema',
      message: {
        type: 'dataSnapshot',
        sourceId: 'simulador-enduro',
        snapshot: buildEnduroSimulatorSnapshot(0),
        serverNowMs: receivedAtMs,
      },
      isAccepted: false,
    },
    // The whole list is sent in the hello only; a `slice` of it does not exist any more.
    {
      name: 'refuses a slice message named dataSnapshots',
      message: {
        type: 'slice',
        name: 'dataSnapshots',
        slice: [buildEnduroSimulatorSnapshot(278_293)],
        serverNowMs: receivedAtMs,
      },
      isAccepted: false,
    },
  ];

  it.each(dataSnapshotScenarios)('$name', ({ message, isAccepted }) => {
    // Arrange: a message as the server might send it (from the table above).
    const messageFromTheServer = message;

    // Act: check the message.
    const result = ServerMessageSchema.safeParse(messageFromTheServer);

    // Assert: it is accepted (unchanged) or refused as the row says.
    expect(result.success, 'the message must be judged as the row says').toBe(isAccepted);
    if (isAccepted) {
      expect(result.data, 'an accepted message must not be altered').toEqual(message);
    }
  });
});
