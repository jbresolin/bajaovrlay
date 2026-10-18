/**
 * The "Fontes de dados" page: the buttons of each source (apps/control)
 *
 * What this module is for:
 *   Each row of the "Fontes" page has the commands an operator gives a source: the
 *   on/off switch, "Atualizar agora", "Reiniciar corrida" (simulators only), "Gravar" /
 *   "Parar gravação" and "Excluir". The page only sends commands; the server changes the
 *   source and sends the new slice back.
 *
 * What these tests prove:
 *   - The switch sends setDataSourceEnabled.
 *   - "Atualizar agora" sends pollDataSourceNow; it and "Gravar" are off while the source is.
 *   - "Reiniciar corrida" sends restartSimulatedRace; it is on simulator rows only, and off
 *     while the simulator is; a refused restart is shown too.
 *   - "Gravar" sends startRecording; a recording source shows "Gravando" and "Parar
 *     gravação", which sends stopRecording; a recording that stopped on its own shows why.
 *   - "Excluir" asks twice: the first press sends nothing, the second deleteDataSource.
 *   - A refusal is shown under the list in the server's own words.
 *   - The switch is off while the server cannot be reached.
 *
 * What these tests deliberately do not cover:
 *   - What the server does with these commands: apps/server's dataSources module tests.
 *   - The 3-second window of "Excluir": features/rundown/RundownPanelDelete.test.tsx,
 *     where the same button is tested with fake timers.
 */
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import {
  buildRehearsalReplayThatIsOk,
  buildSeededSimulatorThatIsOff,
  buildSimulatorThatIsOk,
  buildSimulatorThatIsRecording,
  buildSimulatorWhoseRecordingFailed,
  buildSlicesWithDataSources,
} from '@/state/dataSourcesLikeTheServerSends.testSupport';

import { DataSourcesPage } from './DataSourcesPage';

/** Finds the row of the seeded simulator in the list. */
function findRowOfTheSimulator() {
  const sourceList = screen.getByRole('list', { name: 'Fontes de dados' });
  return within(within(sourceList).getByRole('listitem', { name: 'Simulador — Enduro' }));
}

/** Draws the page with one source, the simulator as this builder makes it. */
function renderPageWithTheSimulator(buildSimulator: typeof buildSimulatorThatIsOk) {
  return renderOnControlPageConnectedToFakeServer(
    <DataSourcesPage />,
    buildSlicesWithDataSources({ dataSources: [buildSimulator()] }),
  );
}

describe('the on/off switch of a source', () => {
  it('turns the seeded simulator on with setDataSourceEnabled', () => {
    // Arrange: the seeded simulator, off.
    const { fakeServer } = renderPageWithTheSimulator(buildSeededSimulatorThatIsOff);

    // Act: flip its switch.
    fireEvent.click(findRowOfTheSimulator().getByRole('switch', { name: 'Ligada' }));

    // Assert: one command that turns it on.
    expect(fakeServer.listCommandsReceived(), 'the switch must turn the source on').toEqual([
      { type: 'setDataSourceEnabled', sourceId: 'simulador-enduro', isEnabled: true },
    ]);
  });

  it('is off while the server cannot be reached', () => {
    // Arrange: the simulator on, then the line drops.
    const { fakeServer } = renderPageWithTheSimulator(buildSimulatorThatIsOk);

    // Act: the connection is lost.
    fakeServer.dropConnection();

    // Assert: the switch cannot be flipped.
    expect(
      findRowOfTheSimulator().getByRole('switch', { name: 'Ligada' }),
      'a switch that would send nothing must not be flippable',
    ).toBeDisabled();
  });
});

describe('"Atualizar agora"', () => {
  it('asks the server to poll the source at once', () => {
    // Arrange: the simulator on.
    const { fakeServer } = renderPageWithTheSimulator(buildSimulatorThatIsOk);

    // Act: press "Atualizar agora".
    fireEvent.click(findRowOfTheSimulator().getByRole('button', { name: 'Atualizar agora' }));

    // Assert: pollDataSourceNow for that source.
    expect(fakeServer.listCommandsReceived(), 'the press must ask for a poll now').toEqual([
      { type: 'pollDataSourceNow', sourceId: 'simulador-enduro' },
    ]);
  });

  it('cannot be pressed, nor can "Gravar", while the source is off', () => {
    // Arrange: the seeded simulator, off.
    renderPageWithTheSimulator(buildSeededSimulatorThatIsOff);

    // Act: nothing; look at the row.
    const simulatorRow = findRowOfTheSimulator();

    // Assert: both buttons are off, as the server would refuse them.
    expect(
      simulatorRow.getByRole('button', { name: 'Atualizar agora' }),
      'a source that is off cannot be polled',
    ).toBeDisabled();
    expect(
      simulatorRow.getByRole('button', { name: 'Gravar' }),
      'a source that is off cannot be recorded',
    ).toBeDisabled();
  });

  it("shows the server's refusal under the list", () => {
    // Arrange: the simulator on, "Atualizar agora" pressed.
    const { fakeServer } = renderPageWithTheSimulator(buildSimulatorThatIsOk);
    fireEvent.click(findRowOfTheSimulator().getByRole('button', { name: 'Atualizar agora' }));

    // Act: the server refuses: another operator turned the source off meanwhile.
    fakeServer.refuseLastCommand({
      code: 'DATA_SOURCE_DISABLED',
      message: 'A fonte de dados "Simulador — Enduro" está desligada. Ligue-a antes.',
    });

    // Assert: the server's words, on the page.
    expect(
      screen.getByRole('alert'),
      'the refusal must be shown in the server pt-BR words',
    ).toHaveTextContent('A fonte de dados "Simulador — Enduro" está desligada. Ligue-a antes.');
  });
});

