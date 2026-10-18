/**
 * "Atualizar agora": the pollDataSourceNow reducer (apps/server)
 *
 * What this module is for:
 *   pollDataSourceNow asks the poller for a poll at once. A command can only reach the
 *   poller through state, so the reducer stamps the moment of the request on the source
 *   (`pollNowRequestedAtMs`) and the poller reacts to the change (decision D7).
 *
 * What these tests prove:
 *   - The moment of the request is stamped on a source that is on.
 *   - A source that is off is refused with DATA_SOURCE_DISABLED, and an unknown source
 *     with DATA_SOURCE_NOT_FOUND, each with its pt-BR message.
 *
 * What these tests deliberately do not cover:
 *   - The poller noticing the stamp and polling; poller.test.ts covers it.
 */
import { describe, expect, it } from 'vitest';

import {
  buildEnduroSimulatorTurnedOff,
  buildHealthyEnduroSimulator,
  buildRaceDaySlicesWithDataSources,
  contextOfTheDataSourceCommand,
  momentOfTheCommandMs,
} from './dataSourceSlices.testSupport.js';
import { reduceDataSourceCommand } from './reduceDataSourceCommand.js';

describe('pollDataSourceNow', () => {
  it('stamps the moment of the request on an enabled source', () => {
    // Arrange: the simulator on.
    const slicesBefore = buildRaceDaySlicesWithDataSources({
      dataSources: [buildHealthyEnduroSimulator()],
    });

    // Act: press "Atualizar agora".
    const outcome = reduceDataSourceCommand(
      slicesBefore,
      { type: 'pollDataSourceNow', sourceId: 'simulador-enduro' },
      contextOfTheDataSourceCommand,
    );

    // Assert: the request is stamped, for the poller to see.
    const sourceAfter = outcome.status === 'applied' ? outcome.slices.dataSources[0] : undefined;
    expect(sourceAfter?.pollNowRequestedAtMs, 'the request moment must be on the source').toBe(
      momentOfTheCommandMs,
    );
  });

  const refusedPollNowScenarios = [
    // A source that is off has no poller loop to ask.
    {
      name: 'refuses a source that is off',
      sourceId: 'simulador-enduro',
      expectedError: {
        code: 'DATA_SOURCE_DISABLED',
        message: 'A fonte de dados "Simulador — Enduro" está desligada. Ligue-a antes.',
      },
    },
    // A source deleted on another tablet a moment ago.
    {
      name: 'refuses an unknown source',
      sourceId: 'planilha-apagada',
      expectedError: {
        code: 'DATA_SOURCE_NOT_FOUND',
        message: 'A fonte de dados "planilha-apagada" não existe; ela pode ter sido excluída.',
      },
    },
  ];

  it.each(refusedPollNowScenarios)('$name', ({ sourceId, expectedError }) => {
    // Arrange: the seeded simulator, off.
    const slicesBefore = buildRaceDaySlicesWithDataSources({
      dataSources: [buildEnduroSimulatorTurnedOff()],
    });

    // Act: press "Atualizar agora" on the source of this row.
    const outcome = reduceDataSourceCommand(
      slicesBefore,
      { type: 'pollDataSourceNow', sourceId },
      contextOfTheDataSourceCommand,
    );

    // Assert: refused, saying why in pt-BR.
    expect(outcome, 'this poll request must be refused with its pt-BR reason').toEqual({
      status: 'refused',
      error: expectedError,
    });
  });
});
