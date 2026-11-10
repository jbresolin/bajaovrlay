/**
 * Takes refused because a bound field cannot be read (apps/server)
 *
 * What this module is for:
 *   At the take (and at a preview), resolveItemFieldsIntoGraphicData reads every bound
 *   field. One it cannot fill refuses the whole take with BINDING_NOT_RESOLVED and a
 *   pt-BR message that starts with the field's title and names the source, because a
 *   graphic must never go on air with part of its data missing (concept §5.1).
 *
 * What these tests prove (the brief's table, the rows that refuse):
 *   - A source that does not exist, named by its id.
 *   - A source with no data yet: "Título: a fonte Simulador — Enduro ainda não tem dados."
 *   - A required field whose path is absent from the snapshot.
 *   - A car chosen by number that the snapshot does not list.
 *
 * What these tests deliberately do not cover:
 *   - The rows that resolve; resolveItemFieldsWithBindings.test.ts.
 *   - An optional field whose value is absent, which is left out, not refused (same file).
 */
import type { Graphic, ItemFields, SourcesForBindings } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import {
  buildLiveBindingToTheSimulatorSession,
  buildSimulatorSourceThatIsOn,
} from './reducers/boundItemSlices.testSupport.js';
import { resolveItemFieldsIntoGraphicData } from './resolveItemFields.js';
import {
  buildPositionsBinding,
  buildPositionsTowerGraphic,
  buildRaceClockGraphic,
  buildSourcesAtLap34,
  buildTypedEnduroClockFields,
  momentOfTheTake,
} from './resolveItemFieldsWithBindings.testSupport.js';
import { buildEmptyLibrary } from './resolveItemFieldsWithEntities.testSupport.js';

describe('resolveItemFieldsIntoGraphicData with bindings that cannot resolve', () => {
  const refusedScenarios: Array<{
    name: string;
    graphic: Graphic;
    fields: ItemFields;
    sources: SourcesForBindings;
    expectedMessage: string;
  }> = [
    // The source was deleted after the item was saved.
    {
      name: 'refuses a source that does not exist, naming the field',
      graphic: buildRaceClockGraphic(),
      fields: {
        ...buildTypedEnduroClockFields(),
        state: { ...buildLiveBindingToTheSimulatorSession('state'), sourceId: 'cronometragem' },
      },
      sources: buildSourcesAtLap34([]),
      expectedMessage: 'Bandeira: a fonte de dados "cronometragem" não existe.',
    },
    // The simulator just turned on: no good poll yet (the brief's sentence).
    {
      name: 'refuses a source with no data yet, naming the field and the source',
      graphic: buildRaceClockGraphic(),
      fields: {
        ...buildTypedEnduroClockFields(),
        sessionName: buildLiveBindingToTheSimulatorSession('sessionName'),
      },
      sources: { dataSources: [buildSimulatorSourceThatIsOn()], dataSnapshots: [], overrides: [], bracketMatchFocuses: [] },
      expectedMessage: 'Título: a fonte Simulador — Enduro ainda não tem dados.',
    },
    // A required title bound to the leader's gap, which the leader never has.
    {
      name: 'refuses a required field whose path is absent from the snapshot',
      graphic: buildRaceClockGraphic(),
      fields: {
        ...buildTypedEnduroClockFields(),
        sessionName: buildPositionsBinding('entries.0.gapToLeaderMs', {
          transformId: 'formatGapAsText',
          transformParameters: { unit: 'ms' },
        }),
      },
      sources: buildSourcesAtLap34([]),
      expectedMessage:
        'Título: a fonte Simulador — Enduro não tem valor em Posições › 1º colocado › Diferença para o líder (tempo).',
    },
    // A team card for car 7, which this field of 60 does not have.
    {
      name: 'refuses a car the snapshot does not list',
      graphic: buildPositionsTowerGraphic(),
      fields: {
        title: buildPositionsBinding('entryOfCar.teamName', { carNumber: 7 }),
        entries: { kind: 'literal', value: [] },
      },
      sources: buildSourcesAtLap34([]),
      expectedMessage: 'Título: a fonte Simulador — Enduro não tem o carro 7 em Posições.',
    },
  ];

  it.each(refusedScenarios)('$name', ({ graphic, fields, sources, expectedMessage }) => {
    // Arrange: the fields and sources of this row.

    // Act: resolve at the take.
    const resolution = resolveItemFieldsIntoGraphicData({
      fields,
      graphic,
      momentOfTheTake,
      sources,
      entities: buildEmptyLibrary(),
    });

    // Assert: the whole take refused, the field and the cause named in pt-BR.
    expect(resolution, 'the take must be refused, never half-resolved').toEqual({
      status: 'refused',
      error: { code: 'BINDING_NOT_RESOLVED', message: expectedMessage },
    });
  });
});
