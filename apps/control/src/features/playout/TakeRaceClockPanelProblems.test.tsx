/**
 * Take race clock panel: when something is wrong (apps/control)
 *
 * What this module is for:
 *   The race clock panel must say plainly, in pt-BR, why a take did not happen: a field
 *   is empty or badly typed, the server refused the command, or there is no connection.
 *   Nothing may go on air by accident while one of those is true.
 *
 * What these tests prove:
 *   - A missing or badly typed field shows its pt-BR message under the field and
 *     nothing is sent.
 *   - When the server refuses the take, its pt-BR message is shown in the panel, and it
 *     disappears after a take that works.
 *   - While the page is not connected both buttons are disabled and say why.
 *
 * What these tests deliberately do not cover:
 *   - What the two buttons send when all is well; TakeRaceClockPanel.test.tsx does.
 *   - Every rule and every mm:ss case: raceClockTakeForm.test.ts and
 *     minutesAndSeconds.test.ts list them one by one.
 *   - The real server and the real graphic; e2e/takeAndClear.e2e.ts uses the real server.
 *
 * These five tests were in TakeRaceClockPanel.test.tsx until gate 2, round 2; they moved
 * here unchanged to keep that file under the 400-line limit.
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

import { typeIntoField } from './operatingTheRaceClockForm.testSupport';
import { TakeRaceClockPanel } from './TakeRaceClockPanel';

// 10:00 in Brasília on the Saturday of the endurance race, which the panel is told is "now".
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

describe('the take race clock panel when something is wrong', () => {
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
