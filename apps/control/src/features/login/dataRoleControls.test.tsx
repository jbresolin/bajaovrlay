/**
 * What the Dados role can press on the console (apps/control)
 *
 * What this module is for:
 *   With the PINs set (BAJAOVRLAY-29), an operator logged in as Dados prepares the show but
 *   never changes what is on program or preview. The page shows the same layout to both
 *   roles, so two operators can talk about the same buttons: a control Dados may not use is
 *   greyed out, never hidden, and its tooltip says why ("O papel Dados não pode …"). Its
 *   keyboard shortcuts do nothing. The server refuses such a command anyway; the page only
 *   keeps Dados from pressing something that would be refused.
 *
 * What these tests prove:
 *   - The monitors' "Tomar" is greyed out for Dados with the role's tooltip, and sends
 *     nothing; for the Produtor it sends takePreview, as before.
 *   - Camadas' "Limpar" and "Desfazer", and "Desfazer última", are greyed out for Dados.
 *   - Esc ("Limpar tudo", twice), Ctrl+Z ("Desfazer última") and Space (the rundown's next
 *     item) send nothing for Dados; Esc twice still clears everything for the Produtor.
 *   - A button that prepares the show (an ActionButton for createItem) stays pressable
 *     for Dados.
 *   - With the login off (no PINs) nothing is greyed out for a role: there is none.
 *
 * What these tests deliberately do not cover:
 *   - Which command each role may send; the shared list's commandSenders.test.ts.
 *   - The server's refusal; apps/server's authorizeCommandsByRole.test.ts.
 *   - Every greyed-out button of the page: these are the ones the brief names, and the
 *     rest use the same ActionButton with their command's type.
 */
import type { ProgramHistory, SessionAnswer, Slices } from '@bajaovrlay/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ActionButton } from '@/features/connection/ActionButton';
import { LayerStatusPanel } from '@/features/layers/LayerStatusPanel';
import { PreviewedLayersList } from '@/features/outputMonitors/PreviewedLayersList';
import { ClearAllButton } from '@/features/playout/ClearAllButton';
import { RundownPanel } from '@/features/rundown/RundownPanel';
import { UndoLastChangeButton } from '@/features/undo/UndoLastChangeButton';
import { renderOnControlPageConnectedToFakeServer } from '@/state/controlPageOnFakeServer.testSupport';
import { buildRaceClockPreviewOfItem } from '@/state/previewLikeTheServerSends.testSupport';
import {
  buildSlicesWithTheEnduranceRundown,
  enduranceStartItemId,
} from '@/state/rundownLikeTheServerSends.testSupport';
import { buildRaceClockInstanceOnTheClockLayer } from '@/state/slicesLikeTheServerSends.testSupport';

// The item editor has its own tests; a stand-in takes its place here.
vi.mock('@/features/items/ItemEditorPanel', () => import('../rundown/itemEditorStandIn.testSupport'));

// Saturday of the endurance race, 10:00 in São Paulo.
const momentOfTheRace = '2026-10-10T13:00:00.000Z';
const theRoleTooltipOfATake = 'O papel Dados não pode mudar o que está no ar. Peça ao Produtor.';

const dataRoleAtMesa2: SessionAnswer = {
  isLoginRequired: true,
  session: { role: 'dados', station: 'Mesa 2', expiresAt: '2026-10-11T07:00:00.000Z' },
};
const producerAtMesa1: SessionAnswer = {
  isLoginRequired: true,
  session: { role: 'produtor', station: 'Mesa 1', expiresAt: '2026-10-11T07:00:00.000Z' },
};
const loginTurnedOff: SessionAnswer = { isLoginRequired: false, session: null };

/**
 * The endurance rundown with its cursor on the start, the race clock on air on the clock
 * layer, the start previewed, and one change of program remembered (the clock's take).
 */
function buildSlicesOfARaceInProgress(): Slices {
  const programHistory: ProgramHistory = [
    {
      layerId: 'clock',
      entries: [{ changeNumber: 1, changedAt: momentOfTheRace, shownBefore: { kind: 'empty' } }],
    },
  ];
  return {
    ...buildSlicesWithTheEnduranceRundown(enduranceStartItemId),
    instances: [
      buildRaceClockInstanceOnTheClockLayer(momentOfTheRace),
      buildRaceClockPreviewOfItem(enduranceStartItemId, momentOfTheRace),
    ],
    programHistory,
  };
}

