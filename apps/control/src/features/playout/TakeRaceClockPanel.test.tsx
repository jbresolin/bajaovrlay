/**
 * Take race clock panel (apps/control)
 *
 * What this module is for:
 *   The panel where the operator fills the race clock's data and puts it on air with
 *   "Colocar no ar". While the clock is on air a second button, "Atualizar", sends the
 *   form again so the flag or the time can change without clearing the layer first.
 *
 * What these tests prove:
 *   - The form opens with the manifest's defaults, and "Atualizar" exists only while
 *     the race clock is on air.
 *   - "Colocar no ar" sends one `takeGraphic` command built from what was typed and
 *     chosen, with the moment of the press as the clock's reference.
 *   - "Atualizar" sends the same kind of command with the changed data.
 *   - A missing or badly typed field shows its pt-BR message under the field and
 *     nothing is sent.
 *   - When the server refuses the take, its pt-BR message is shown in the panel, and it
 *     disappears after a take that works.
 *   - While the page is not connected both buttons are disabled and say why.
 *
 * What these tests deliberately do not cover:
 *   - Every rule and every mm:ss case: raceClockTakeForm.test.ts lists them one by one.
 *   - The real server and the real graphic; e2e/takeAndClear.e2e.ts uses the real server.
 *   - Filling the form back in from what is on air after a page reload: M0 does not do it.
 */
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  focusAreaAroundDisabledButton,
  renderOnControlPageConnectedToFakeServer,
} from '@/state/controlPageOnFakeServer.testSupport';
import {
  buildSlicesWithNothingOnAir,
  buildSlicesWithTheRaceClockOnAir,
} from '@/state/slicesLikeTheServerSends.testSupport';

import { TakeRaceClockPanel } from './TakeRaceClockPanel';

// 10:00 in Brasília on the Saturday of the endurance race. The panel is told this is
// "now", so the tests know exactly which reference moment the command must carry.
const momentOfThePressInMilliseconds = Date.parse('2026-10-10T13:00:00.000Z');

/** Draws the panel on a connected page with nothing on air, with "now" held still. */
function renderPanelWithNothingOnAir() {
  return renderOnControlPageConnectedToFakeServer(
    <TakeRaceClockPanel readCurrentTimeInMilliseconds={() => momentOfThePressInMilliseconds} />,
    buildSlicesWithNothingOnAir(),
  );
}

/** Draws the panel on a connected page with the race clock already on air. */
function renderPanelWithTheRaceClockOnAir() {
  return renderOnControlPageConnectedToFakeServer(
    <TakeRaceClockPanel readCurrentTimeInMilliseconds={() => momentOfThePressInMilliseconds} />,
    buildSlicesWithTheRaceClockOnAir('2026-10-10T12:45:00.000Z'),
  );
}

/**
 * Draws the panel as it looks after a take the server refused: the server's message is
 * on screen and "Colocar no ar" can be pressed again.
 */
async function renderPanelShowingARefusedTake() {
  const controlPage = renderPanelWithNothingOnAir();
  fireEvent.click(screen.getByRole('button', { name: 'Colocar no ar' }));
  await waitFor(() => {
    expect(
      controlPage.fakeServer.listCommandsReceived(),
      'the take that will be refused must have been sent',
    ).toHaveLength(1);
  });
  controlPage.fakeServer.refuseLastCommand({
    code: 'GRAPHIC_NOT_FOUND',
    message: 'O gráfico "race-clock" não está registrado.',
  });
  await screen.findByRole('alert');
  // The button is off while the page waits for an answer, so wait for it to be back on.
  await waitFor(() => {
    expect(
      screen.getByRole('button', { name: 'Colocar no ar' }),
      'the button must come back once the server has answered',
    ).toBeEnabled();
  });
  return controlPage;
}

/** Types into a text field found by its label, replacing what was there. */
function typeIntoField(fieldLabel: string, text: string) {
  fireEvent.change(screen.getByLabelText(fieldLabel), { target: { value: text } });
}

/** Opens a dropdown found by its label and picks one of its options. */
function chooseOptionInDropdown(dropdownLabel: string, optionLabel: string) {
  fireEvent.keyDown(screen.getByRole('combobox', { name: dropdownLabel }), { key: 'Enter' });
  fireEvent.click(screen.getByRole('option', { name: optionLabel }));
}

