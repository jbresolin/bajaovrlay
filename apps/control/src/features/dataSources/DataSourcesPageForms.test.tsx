/**
 * The "Fontes de dados" page: making and changing a source (apps/control)
 *
 * What this module is for:
 *   "+ Fonte" asks which kind of source to make (Simulador or Reprodução) and opens that
 *   kind's form; "Editar" on a row opens the same form filled with the stored source.
 *   "Salvar fonte" checks the fields with the shared config schema, sends the command,
 *   closes the form once the server accepts, and keeps it open with the server's pt-BR
 *   reason when it refuses.
 *
 * What these tests prove:
 *   - A new simulator is sent as createDataSource with its label, config and interval.
 *   - A new replay offers only the recordings that have ended, and is sent with the one
 *     chosen and its speed.
 *   - A refusal is shown in the form in the server's words, and the form stays open;
 *     a form opened after that, which sent nothing, shows no refusal.
 *   - A wrong field gets its message under it and nothing is sent.
 *   - "Editar" sends updateDataSource with only what changed ("Falha simulada" on).
 *   - An "Editar" form closes when its source is deleted meanwhile.
 *
 * What these tests deliberately do not cover:
 *   - Every field's message and unit: simulatorSourceForm.test.ts, replaySourceForm.test.ts.
 *   - Every way a change is told apart from no change: dataSourceCommandsFromForm.test.ts.
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  chooseOptionInDropdown,
  flipSwitch,
  pressButton,
  typeIntoField,
} from '@/features/schemaForm/schemaFormOnTestPage.testSupport';
import {
  letThePageFinishWhatItStarted,
  renderOnControlPageConnectedToFakeServer,
} from '@/state/controlPageOnFakeServer.testSupport';
import {
  buildFridaysEndedRecording,
  buildRecordingStillOpen,
  buildSimulatorThatIsOk,
  buildSlicesWithDataSources,
} from '@/state/dataSourcesLikeTheServerSends.testSupport';

import { DataSourcesPage } from './DataSourcesPage';

/** Draws the page with the simulator on, and Friday's ended recording beside an open one. */
function renderPageWithTheSimulatorAndTwoRecordings() {
  return renderOnControlPageConnectedToFakeServer(
    <DataSourcesPage />,
    buildSlicesWithDataSources({
      dataSources: [buildSimulatorThatIsOk()],
      recordings: [buildFridaysEndedRecording(), buildRecordingStillOpen()],
    }),
  );
}

/** Presses "+ Fonte" and picks the kind of source, which opens that kind's form. */
function openTheNewSourceFormOfKind(kindName: 'Simulador' | 'Reprodução') {
  pressButton('+ Fonte');
  const kindChoice = within(screen.getByRole('group', { name: 'Que tipo de fonte?' }));
  fireEvent.click(kindChoice.getByRole('button', { name: kindName }));
  return within(screen.getByRole('region', { name: `Nova fonte: ${kindName}` }));
}