/** Draws the console's pieces that send takes, clears and undos, logged in as given. */
function renderTheConsoleLoggedInAs(sessionAnswer: SessionAnswer) {
  return renderOnControlPageConnectedToFakeServer(
    <>
      <PreviewedLayersList />
      <LayerStatusPanel />
      <UndoLastChangeButton />
      <ClearAllButton />
      <RundownPanel />
    </>,
    buildSlicesOfARaceInProgress(),
    { sessionAnswer },
  );
}

/** The clock's line of the monitors' list of previews: the "Relógio" line with "Tomar". */
function findThePreviewLineOfTheClock() {
  const previewList = screen.getByRole('list', { name: 'Em prévia' });
  return within(within(previewList).getByRole('listitem', { name: 'Relógio' }));
}

/**
 * The clock's row of Camadas: the "Relógio" line that has a "Limpar" button (the preview
 * list has a "Relógio" line of its own, with "Tomar" and "Descartar").
 */
function findTheCamadasRowOfTheClock() {
  const clockLines = screen.getAllByRole('listitem', { name: 'Relógio' });
  const camadasRow = clockLines.find(
    (line) => within(line).queryByRole('button', { name: 'Limpar' }) !== null,
  );
  if (camadasRow === undefined) {
    throw new Error('Camadas must have a row for the clock layer');
  }
  return within(camadasRow);
}

/** Reads the tooltip a greyed-out button opens when the keyboard reaches its area. */
async function readTheTooltipOfGreyedOutButton(button: HTMLElement): Promise<string> {
  const areaAroundTheButton = button.parentElement;
  if (areaAroundTheButton === null) {
    throw new Error('a greyed-out button sits in an area that carries its tooltip');
  }
  fireEvent.focus(areaAroundTheButton);
  const tooltip = await waitFor(() => screen.getByRole('tooltip'));
  return tooltip.textContent ?? '';
}

describe('the monitors’ "Tomar"', () => {
  it('is greyed out for Dados, says why, and sends nothing', async () => {
    // Arrange: the console of Dados at "Mesa 2", the start previewed on the clock layer.
    const { fakeServer } = renderTheConsoleLoggedInAs(dataRoleAtMesa2);
    const previewLine = findThePreviewLineOfTheClock();
    const takeButton = previewLine.getByRole('button', { name: 'Tomar' });

    // Act: try to press "Tomar", then rest on it to see why nothing happened.
    fireEvent.click(takeButton);
    const tooltip = await readTheTooltipOfGreyedOutButton(takeButton);

    // Assert: off, nothing sent, and the role's sentence in the tooltip.
    expect(takeButton, '"Tomar" is greyed out for Dados, never hidden').toBeDisabled();
    expect(fakeServer.listCommandsReceived(), 'Dados’s press sends nothing').toEqual([]);
    expect(tooltip, 'the tooltip says why, in pt-BR').toBe(theRoleTooltipOfATake);
  });

  it('sends takePreview for the Produtor, as before', () => {
    // Arrange: the console of the Produtor at "Mesa 1".
    const { fakeServer } = renderTheConsoleLoggedInAs(producerAtMesa1);
    const previewLine = findThePreviewLineOfTheClock();

    // Act: press "Tomar" on the clock's preview.
    fireEvent.click(previewLine.getByRole('button', { name: 'Tomar' }));

    // Assert: the take of the preview went out.
    expect(fakeServer.listCommandsReceived(), 'the Produtor takes the preview').toEqual([
      { type: 'takePreview', layerId: 'clock' },
    ]);
  });
});

