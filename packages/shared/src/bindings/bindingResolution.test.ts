/**
 * Reading one binding against the sources (packages/shared)
 *
 * What this module is for:
 *   resolveBindingAgainstSources gives the value one binding reads now: it finds the
 *   source and its last good snapshot, lays the operator's overrides over it, reads the
 *   path (a car chosen by number is looked up by its number), and applies the
 *   transform. The server runs it at the take and at every live refresh; the item
 *   editor runs it for its "valor agora" line. It never throws and reads no clock. It
 *   tells apart a value the snapshot does not hold (the take leaves an optional field
 *   out) from a binding that cannot be read at all (no source, no data yet, no such
 *   shape, a transform that refuses), each with a pt-BR sentence the server puts the
 *   field's title before.
 *
 * What these tests prove:
 *   - The flag, the whole clock, a place and a car chosen by number are read as the
 *     snapshot holds them.
 *   - A value the snapshot does not hold (the leader's gap, a car not listed) is
 *     "absent", named in pt-BR.
 *   - A missing source, a source with no data yet and a shape the source does not send
 *     cannot be read, named in pt-BR, and neither can a stored binding whose transform
 *     does not read its path.
 *   - A value an override changed says so (isOverridden), and one it did not does not.
 *
 * What these tests deliberately do not cover:
 *   - Filling a graphic's fields, required ones refusing and the clock group;
 *     resolveItemFields*.test.ts in apps/server does that with the full table of the brief.
 */
import { describe, expect, it } from 'vitest';

import type { BindingFieldValue } from './bindingFieldValue.js';
import { type BindingResolution, resolveBindingAgainstSources } from './bindingResolution.js';
import {
  buildCarOverride,
  buildSessionNameOverride,
  buildSimulatorSource,
  buildSourcesWithTheSimulatorAtLap34,
  readSimulatorSnapshotAtLap34,
  simulatorSourceId,
} from './sourcesForBindingTests.testSupport.js';

/** A live binding to the simulator, in the shape and at the path given. */
function buildBinding(
  shapeKey: BindingFieldValue['shapeKey'],
  path: string,
  carNumber?: number,
): BindingFieldValue {
  const binding: BindingFieldValue = {
    kind: 'binding',
    sourceId: simulatorSourceId,
    shapeKey,
    path,
    isLive: true,
  };
  if (carNumber !== undefined) {
    binding.carNumber = carNumber;
  }
  return binding;
}

