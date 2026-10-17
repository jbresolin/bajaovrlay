/**
 * "Edição rápida": when something is wrong (apps/control)
 *
 * What this module is for:
 *   The panel must say plainly, in pt-BR, why an update did not happen: a field is empty
 *   or badly typed, the server refused the command, or there is no connection. Nothing
 *   on air may change by accident while one of those is true.
 *
 * What these tests prove:
 *   - A required field left empty, and a time typed with hours, show their pt-BR message
 *     under the field (naming the field) and nothing is sent.
 *   - When the server refuses an "Atualizar" (someone else has just cleared the
 *     graphic), its pt-BR message is shown in the panel, and it disappears after an
 *     update that works.
 *   - A refused `updateInstanceData` that this panel did not send (the item editor's
 *     "Atualizar no ar" sends that command too) is not shown under this panel's buttons,
 *     neither before this panel has sent anything nor after an update of its own went well.
 *   - While the page is not connected "Atualizar" is disabled and says why.
 *
 * What these tests deliberately do not cover:
 *   - What "Atualizar" sends when all is well: QuickEditPanel.test.tsx and
 *     QuickEditPanelUpdate.test.tsx.
 *   - A field message or a waiting command while someone else changes the graphic:
 *     QuickEditPanelOtherOperator.test.tsx.
 *   - Every rule and every message of a generated form: features/schemaForm lists them.
 *   - The real server and the real graphic.
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LayerStatusPanel } from '@/features/layers/LayerStatusPanel';
import {
  chooseOptionInDropdown,
  typeIntoField,
} from '@/features/schemaForm/schemaFormOnTestPage.testSupport';
import {
  focusAreaAroundDisabledButton,
  renderOnControlPageConnectedToFakeServer,
} from '@/state/controlPageOnFakeServer.testSupport';
import { useSendCommand } from '@/state/ControlPageStateProvider';
import {
  buildRaceClockInstanceOnTheClockLayer,
  buildSlicesWithTheRaceClockOnAir,
} from '@/state/slicesLikeTheServerSends.testSupport';

import {
  pressButtonAndWaitForCommand,
  pressEditOnTheLayerRow,
  referenceTimeLabel,
  renderQuickEditPanelWithTheseInstancesOnAir,
  waitUntilButtonIsOnAgain,
} from './operatingTheQuickEditPanel.testSupport';
import { QuickEditPanel } from './QuickEditPanel';

// The clock went on air at 9:45 in Brasília on the Saturday of the endurance race.
const quarterToTen = '2026-10-10T12:45:00.000Z';

/** Draws the panel with the race clock on air since 9:45, loaded with "Editar". */
function renderPanelWithTheRaceClockOnAir() {
  const controlPage = renderQuickEditPanelWithTheseInstancesOnAir([
    buildRaceClockInstanceOnTheClockLayer(quarterToTen),
  ]);
  pressEditOnTheLayerRow('Relógio');
  return controlPage;
}

/**
 * A button that stands in for the item editor's "Atualizar no ar": another part of the
 * page that sends `updateInstanceData` for an item's instance, without this panel.
 */
function ButtonStandingInForTheItemEditor() {
  const sendCommand = useSendCommand();
  return (
    <button
      type="button"
      onClick={() =>
        void sendCommand({
          type: 'updateInstanceData',
          instanceId: 'instancia-do-item-largada-do-enduro',
          data: { state: 'yellow' },
        })
      }
    >
      Atualizar no ar
    </button>
  );
}