describe('the take race clock panel', () => {
  it('opens with the default values and only the "Colocar no ar" button', () => {
    // Arrange: nothing on air.

    // Act: draw the panel.
    renderPanelWithNothingOnAir();

    // Assert: each field shows its default, and there is nothing to update yet.
    expect(
      screen.getByLabelText('Nome da sessão'),
      'the session name must start as the manifest default',
    ).toHaveValue('Enduro de Resistência');
    expect(
      screen.getByRole('combobox', { name: 'Bandeira' }),
      'the flag must start as "Pré-largada"',
    ).toHaveTextContent('Pré-largada');
    expect(
      screen.getByRole('combobox', { name: 'Modo do relógio' }),
      'the clock mode must start as "Tempo decorrido"',
    ).toHaveTextContent('Tempo decorrido');
    expect(
      screen.getByRole('switch', { name: 'Relógio correndo' }),
      'the clock must start stopped',
    ).not.toBeChecked();
    expect(
      screen.getByLabelText('Tempo de referência (mm:ss)'),
      'the reference time must start at zero',
    ).toHaveValue('0:00');
    expect(
      screen.getByLabelText('Voltas do líder (opcional)'),
      'the laps must start blank',
    ).toHaveValue('');
    expect(
      screen.getByRole('button', { name: 'Colocar no ar' }),
      'the take button must be there',
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Atualizar' }),
      'there is nothing to update while the clock is off air',
    ).toBeNull();
  });

  it('sends takeGraphic with what was typed and chosen when "Colocar no ar" is pressed', async () => {
    // Arrange: the panel filled for the endurance race, 12 min 34 s in, under green.
    const { fakeServer } = renderPanelWithNothingOnAir();
    typeIntoField('Nome da sessão', 'Enduro de Resistência — Bateria 1');
    chooseOptionInDropdown('Bandeira', 'Verde');
    chooseOptionInDropdown('Modo do relógio', 'Tempo restante');
    fireEvent.click(screen.getByRole('switch', { name: 'Relógio correndo' }));
    typeIntoField('Tempo de referência (mm:ss)', '12:34');
    typeIntoField('Voltas do líder (opcional)', '7');

    // Act: press "Colocar no ar".
    fireEvent.click(screen.getByRole('button', { name: 'Colocar no ar' }));

    // Assert: one takeGraphic reached the server, carrying exactly the form's data.
    await waitFor(() => {
      expect(
        fakeServer.listCommandsReceived(),
        'the press must send exactly one takeGraphic with the form data',
      ).toEqual([
        {
          type: 'takeGraphic',
          graphicId: 'race-clock',
          layerId: 'clock',
          data: {
            sessionName: 'Enduro de Resistência — Bateria 1',
            state: 'green',
            clockMode: 'remaining',
            referenceTimeMs: 754_000,
            referenceWallClockMs: momentOfThePressInMilliseconds,
            running: true,
            lapsCompletedByLeader: 7,
          },
        },
      ]);
    });
    // (Then the server answers, so no command is left waiting for its 5-second timeout
    // once the test is over.)
    fakeServer.acceptLastCommand();
  });

  it('offers "Atualizar" while the race clock is on air, and it sends the changed data', async () => {
    // Arrange: the race clock on air; the operator changes the flag to yellow.
    const { fakeServer } = renderPanelWithTheRaceClockOnAir();
    chooseOptionInDropdown('Bandeira', 'Amarela');

    // Act: press "Atualizar".
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }));

    // Assert: a takeGraphic for the same layer was sent with the yellow flag. The server
    // replaces the instance on that layer; there is no separate "update" command yet.
    await waitFor(() => {
      expect(
        fakeServer.listCommandsReceived(),
        '"Atualizar" must send one takeGraphic carrying the new flag',
      ).toEqual([
        {
          type: 'takeGraphic',
          graphicId: 'race-clock',
          layerId: 'clock',
          data: {
            sessionName: 'Enduro de Resistência',
            state: 'yellow',
            clockMode: 'elapsed',
            referenceTimeMs: 0,
            referenceWallClockMs: momentOfThePressInMilliseconds,
            running: false,
          },
        },
      ]);
    });
    // (Then the server answers, so no command is left waiting for its 5-second timeout
    // once the test is over.)
    fakeServer.acceptLastCommand();
  });

  it('shows the pt-BR message under an empty required field and sends nothing', async () => {
    // Arrange: the panel with the session name erased.
    const { fakeServer } = renderPanelWithNothingOnAir();
    typeIntoField('Nome da sessão', '');

    // Act: press "Colocar no ar".
    fireEvent.click(screen.getByRole('button', { name: 'Colocar no ar' }));

    // Assert: the field explains what is missing, is marked invalid, and nothing was sent.
    expect(
      await screen.findByText('Informe o nome da sessão.'),
      'the message for the missing session name must be on screen',
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText('Nome da sessão'),
      'the field must be marked invalid for screen readers',
    ).toBeInvalid();
    expect(
      screen.getByLabelText('Nome da sessão'),
      'the field must point at its message for screen readers',
    ).toHaveAccessibleDescription('Informe o nome da sessão.');
    expect(
      fakeServer.listCommandsReceived(),
      'a form with a missing field must not send any command',
    ).toEqual([]);
  });

  it('explains the mm:ss format when the reference time is typed with hours', async () => {
    // Arrange: the panel with one hour typed as h:mm:ss.
    const { fakeServer } = renderPanelWithNothingOnAir();
    typeIntoField('Tempo de referência (mm:ss)', '1:00:00');

    // Act: press "Colocar no ar".
    fireEvent.click(screen.getByRole('button', { name: 'Colocar no ar' }));

    // Assert: the message shows the expected format, and nothing was sent.
    expect(
      await screen.findByText('Use minutos e segundos no formato mm:ss, por exemplo 12:30.'),
      'the message must explain how to type the time',
    ).toBeInTheDocument();
    expect(
      fakeServer.listCommandsReceived(),
      'a form with a badly typed time must not send any command',
    ).toEqual([]);
  });

  it("shows the server's pt-BR message when the take is refused", async () => {
    // Arrange: the panel with "Colocar no ar" pressed, and the take on its way.
    const { fakeServer } = renderPanelWithNothingOnAir();
    fireEvent.click(screen.getByRole('button', { name: 'Colocar no ar' }));
    await waitFor(() => {
      expect(fakeServer.listCommandsReceived(), 'the take must have been sent').toHaveLength(1);
    });

    // Act: the server answers that the race clock package is not registered (not built).
    fakeServer.refuseLastCommand({
      code: 'GRAPHIC_NOT_FOUND',
      message: 'O gráfico "race-clock" não está registrado.',
    });

    // Assert: the panel shows the refusal in the server's own words.
    expect(
      await screen.findByRole('alert'),
      "the panel must show the server's pt-BR message",
    ).toHaveTextContent('O gráfico "race-clock" não está registrado.');
  });

  it('removes the old error once a later take works', async () => {
    // Arrange: the panel showing the message of a take the server refused.
    const { fakeServer } = await renderPanelShowingARefusedTake();

    // Act: the operator presses "Colocar no ar" again, and this time the server accepts.
    fireEvent.click(screen.getByRole('button', { name: 'Colocar no ar' }));
    await waitFor(() => {
      expect(fakeServer.listCommandsReceived(), 'the retry must have been sent').toHaveLength(2);
    });
    fakeServer.acceptLastCommand();

    // Assert: the message of the refused take is gone.
    await waitFor(() => {
      expect(
        screen.queryByRole('alert'),
        'the old error must disappear once a take works',
      ).toBeNull();
    });
  });

  it('disables both buttons and says why while the connection is down', async () => {
    // Arrange: the race clock on air, so both buttons exist.
    const { fakeServer } = renderPanelWithTheRaceClockOnAir();

    // Act: the line drops, and the operator reaches for "Colocar no ar".
    fakeServer.dropConnection();
    const takeButton = screen.getByRole('button', { name: 'Colocar no ar' });
    const updateButton = screen.getByRole('button', { name: 'Atualizar' });
    focusAreaAroundDisabledButton(takeButton);

    // Assert: neither button can be pressed, and the tooltip explains it in pt-BR.
    expect(takeButton, '"Colocar no ar" cannot work without a connection').toBeDisabled();
    expect(updateButton, '"Atualizar" cannot work without a connection').toBeDisabled();
    expect(
      await screen.findByRole('tooltip'),
      'the tooltip must tell the operator why the buttons are disabled',
    ).toHaveTextContent('Sem conexão com o servidor. Os comandos voltam quando ela voltar.');
  });
});