describe('resolveBindingAgainstSources', () => {
  const readScenarios: Array<{
    name: string;
    binding: BindingFieldValue;
    expected: BindingResolution;
  }> = [
    // The race clock's flag.
    {
      name: 'reads the session flag',
      binding: buildBinding('session', 'state'),
      expected: { status: 'resolved', value: 'green', isOverridden: false },
    },
    // "Relógio da fonte": the whole reading, which the server spreads over four fields.
    {
      name: 'reads the whole session clock as one reading',
      binding: buildBinding('session', 'clock'),
      expected: {
        status: 'resolved',
        value: {
          clockMode: 'remaining',
          referenceTimeMs: 4_559_052,
          referenceWallClockMs: 1_805_568_240_948,
          running: true,
        },
        isOverridden: false,
      },
    },
    // A lower third naming whoever leads.
    {
      name: 'reads the team in 1st place',
      binding: buildBinding('positions', 'entries.0.teamName'),
      expected: { status: 'resolved', value: 'Acauã Baja', isOverridden: false },
    },
    // A team card that follows car 42, 19th at lap 34.
    {
      name: 'reads the team of car 42 chosen by its number',
      binding: buildBinding('positions', 'entryOfCar.teamName', 42),
      expected: { status: 'resolved', value: 'Jequitibá Racing', isOverridden: false },
    },
    // The leader has no gap to itself: the shape leaves the field out.
    {
      name: 'says the leader gap is absent, naming the path',
      binding: buildBinding('positions', 'entries.0.gapToLeaderMs'),
      expected: {
        status: 'valueAbsent',
        problem:
          'a fonte Simulador — Enduro não tem valor em Posições › 1º colocado › Diferença para o líder (tempo).',
      },
    },
    // A card for car 7, which is not in this field of 60.
    {
      name: 'says car 7 is absent from the positions',
      binding: buildBinding('positions', 'entryOfCar.teamName', 7),
      expected: {
        status: 'valueAbsent',
        problem: 'a fonte Simulador — Enduro não tem o carro 7 em Posições.',
      },
    },
    // The simulator sends no brackets.
    {
      name: 'cannot read a shape the source does not send',
      binding: buildBinding('brackets', 'rounds'),
      expected: {
        status: 'unresolvable',
        problem: 'a fonte Simulador — Enduro não tem Chaves.',
      },
    },
    // topN on a text: the save refuses it, but an item stored before a change of the path
    // list or the registry may still hold one, and must not reach the air.
    {
      name: 'cannot read a binding whose transform does not read its path',
      binding: {
        ...buildBinding('session', 'sessionName'),
        transformId: 'topN',
        transformParameters: { n: 6 },
      },
      expected: {
        status: 'unresolvable',
        problem: 'A transformação "Primeiras N entradas" não se aplica a Sessão › Nome da sessão.',
      },
    },
  ];

  it.each(readScenarios)('$name', ({ binding, expected }) => {
    // Arrange: the simulator at lap 34, with no correction.
    const sources = buildSourcesWithTheSimulatorAtLap34([]);

    // Act: resolve the binding of this row.
    const resolution = resolveBindingAgainstSources(binding, sources);

    // Assert: the value, or why there is none.
    expect(resolution, 'the binding must resolve as this row says').toEqual(expected);
  });

  it('cannot read a source that does not exist', () => {
    // Arrange: no source at all (it was deleted).
    const sources = { dataSources: [], dataSnapshots: [], overrides: [] };

    // Act: resolve the flag.
    const resolution = resolveBindingAgainstSources(buildBinding('session', 'state'), sources);

    // Assert: it says the source does not exist, by its id.
    expect(resolution, 'a missing source must be named').toEqual({
      status: 'unresolvable',
      problem: 'a fonte de dados "simulador-enduro" não existe.',
    });
  });

  it('cannot read a source that has no data yet, naming it', () => {
    // Arrange: the simulator just turned on, before its first good poll.
    const sources = {
      dataSources: [buildSimulatorSource(false)],
      dataSnapshots: [],
      overrides: [],
    };

    // Act: resolve the flag.
    const resolution = resolveBindingAgainstSources(buildBinding('session', 'state'), sources);

    // Assert: the brief's sentence.
    expect(resolution, 'a source with no data must be named').toEqual({
      status: 'unresolvable',
      problem: 'a fonte Simulador — Enduro ainda não tem dados.',
    });
  });

  it('says the value was corrected when an override changed it', () => {
    // Arrange: the session name corrected by the operator.
    const sources = buildSourcesWithTheSimulatorAtLap34([
      buildSessionNameOverride('Enduro — Etapa Nacional'),
    ]);

    // Act: resolve the session name and the flag.
    const nameResolution = resolveBindingAgainstSources(
      buildBinding('session', 'sessionName'),
      sources,
    );
    const flagResolution = resolveBindingAgainstSources(buildBinding('session', 'state'), sources);

    // Assert: the name is the corrected one and says so; the flag is untouched.
    expect(nameResolution, 'the corrected name must say it was corrected').toEqual({
      status: 'resolved',
      value: 'Enduro — Etapa Nacional',
      isOverridden: true,
    });
    expect(flagResolution, 'an untouched value must not say so').toEqual({
      status: 'resolved',
      value: 'green',
      isOverridden: false,
    });
  });

  it('reads the snapshot of a stale source as it is', () => {
    // Arrange: the simulator late (its last poll failed), its lap-34 data kept.
    const sources = {
      dataSources: [buildSimulatorSource(true)],
      dataSnapshots: [readSimulatorSnapshotAtLap34()],
      overrides: [buildCarOverride(42, 'schoolName', 'CEFET Minas')],
    };

    // Act: resolve car 42's school.
    const resolution = resolveBindingAgainstSources(
      buildBinding('positions', 'entryOfCar.schoolName', 42),
      sources,
    );

    // Assert: read like any other; staleness is shown as a badge, never as a refusal.
    expect(resolution, 'a stale source must still be read').toEqual({
      status: 'resolved',
      value: 'CEFET Minas',
      isOverridden: true,
    });
  });
});
