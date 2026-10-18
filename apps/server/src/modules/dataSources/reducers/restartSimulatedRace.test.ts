/**
 * "Reiniciar corrida": the restartSimulatedRace reducer (apps/server)
 *
 * What this module is for:
 *   A simulator plays its race on the wall clock from `config.simulatedStartAtMs`, so a
 *   simulator left on for a while sits past its checkered flag. "Reiniciar corrida" on a
 *   simulator's row (João's ruling 3 at gate 2 of PR #16) moves that start to now: within
 *   one poll interval the simulator answers the green flag again.
 *
 * What these tests prove:
 *   - The start of a simulator that is on moves to the moment of the command, and
 *     nothing else of the source changes.
 *   - The command is refused, each with its pt-BR message: an unknown source
 *     (DATA_SOURCE_NOT_FOUND), a replay (DATA_SOURCE_NOT_A_SIMULATOR) and a simulator
 *     that is off (DATA_SOURCE_DISABLED: turning it on decides where its race is).
 *
 * What these tests deliberately do not cover:
 *   - The next poll answering the green flag: the simulator adapter reads the start when
 *     each poll starts (adapters/simulator has its own tests). A poll already in flight
 *     at the restart answers the old race once more; that is the poller's timing, not
 *     this reducer's (see the doc comment of restartSimulatedRace.ts).
 *   - Who may send it; authorizeDataSourceCommands.test.ts covers it.
 */
import { describe, expect, it } from 'vitest';

import {
  buildEnduroSimulatorTurnedOff,
  buildFridayReplayTurnedOff,
  buildHealthyEnduroSimulator,
  buildRaceDaySlicesWithDataSources,
  contextOfTheDataSourceCommand,
  momentOfTheCommandMs,
} from './dataSourceSlices.testSupport.js';
import { reduceDataSourceCommand } from './reduceDataSourceCommand.js';

describe('restartSimulatedRace', () => {
  it('moves the race start of a simulator that is on to now, and changes nothing else', () => {
    // Arrange: the simulator on since 14:00, its race 32 minutes in.
    const simulatorBefore = buildHealthyEnduroSimulator();
    const slicesBefore = buildRaceDaySlicesWithDataSources({ dataSources: [simulatorBefore] });

    // Act: press "Reiniciar corrida" at 14:32:05.
    const outcome = reduceDataSourceCommand(
      slicesBefore,
      { type: 'restartSimulatedRace', sourceId: 'simulador-enduro' },
      contextOfTheDataSourceCommand,
    );

    // Assert: the same simulator, with its race starting at the moment of the command.
    const sourceAfter = outcome.status === 'applied' ? outcome.slices.dataSources[0] : undefined;
    expect(sourceAfter, 'only the race start may change, and it must be now').toEqual({
      ...simulatorBefore,
      config: { ...simulatorBefore.config, simulatedStartAtMs: momentOfTheCommandMs },
    });
  });

  const refusedRestartScenarios = [
    // A source deleted on another tablet a moment ago.
    {
      name: 'refuses an unknown source',
      sourceId: 'planilha-apagada',
      expectedError: {
        code: 'DATA_SOURCE_NOT_FOUND',
        message: 'A fonte de dados "planilha-apagada" não existe; ela pode ter sido excluída.',
      },
    },
    // A replay has no race of its own to restart; its playback restarts when it is
    // turned on (decision D5).
    {
      name: 'refuses a replay, which is not a simulator',
      sourceId: 'reproducao-sexta',
      expectedError: {
        code: 'DATA_SOURCE_NOT_A_SIMULATOR',
        message:
          'A fonte de dados "Reprodução — Treino de sexta" não é um simulador; só um simulador tem corrida para reiniciar.',
      },
    },
    // A simulator that is off: like "Atualizar agora", the button asks it to be on first.
    {
      name: 'refuses a simulator that is off',
      sourceId: 'simulador-enduro',
      expectedError: {
        code: 'DATA_SOURCE_DISABLED',
        message: 'A fonte de dados "Simulador — Enduro" está desligada. Ligue-a antes.',
      },
    },
  ];

  it.each(refusedRestartScenarios)('$name', ({ sourceId, expectedError }) => {
    // Arrange: the seeded simulator, off, and Friday's replay, off.
    const slicesBefore = buildRaceDaySlicesWithDataSources({
      dataSources: [buildEnduroSimulatorTurnedOff(), buildFridayReplayTurnedOff()],
    });

    // Act: press "Reiniciar corrida" on the source of this row.
    const outcome = reduceDataSourceCommand(
      slicesBefore,
      { type: 'restartSimulatedRace', sourceId },
      contextOfTheDataSourceCommand,
    );

    // Assert: refused, saying why in pt-BR.
    expect(outcome, 'this restart must be refused with its pt-BR reason').toEqual({
      status: 'refused',
      error: expectedError,
    });
  });
});