describe('Camadas and "Desfazer última"', () => {
  const greyedOutButtons = [
    // Taking the clock off air.
    { name: '"Limpar" on the clock’s row is greyed out for Dados', buttonName: 'Limpar' },
    // Putting back what the clock layer showed before.
    { name: '"Desfazer" on the clock’s row is greyed out for Dados', buttonName: 'Desfazer' },
  ];

  it.each(greyedOutButtons)('$name', async ({ buttonName }) => {
    // Arrange: the console of Dados at "Mesa 2".
    renderTheConsoleLoggedInAs(dataRoleAtMesa2);
    const clockRow = findTheCamadasRowOfTheClock();

    // Act: rest on the row's button.
    const button = clockRow.getByRole('button', { name: buttonName });
    const tooltip = await readTheTooltipOfGreyedOutButton(button);

    // Assert: off, with the role's sentence.
    expect(button, `"${buttonName}" is greyed out for Dados`).toBeDisabled();
    expect(tooltip, 'the tooltip says why, in pt-BR').toBe(theRoleTooltipOfATake);
  });

  it('greys out "Desfazer última" for Dados', () => {
    // Arrange: the console of Dados at "Mesa 2", with a change to undo.
    renderTheConsoleLoggedInAs(dataRoleAtMesa2);

    // Act: find "Desfazer última".
    const undoLastButton = screen.getByRole('button', { name: 'Desfazer última' });

    // Assert: off.
    expect(undoLastButton, '"Desfazer última" is greyed out for Dados').toBeDisabled();
  });
});

describe('the keyboard shortcuts', () => {
  const shortcutsOfDados = [
    // "Limpar tudo" asks for a second press: two Esc presses would clear everything.
    {
      name: 'Esc twice sends nothing for Dados',
      presses: [{ key: 'Escape' }, { key: 'Escape' }],
    },
    // "Desfazer última".
    { name: 'Ctrl+Z sends nothing for Dados', presses: [{ key: 'z', ctrlKey: true }] },
    // The rundown's next item, or the preview of it, on air.
    { name: 'Space sends nothing for Dados', presses: [{ key: ' ' }] },
  ];

  it.each(shortcutsOfDados)('$name', ({ presses }) => {
    // Arrange: the console of Dados at "Mesa 2".
    const { fakeServer } = renderTheConsoleLoggedInAs(dataRoleAtMesa2);

    // Act: press the row's keys with the focus on the page itself.
    for (const press of presses) {
      fireEvent.keyDown(document.body, press);
    }

    // Assert: nothing was sent.
    expect(fakeServer.listCommandsReceived(), 'a shortcut Dados may not use does nothing').toEqual(
      [],
    );
  });

  it('lets the Produtor clear everything with Esc twice, as before', () => {
    // Arrange: the console of the Produtor at "Mesa 1".
    const { fakeServer } = renderTheConsoleLoggedInAs(producerAtMesa1);

    // Act: Esc, then Esc again to confirm.
    fireEvent.keyDown(document.body, { key: 'Escape' });
    fireEvent.keyDown(document.body, { key: 'Escape' });

    // Assert: "Limpar tudo" went out.
    expect(fakeServer.listCommandsReceived(), 'the Produtor’s Esc clears everything').toEqual([
      { type: 'clearAll' },
    ]);
  });
});

describe('a button that prepares the show, and the login off', () => {
  it('leaves a createItem button pressable for Dados', () => {
    // Arrange: a button that sends createItem, on the page of Dados at "Mesa 2".
    const notePress = vi.fn();
    renderOnControlPageConnectedToFakeServer(
      <ActionButton commandType="createItem" onClick={notePress}>
        Salvar
      </ActionButton>,
      buildSlicesOfARaceInProgress(),
      { sessionAnswer: dataRoleAtMesa2 },
    );

    // Act: press it.
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    // Assert: the press went through.
    expect(notePress, 'Dados prepares items').toHaveBeenCalledTimes(1);
  });

  it('greys nothing out for a role while the login is off', () => {
    // Arrange: the console of a server with no PINs.
    const { fakeServer } = renderTheConsoleLoggedInAs(loginTurnedOff);
    const previewLine = findThePreviewLineOfTheClock();

    // Act: press "Tomar" on the clock's preview.
    fireEvent.click(previewLine.getByRole('button', { name: 'Tomar' }));

    // Assert: the take went out, as before the login existed.
    expect(fakeServer.listCommandsReceived(), 'no PINs, no roles').toEqual([
      { type: 'takePreview', layerId: 'clock' },
    ]);
  });
});
