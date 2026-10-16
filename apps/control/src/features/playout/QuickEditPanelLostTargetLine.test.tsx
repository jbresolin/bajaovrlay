/**
 * The line that says the edited instance is gone, in "Edição rápida" (apps/control)
 *
 * What this module is for:
 *   When the instance loaded into "Edição rápida" leaves its output or is replaced, the
 *   panel goes back to a new entry and one line says what became of it ("… saiu do ar" or
 *   "… foi substituído no ar"). The review of BAJAOVRLAY-36 found that line never went
 *   away, and that its words could change after the fact: worked out again from the
 *   server's instances on every draw, a take made later on the old layer turned "saiu do
 *   ar" into "foi substituído", which never happened to the edited instance. So the panel
 *   writes the words down when it first sees the loss, and lets go of the line when the
 *   operator moves on from it in the panel.
 *
 * What these tests prove:
 *   - After "saiu do ar", a later take on that layer leaves the words as they were.
 *   - Choosing another layer for the new entry takes the line away, and "Prévia" then
 *     goes to that layer with no line naming the old one.
 *   - Sending the new entry ("Prévia" accepted, or "Colocar no ar" even when refused)
 *     takes the line away: the operator has acted on it.
 *   - Decided here: a command sent from elsewhere on the page ("Limpar" on a "Camadas"
 *     row) leaves the line, because only the panel and "Editar" write what it works on.
 *
 * What these tests deliberately do not cover:
 *   - How the line first appears, and its words on program and in preview:
 *     QuickEditPanelTarget.test.tsx and quickEditMode.test.ts.
 *   - The layer dropdown itself: QuickEditPanelNewTakeLayer.test.tsx.
 */
import type { Instance } from '@bajaovrlay/shared';
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { chooseOptionInDropdown } from '@/features/schemaForm/schemaFormOnTestPage.testSupport';

import {
  buildRaceClockInstanceHoldingThisData,
  pressButtonAndWaitForCommand,
  pressEditOnTheLayerRow,
  renderQuickEditPanelWithTheseInstancesOnAir,
  waitUntilButtonIsOnAgain,
} from './operatingTheQuickEditPanel.testSupport';

// Saturday of the endurance race: the main clock went on air at 10:00.
const momentTheMainClockWentOnAir = '2026-10-10T13:00:00.000Z';
const idOfTheClockTakenLater = 'a90c2e61-1f4b-4d7e-b3a8-6c5d4e3f2a10';

const lineSayingTheClockLeftTheAir =
  'O que você editava na camada Relógio saiu do ar. Os valores continuam no formulário, como nova entrada.';

/** The endurance clock on the "Relógio" layer under green, running from 12:34. */
function buildEnduranceClockOnTheClockLayer(): Instance {
  return buildRaceClockInstanceHoldingThisData(
    {
      sessionName: 'Enduro de Resistência',
      state: 'green',
      clockMode: 'elapsed',
      referenceTimeMs: 754_000,
      referenceWallClockMs: Date.parse(momentTheMainClockWentOnAir),
      running: true,
    },
    momentTheMainClockWentOnAir,
  );
}

/**
 * Opens the page with the endurance clock on air, loads it with "Editar" and lets
 * someone clear the clock layer, so the panel shows the line "… saiu do ar".
 */
function openThePanelWithTheEditedClockJustCleared() {
  const page = renderQuickEditPanelWithTheseInstancesOnAir([buildEnduranceClockOnTheClockLayer()]);
  pressEditOnTheLayerRow('Relógio');
  page.fakeServer.sendMessage({ type: 'slice', name: 'instances', slice: [] });
  return page;
}

/** True while the panel shows any line about an instance it was editing. */
function isALineAboutTheLostInstanceShown(): boolean {
  return screen.queryByText(/O que você editava/) !== null;
}