describe('"Reiniciar corrida"', () => {
  it("restarts the simulator's race with restartSimulatedRace", () => {
    // Arrange: the simulator on, its race running.
    const { fakeServer } = renderPageWithTheSimulator(buildSimulatorThatIsOk);

    // Act: press "Reiniciar corrida".
    fireEvent.click(findRowOfTheSimulator().getByRole('button', { name: 'Reiniciar corrida' }));

    // Assert: restartSimulatedRace for that source.
    expect(
      fakeServer.listCommandsReceived(),
      'the press must ask the server to restart the race',
    ).toEqual([{ type: 'restartSimulatedRace', sourceId: 'simulador-enduro' }]);
  });

  it("shows the server's refusal under the list", () => {
    // Arrange: the simulator on, "Reiniciar corrida" pressed.
    const { fakeServer } = renderPageWithTheSimulator(buildSimulatorThatIsOk);
    fireEvent.click(findRowOfTheSimulator().getByRole('button', { name: 'Reiniciar corrida' }));

    // Act: the server refuses: another tablet turned the simulator off before the slice came.
    fakeServer.refuseLastCommand({
      code: 'DATA_SOURCE_DISABLED',
      message: 'A fonte de dados "Simulador — Enduro" está desligada. Ligue-a antes.',
    });

    // Assert: the server's words, on the page, so the press is never silently lost.
    expect(
      screen.getByRole('alert'),
      'a refused restart must be shown in the server pt-BR words',
    ).toHaveTextContent('A fonte de dados "Simulador — Enduro" está desligada. Ligue-a antes.');
  });

  it('is offered on simulator rows only, and cannot be pressed while the simulator is off', () => {
    // Arrange: the seeded simulator, off, and the rehearsal replay, on.
    renderOnControlPageConnectedToFakeServer(
      <DataSourcesPage />,
      buildSlicesWithDataSources({
        dataSources: [buildSeededSimulatorThatIsOff(), buildRehearsalReplayThatIsOk()],
      }),
    );

    // Act: nothing; look at both rows.
    const sourceList = within(screen.getByRole('list', { name: 'Fontes de dados' }));
    const replayRow = within(sourceList.getByRole('listitem', { name: 'Ensaio de sexta' }));

    // Assert: the simulator has the button (off with it); the replay has none.
    expect(
      findRowOfTheSimulator().getByRole('button', { name: 'Reiniciar corrida' }),
      'a simulator that is off cannot restart its race, as the server would refuse it',
    ).toBeDisabled();
    expect(
      replayRow.queryByRole('button', { name: 'Reiniciar corrida' }),
      'a replay has no race of its own to restart',
    ).not.toBeInTheDocument();
  });
});

describe('recording a source', () => {
  it('starts with "Gravar"', () => {
    // Arrange: the simulator on, not recording.
    const { fakeServer } = renderPageWithTheSimulator(buildSimulatorThatIsOk);

    // Act: press "Gravar".
    fireEvent.click(findRowOfTheSimulator().getByRole('button', { name: 'Gravar' }));

    // Assert: startRecording for that source.
    expect(fakeServer.listCommandsReceived(), '"Gravar" must start a recording').toEqual([
      { type: 'startRecording', sourceId: 'simulador-enduro' },
    ]);
  });

  it('shows "Gravando" while recording, and stops with "Parar gravação"', () => {
    // Arrange: the simulator recording.
    const { fakeServer } = renderPageWithTheSimulator(buildSimulatorThatIsRecording);
    const simulatorRow = findRowOfTheSimulator();

    // Act: press "Parar gravação".
    fireEvent.click(simulatorRow.getByRole('button', { name: 'Parar gravação' }));

    // Assert: the badge was there, and stopRecording was sent.
    expect(
      simulatorRow.getByText('Gravando'),
      'a recording source must say so in its row',
    ).toBeInTheDocument();
    expect(fakeServer.listCommandsReceived(), '"Parar gravação" must stop the recording').toEqual([
      { type: 'stopRecording', sourceId: 'simulador-enduro' },
    ]);
  });

  it('says why a recording stopped on its own', () => {
    // Arrange: the simulator whose recording stopped because the disk filled up.

    // Act: draw the page.
    renderPageWithTheSimulator(buildSimulatorWhoseRecordingFailed);

    // Assert: the server's reason in the row, and "Gravar" offered again.
    const simulatorRow = findRowOfTheSimulator();
    expect(
      simulatorRow.getByText(
        'A gravação parou: o servidor não conseguiu escrever o arquivo (disco cheio ou sem permissão).',
      ),
      'the row must say why the recording stopped',
    ).toBeInTheDocument();
    expect(
      simulatorRow.getByRole('button', { name: 'Gravar' }),
      'the operator can start a new recording',
    ).toBeInTheDocument();
  });
});

describe('"Excluir"', () => {
  it('asks twice before deleting the source', () => {
    // Arrange: the simulator on.
    const { fakeServer } = renderPageWithTheSimulator(buildSimulatorThatIsOk);
    const simulatorRow = findRowOfTheSimulator();

    // Act: press "Excluir" once, then the "Confirmar: excluir" it turned into.
    fireEvent.click(simulatorRow.getByRole('button', { name: 'Excluir' }));
    const commandsAfterTheFirstPress = [...fakeServer.listCommandsReceived()];
    fireEvent.click(simulatorRow.getByRole('button', { name: 'Confirmar: excluir' }));

    // Assert: nothing after the first press; deleteDataSource after the second.
    expect(commandsAfterTheFirstPress, 'one stray press must delete nothing').toEqual([]);
    expect(fakeServer.listCommandsReceived(), 'the second press must delete the source').toEqual([
      { type: 'deleteDataSource', sourceId: 'simulador-enduro' },
    ]);
  });
});
