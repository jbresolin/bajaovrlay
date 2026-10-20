/**
 * Which fields an item reads from a source (packages/shared)
 *
 * What this module is for:
 *   "Salvar no item" writes what is on air into the item, field by field. A field the
 *   item reads from a source must keep its binding: replacing it with the value on air
 *   would quietly stop it following the source (gate 2 of PR #18). The server skips
 *   these fields and the control page names them, with this one rule.
 *
 * What these tests prove:
 *   - A field stored as a binding is listed, live or frozen.
 *   - The whole clock ("Relógio da fonte") lists the graphic's four clock fields.
 *   - Typed and takeTime fields are not listed.
 *
 * What these tests deliberately do not cover:
 *   - The save itself; saveOnAirChangesIntoItemBindings.test.ts in apps/server.
 */
import { describe, expect, it } from 'vitest';

import type { ItemFields } from '../rundown/fieldValue.js';
import { listFieldKeysItemReadsFromASource } from './itemFieldsReadFromASource.js';

const raceClockFieldKeys = {
  clockTime: 'referenceTimeMs',
  wallClock: 'referenceWallClockMs',
  clockRunning: 'running',
  clockMode: 'clockMode',
};

/** A binding to the simulator's session at the path given, live or frozen. */
function bindToTheSimulatorSession(path: string, isLive: boolean) {
  return {
    kind: 'binding' as const,
    sourceId: 'simulador-enduro',
    shapeKey: 'session' as const,
    path,
    isLive,
  };
}

describe('listFieldKeysItemReadsFromASource', () => {
  it('lists the frozen title, the live flag and the four fields of the whole clock', () => {
    // Arrange: "Relógio do enduro — fonte" with its title frozen at the take.
    const fields: ItemFields = {
      sessionName: bindToTheSimulatorSession('sessionName', false),
      state: bindToTheSimulatorSession('state', true),
      referenceTimeMs: bindToTheSimulatorSession('clock', true),
      lapsCompletedByLeader: { kind: 'literal', value: 7 },
    };

    // Act: list the fields it reads from a source.
    const keys = listFieldKeysItemReadsFromASource(fields, raceClockFieldKeys);

    // Assert: every binding, and the whole clock as its four fields; not the typed laps.
    expect(keys, 'the fields that must keep their bindings').toEqual([
      'sessionName',
      'state',
      'referenceTimeMs',
      'referenceWallClockMs',
      'running',
      'clockMode',
    ]);
  });

  it('lists nothing for an item with typed values and a moment of the take', () => {
    // Arrange: the endurance start clock, all typed.
    const fields: ItemFields = {
      state: { kind: 'literal', value: 'pre' },
      referenceTimeMs: { kind: 'literal', value: 14_400_000 },
      referenceWallClockMs: { kind: 'takeTime' },
    };

    // Act: list the fields it reads from a source.
    const keys = listFieldKeysItemReadsFromASource(fields, raceClockFieldKeys);

    // Assert: none.
    expect(keys, 'typed fields are saved as they are on air').toEqual([]);
  });
});