describe('the line about an edited instance that is gone', () => {
  it('keeps saying "saiu do ar" when a take puts another clock on that layer afterwards', () => {
    // Arrange: the edited clock was cleared, and the panel says so.
    const { fakeServer } = openThePanelWithTheEditedClockJustCleared();
    const isTheLineShownAfterTheClear = screen.queryByText(lineSayingTheClockLeftTheAir) !== null;

    // Act: a take from the rundown puts another clock on the clock layer.
    fakeServer.sendMessage({
      type: 'slice',
      name: 'instances',
      slice: [{ ...buildEnduranceClockOnTheClockLayer(), id: idOfTheClockTakenLater }],
    });

    // Assert: the line still says the edited clock left the air; it was never replaced.
    expect(isTheLineShownAfterTheClear, 'the clear must first be reported').toBe(true);
    expect(
      screen.getByText(lineSayingTheClockLeftTheAir),
      'what became of the edited clock must not be rewritten by a later take',
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/foi substituído/),
      'a take made after the clock was gone is not a replacement of it',
    ).toBeNull();
  });

  it('goes away when the operator chooses another layer, and "Prévia" goes to that layer', async () => {
    // Arrange: the edited clock was cleared, and the panel says so.
    const { fakeServer } = openThePanelWithTheEditedClockJustCleared();

    // Act: choose the "Tarja" layer for the new entry, then press "Prévia".
    chooseOptionInDropdown('Camada da nova entrada', 'Tarja');
    const isTheLineShownAfterChoosingTheLayer = isALineAboutTheLostInstanceShown();
    await pressButtonAndWaitForCommand('Prévia', 1, fakeServer);
    fakeServer.acceptLastCommand();
    await waitUntilButtonIsOnAgain('Prévia');

    // Assert: no line about the clock layer once another layer was chosen, and the
    // preview went to the layer chosen.
    expect(
      isTheLineShownAfterChoosingTheLayer,
      'choosing another layer moves on from the lost clock, so its line must go',
    ).toBe(false);
    expect(
      fakeServer.listCommandsReceived(),
      '"Prévia" must go to the layer chosen, not to the old one',
    ).toEqual([expect.objectContaining({ type: 'previewGraphic', layerId: 'lower-third' })]);
    expect(
      isALineAboutTheLostInstanceShown(),
      'after the preview no line may name the old layer',
    ).toBe(false);
  });

  const sendScenarios = [
    // The operator previews what was typed, on the same layer: the server accepts it.
    {
      name: 'goes away when the new entry is sent as "Prévia"',
      buttonName: 'Prévia',
      isAccepted: true,
    },
    // Refused or not, the operator has acted on the line; it would only mislead from now on.
    {
      name: 'goes away when the new entry is sent as "Colocar no ar", even when it is refused',
      buttonName: 'Colocar no ar',
      isAccepted: false,
    },
  ];

  it.each(sendScenarios)('$name', async ({ buttonName, isAccepted }) => {
    // Arrange: the edited clock was cleared, and the panel says so.
    const { fakeServer } = openThePanelWithTheEditedClockJustCleared();

    // Act: press the button; the server answers ok, or refuses.
    await pressButtonAndWaitForCommand(buttonName, 1, fakeServer);
    if (isAccepted) {
      fakeServer.acceptLastCommand();
    } else {
      fakeServer.refuseLastCommand({
        code: 'INVALID_GRAPHIC_DATA',
        message: 'Os dados do gráfico "race-clock" não são válidos.',
      });
    }
    await waitUntilButtonIsOnAgain(buttonName);

    // Assert: the line is gone, and the panel is still a new entry.
    expect(
      isALineAboutTheLostInstanceShown(),
      `after "${buttonName}" from the new entry the line about the lost clock must be gone`,
    ).toBe(false);
    expect(
      screen.getByRole('heading', { level: 3 }),
      'the panel stays a new entry',
    ).toHaveTextContent('Nova entrada — não altera nenhum item');
  });

  it('stays when a command is sent from elsewhere on the page', () => {
    // Arrange: the edited clock was cleared, and the panel says so.
    const { fakeServer } = openThePanelWithTheEditedClockJustCleared();

    // Act: "Limpar" on the "Tarja" row of "Camadas"; the server accepts it.
    const lowerThirdRow = within(screen.getByRole('listitem', { name: 'Tarja' }));
    fireEvent.click(lowerThirdRow.getByRole('button', { name: 'Limpar' }));
    fakeServer.acceptLastCommand();

    // Assert: the line is still there, with the same words.
    expect(
      fakeServer.listCommandsReceived(),
      'the only command is the clear of the lower-third layer',
    ).toEqual([{ type: 'clearLayer', layerId: 'lower-third' }]);
    expect(
      screen.getByText(lineSayingTheClockLeftTheAir),
      'only the panel itself and "Editar" may change what the panel says',
    ).toBeInTheDocument();
  });
});