describe('the quick edit panel when something is wrong', () => {
  it('shows the pt-BR message under an empty required field and sends nothing', async () => {
    // Arrange: the race clock loaded, with the session name erased.
    const { fakeServer } = renderPanelWithTheRaceClockOnAir();
    typeIntoField('Título', '');

    // Act: press "Atualizar".
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }));

    // Assert: the field explains what is missing, is marked invalid, and nothing was sent.
    expect(
      await screen.findByText('O campo "Título" é obrigatório.'),
      'the message for the missing session name must be on screen',
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText('Título'),
      'the field must be marked invalid for screen readers',
    ).toBeInvalid();
    expect(
      screen.getByLabelText('Título'),
      'the field must point at its help text and then its message for screen readers',
    ).toHaveAccessibleDescription(
      'Texto acima do relógio, ex.: Enduro de Resistência, Classificação O campo "Título" é obrigatório.',
    );
    expect(
      fakeServer.listCommandsReceived(),
      'a form with a missing field must not send any command',
    ).toEqual([]);
  });

  it('explains the mm:ss format when the reference time is typed with hours', async () => {
    // Arrange: the race clock loaded, with one hour typed as h:mm:ss.
    const { fakeServer } = renderPanelWithTheRaceClockOnAir();
    typeIntoField(referenceTimeLabel, '1:00:00');

    // Act: press "Atualizar".
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }));

    // Assert: the message shows the expected format, and nothing was sent.
    expect(
      await screen.findByText(
        `Use minutos e segundos no formato mm:ss em "${referenceTimeLabel}", por exemplo 12:30.`,
      ),
      'the message must explain how to type the time',
    ).toBeInTheDocument();
    expect(
      fakeServer.listCommandsReceived(),
      'a form with a badly typed time must not send any command',
    ).toEqual([]);
  });

  it('shows the server\'s pt-BR message when an "Atualizar" is refused', async () => {
    // Arrange: the race clock on air, the flag changed to yellow, and "Atualizar"
    // pressed, with the command on its way.
    const { fakeServer } = renderPanelWithTheRaceClockOnAir();
    chooseOptionInDropdown('Bandeira', 'Amarela');
    await pressButtonAndWaitForCommand('Atualizar', 1, fakeServer);

    // Act: the server answers that the instance is gone, as it does when another operator
    // cleared the clock layer a moment before.
    fakeServer.refuseLastCommand({
      code: 'INSTANCE_NOT_FOUND',
      message: 'Este gráfico não está mais no ar.',
    });

    // Assert: the panel shows the refusal in the server's own words, next to the button.
    expect(
      await screen.findByRole('alert'),
      "the panel must show the server's pt-BR message for a refused update",
    ).toHaveTextContent('Este gráfico não está mais no ar.');
  });

  it('removes the old error once a later update works', async () => {
    // Arrange: the race clock loaded, the flag changed, and the update refused.
    const { fakeServer } = renderPanelWithTheRaceClockOnAir();
    chooseOptionInDropdown('Bandeira', 'Amarela');
    await pressButtonAndWaitForCommand('Atualizar', 1, fakeServer);
    fakeServer.refuseLastCommand({
      code: 'INVALID_GRAPHIC_DATA',
      message: 'Os dados do gráfico "race-clock" não são válidos.',
    });
    await screen.findByRole('alert');
    await waitUntilButtonIsOnAgain('Atualizar');

    // Act: the operator presses "Atualizar" again, and this time the server accepts.
    await pressButtonAndWaitForCommand('Atualizar', 2, fakeServer);
    fakeServer.acceptLastCommand();

    // Assert: the message of the refused update is gone.
    await waitFor(() => {
      expect(
        screen.queryByRole('alert'),
        'the old error must disappear once an update works',
      ).toBeNull();
    });
  });

  it('does not show a refused update that another part of the page sent', async () => {
    // Arrange: the panel next to a button that sends `updateInstanceData` by itself, as
    // the item editor's "Atualizar no ar" does. That button is pressed.
    const { fakeServer, serverStateStore } = renderOnControlPageConnectedToFakeServer(
      <>
        <QuickEditPanel />
        <ButtonStandingInForTheItemEditor />
      </>,
      buildSlicesWithTheRaceClockOnAir(quarterToTen),
    );
    await pressButtonAndWaitForCommand('Atualizar no ar', 1, fakeServer);

    // Act: the server refuses that update.
    fakeServer.refuseLastCommand({
      code: 'INSTANCE_NOT_FOUND',
      message: 'Este gráfico não está mais no ar.',
    });

    // Assert: the page knows about the refusal, and this panel does not show it: the
    // operator did not press anything here, so the message belongs where they pressed.
    await waitFor(() => {
      expect(
        serverStateStore.getState().lastCommandError?.message,
        'the page must have heard the refusal',
      ).toBe('Este gráfico não está mais no ar.');
    });
    expect(
      screen.queryByRole('alert'),
      'a refusal of a command this panel did not send must not appear under its button',
    ).toBeNull();
  });

  it('does not show a refused update from another part of the page after its own update was accepted', async () => {
    // Arrange: the panel, Camadas and the button that stands in for the item editor. The
    // operator loads the clock, changes the flag, presses "Atualizar" and the server
    // accepts. Later the other button is pressed.
    const { fakeServer, serverStateStore } = renderOnControlPageConnectedToFakeServer(
      <>
        <QuickEditPanel />
        <LayerStatusPanel />
        <ButtonStandingInForTheItemEditor />
      </>,
      buildSlicesWithTheRaceClockOnAir(quarterToTen),
    );
    const clockLayerRow = within(screen.getByRole('listitem', { name: 'Relógio' }));
    fireEvent.click(clockLayerRow.getByRole('button', { name: 'Editar' }));
    chooseOptionInDropdown('Bandeira', 'Amarela');
    await pressButtonAndWaitForCommand('Atualizar', 1, fakeServer);
    fakeServer.acceptLastCommand();
    await waitUntilButtonIsOnAgain('Atualizar');
    await pressButtonAndWaitForCommand('Atualizar no ar', 2, fakeServer);

    // Act: the server refuses the other button's update.
    fakeServer.refuseLastCommand({
      code: 'INSTANCE_NOT_FOUND',
      message: 'Este gráfico não está mais no ar.',
    });

    // Assert: the page knows about the refusal, and this panel still does not show it.
    // Having sent a command of its own earlier does not make a later refusal its own.
    await waitFor(() => {
      expect(
        serverStateStore.getState().lastCommandError?.message,
        'the page must have heard the refusal',
      ).toBe('Este gráfico não está mais no ar.');
    });
    expect(
      screen.queryByRole('alert'),
      'only the refusal of the command this panel sent last may appear under its button',
    ).toBeNull();
  });

  it('disables "Atualizar" and says why while the connection is down', async () => {
    // Arrange: the race clock on air and loaded, so "Atualizar" exists.
    const { fakeServer } = renderPanelWithTheRaceClockOnAir();

    // Act: the line drops, and the operator reaches for "Atualizar".
    fakeServer.dropConnection();
    const updateButton = screen.getByRole('button', { name: 'Atualizar' });
    focusAreaAroundDisabledButton(updateButton);

    // Assert: the button cannot be pressed, and the tooltip explains it in pt-BR.
    expect(updateButton, '"Atualizar" cannot work without a connection').toBeDisabled();
    expect(
      await screen.findByRole('tooltip'),
      'the tooltip must tell the operator why the button is disabled',
    ).toHaveTextContent('Sem conexão com o servidor. Os comandos voltam quando ela voltar.');
  });
});