describe('a new simulator', () => {
  it('is sent as createDataSource with its label, config and poll interval', async () => {
    // Arrange: the new simulator form, named, at 60 times real time.
    const { fakeServer } = renderPageWithTheSimulatorAndTwoRecordings();
    openTheNewSourceFormOfKind('Simulador');
    typeIntoField('Nome da fonte', 'Simulador rápido');
    typeIntoField('Velocidade (vezes o tempo real)', '60');

    // Act: press "Salvar fonte".
    pressButton('Salvar fonte');

    // Assert: the whole new source, the other fields at their defaults.
    await waitFor(() => {
      expect(fakeServer.listCommandsReceived(), 'the new simulator must be sent whole').toEqual([
        {
          type: 'createDataSource',
          label: 'Simulador rápido',
          kind: 'simulator',
          config: {
            seed: 2027,
            carCount: 60,
            sessionDurationMs: 14_400_000,
            lapLengthKm: 2,
            speed: 60,
            isFailing: false,
          },
          pollIntervalMs: 2_000,
        },
      ]);
    });
  });

  it('is not sent while a field is wrong, and the field says why', async () => {
    // Arrange: the new simulator form, named, with five cars.
    const { fakeServer } = renderPageWithTheSimulatorAndTwoRecordings();
    openTheNewSourceFormOfKind('Simulador');
    typeIntoField('Nome da fonte', 'Simulador pequeno');
    typeIntoField('Carros', '5');

    // Act: press "Salvar fonte" and give the page its moment.
    pressButton('Salvar fonte');
    await letThePageFinishWhatItStarted();

    // Assert: the message under the field, nothing sent.
    expect(
      await screen.findByText('Informe de 10 a 100 carros.'),
      'the car count must say what it accepts',
    ).toBeInTheDocument();
    expect(fakeServer.listCommandsReceived(), 'a wrong form must send nothing').toEqual([]);
  });
});

describe('a new replay', () => {
  it('offers only the recordings that have ended, and is sent with the one chosen', async () => {
    // Arrange: the new replay form, named.
    const { fakeServer } = renderPageWithTheSimulatorAndTwoRecordings();
    openTheNewSourceFormOfKind('Reprodução');
    typeIntoField('Nome da fonte', 'Ensaio de sexta');

    // Act: open the recording list, pick Friday's, pick 10×, press "Salvar fonte".
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Gravação' }), { key: 'Enter' });
    const offeredRecordings = screen.getAllByRole('option');
    fireEvent.click(offeredRecordings[0] as HTMLElement);
    chooseOptionInDropdown('Velocidade da reprodução', '10×');
    pressButton('Salvar fonte');

    // Assert: one recording offered (the open one cannot be replayed yet), then the
    // replay sent with it.
    expect(
      offeredRecordings,
      'only the ended recording may be offered: the open one is still being written',
    ).toHaveLength(1);
    expect(offeredRecordings[0], 'the offer must name whose recording it is').toHaveTextContent(
      /^Simulador — Enduro — .* \(1800 leituras\)$/,
    );
    await waitFor(() => {
      expect(fakeServer.listCommandsReceived(), 'the replay must be sent whole').toEqual([
        {
          type: 'createDataSource',
          label: 'Ensaio de sexta',
          kind: 'replay',
          config: {
            recordingId: 'simulador-enduro/2027-03-19T13-00-00.000Z.jsonl',
            speed: 10,
            isLooping: false,
          },
          pollIntervalMs: 2_000,
        },
      ]);
    });
  });

  it("keeps the form open with the server's reason when the server refuses it", async () => {
    // Arrange: a new replay of Friday's recording, sent.
    const { fakeServer } = renderPageWithTheSimulatorAndTwoRecordings();
    const newReplayForm = openTheNewSourceFormOfKind('Reprodução');
    typeIntoField('Nome da fonte', 'Ensaio de sexta');
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Gravação' }), { key: 'Enter' });
    fireEvent.click(screen.getAllByRole('option')[0] as HTMLElement);
    pressButton('Salvar fonte');
    await waitFor(() => {
      expect(fakeServer.listCommandsReceived(), 'the replay must have been sent').toHaveLength(1);
    });

    // Act: the server refuses: the recording was deleted from the folder meanwhile.
    fakeServer.refuseLastCommand({
      code: 'RECORDING_NOT_FOUND',
      message:
        'A gravação "simulador-enduro/2027-03-19T13-00-00.000Z.jsonl" não existe ou ainda está sendo gravada.',
    });

    // Assert: the reason in the form, which is still open.
    expect(
      await newReplayForm.findByRole('alert'),
      'the refusal must be shown in the form, in the server words',
    ).toHaveTextContent('não existe ou ainda está sendo gravada.');
    expect(
      screen.getByRole('region', { name: 'Nova fonte: Reprodução' }),
      'a refused form must stay open so the operator can fix it',
    ).toBeInTheDocument();
  });

  it("shows no refusal in a new form that has not sent anything, after another form's refusal", async () => {
    // Arrange: a new replay refused by the server, then closed with "Cancelar".
    const { fakeServer } = renderPageWithTheSimulatorAndTwoRecordings();
    openTheNewSourceFormOfKind('Reprodução');
    typeIntoField('Nome da fonte', 'Ensaio de sexta');
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Gravação' }), { key: 'Enter' });
    fireEvent.click(screen.getAllByRole('option')[0] as HTMLElement);
    pressButton('Salvar fonte');
    await waitFor(() => {
      expect(fakeServer.listCommandsReceived(), 'the replay must have been sent').toHaveLength(1);
    });
    fakeServer.refuseLastCommand({
      code: 'RECORDING_NOT_FOUND',
      message: 'A gravação não existe ou ainda está sendo gravada.',
    });
    await screen.findByRole('alert');
    pressButton('Cancelar');

    // Act: open a new simulator form.
    const newSimulatorForm = openTheNewSourceFormOfKind('Simulador');

    // Assert: the new form is clean; the old refusal was about the closed form.
    expect(
      newSimulatorForm.queryByRole('alert'),
      'a form that sent nothing must not show the refusal of another form',
    ).not.toBeInTheDocument();
  });
});

describe('"Editar" on a source', () => {
  it('sends updateDataSource with only the change, and closes once accepted', async () => {
    // Arrange: the simulator's form opened with "Editar", "Falha simulada" switched on.
    const { fakeServer } = renderPageWithTheSimulatorAndTwoRecordings();
    const sourceList = within(screen.getByRole('list', { name: 'Fontes de dados' }));
    fireEvent.click(sourceList.getByRole('button', { name: 'Editar' }));
    flipSwitch('Falha simulada');

    // Act: press "Salvar fonte" and the server accepts.
    pressButton('Salvar fonte');
    await waitFor(() => {
      expect(fakeServer.listCommandsReceived(), 'the change must have been sent').toHaveLength(1);
    });
    fakeServer.acceptLastCommand();

    // Assert: the whole config with the switch on (the label and interval did not
    // change), and the form gone.
    expect(fakeServer.listCommandsReceived(), 'only the changed config is sent').toEqual([
      {
        type: 'updateDataSource',
        sourceId: 'simulador-enduro',
        config: {
          seed: 2027,
          carCount: 60,
          sessionDurationMs: 14_400_000,
          lapLengthKm: 2,
          speed: 1,
          isFailing: true,
        },
      },
    ]);
    await waitFor(() => {
      expect(
        screen.queryByRole('region', { name: 'Editar fonte: Simulador — Enduro' }),
        'the form must close once the server accepted',
      ).not.toBeInTheDocument();
    });
  });

  it('closes when its source is deleted meanwhile', () => {
    // Arrange: the simulator's form opened with "Editar".
    const { fakeServer } = renderPageWithTheSimulatorAndTwoRecordings();
    const sourceList = within(screen.getByRole('list', { name: 'Fontes de dados' }));
    fireEvent.click(sourceList.getByRole('button', { name: 'Editar' }));
    const isTheFormOpenBefore =
      screen.queryByRole('region', { name: 'Editar fonte: Simulador — Enduro' }) !== null;

    // Act: another operator deletes the simulator.
    fakeServer.sendMessage({ type: 'slice', name: 'dataSources', slice: [] });

    // Assert: the form was open, and is gone with its source.
    expect(isTheFormOpenBefore, '"Editar" must have opened the form').toBe(true);
    expect(
      screen.queryByRole('region', { name: 'Editar fonte: Simulador — Enduro' }),
      'a form for a source that no longer exists could only be refused, so it must close',
    ).not.toBeInTheDocument();
  });
});
