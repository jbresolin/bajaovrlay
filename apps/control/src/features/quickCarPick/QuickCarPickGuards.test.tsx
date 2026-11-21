/**
 * "Escolher carros": what keeps it from sending the wrong thing (apps/control)
 *
 * What this module is for:
 *   "Escolher carros" (BAJAOVRLAY-82) changes the battle card's cars from a quick-fire
 *   button in seconds, during a race. These are the guards around it: it never saves a pair
 *   the source cannot fill, never sends anything after the operator closed it, says why it
 *   has no source, shows when the positions are stale, never leaves the old pair waiting in
 *   "Prévia", stays closed to Dados, moves on with Enter, and keeps its keys from the
 *   page's shortcuts.
 *
 * What these tests prove:
 *   - "Disputa pela 5ª posição" with five cars listed is refused under its box, and
 *     nothing is sent.
 *   - Esc while the save waits closes the box, and once the save is accepted nothing is
 *     taken.
 *   - With two sources sending positions and an item that reads neither, the box says so
 *     and its buttons are off.
 *   - A stale source shows "fonte atrasada" beside its name.
 *   - "No ar" for an item also in "Prévia" (automatic) previews it again with the new cars,
 *     keeping the preview automatic, before the take.
 *   - Dados sees the chevron and the menu entry off.
 *   - Enter moves from the car ahead to the car behind, and from there to "Prévia".
 *   - A digit pressed on the box's tabs does not fire the strip's 1st button.
 *
 * What these tests deliberately do not cover:
 *   - The box's ordinary path (open, type, save, take): QuickCarPickOnAQuickFireButton.test.tsx.
 *   - Space on "No ar" not reaching the rundown's Space: QuickCarPickOnARundownRow.test.tsx
 *     and, in a real browser, e2e/quickBattlePick.e2e.ts.
 */
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { letThePageFinishWhatItStarted } from '@/state/controlPageOnFakeServer.testSupport';

import {
  battleCardLabel,
  buildBattleCardButton,
  buildFieldsOfCar47AheadAndCar52Behind,
  buildSlicesWithFiveCarsListed,
  buildSlicesWithTheBattleCardButton,
  buildSlicesWithTheBattleCardButtonInPreview,
  buildSlicesWithTheSimulatorLate,
  buildSlicesWithTwoSourcesAndTheCardTypedByHand,
} from './battleCardButton.testSupport';
import {
  dataRoleAtMesa2,
  drawTheStripWithTheBattleCard,
  openTheBoxWithTheChevron,
} from './quickCarPickOnTheStrip.testSupport';

const battleCardItemId = buildBattleCardButton().id;

describe('what "Escolher carros" refuses to send', () => {
  it('refuses the battle for 5th place when only five cars are listed, and sends nothing', async () => {
    // Arrange: five cars listed, the box open on "Pela posição" with 5 typed.
    const { fakeServer } = drawTheStripWithTheBattleCard(buildSlicesWithFiveCarsListed());
    const box = openTheBoxWithTheChevron();
    fireEvent.mouseDown(box.getByRole('tab', { name: 'Pela posição' }));
    fireEvent.change(box.getByLabelText('Disputa pela posição'), { target: { value: '5' } });

    // Act: press "No ar".
    fireEvent.click(box.getByRole('button', { name: 'No ar' }));
    await letThePageFinishWhatItStarted();

    // Assert: the reason under the box, and no command at all.
    expect(
      box.getByRole('alert'),
      'a battle whose car behind the source does not list must be refused',
    ).toHaveTextContent('Não há carro na 6ª posição agora.');
    expect(fakeServer.listCommandsReceived(), 'nothing may be saved or taken').toEqual([]);
  });

  it('takes nothing once the save is answered when the box was closed with Esc meanwhile', async () => {
    // Arrange: 47 and 52 typed, "No ar" pressed, the save waiting for the server.
    const { fakeServer } = drawTheStripWithTheBattleCard(buildSlicesWithTheBattleCardButton());
    const box = openTheBoxWithTheChevron();
    fireEvent.change(box.getByLabelText('Carro da frente'), { target: { value: '47' } });
    fireEvent.change(box.getByLabelText('Carro de trás'), { target: { value: '52' } });
    fireEvent.click(box.getByRole('button', { name: 'No ar' }));
    await letThePageFinishWhatItStarted();

    // Act: Esc closes the box, then the server accepts the save.
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    fakeServer.acceptLastCommand();
    await letThePageFinishWhatItStarted();

    // Assert: the box is gone, and the save is the only command sent.
    expect(screen.queryByRole('dialog'), 'Esc must close the box').toBeNull();
    expect(
      fakeServer.listCommandsReceived(),
      'a box the operator closed must not take anything afterwards',
    ).toEqual([
      {
        type: 'updateItemFields',
        itemId: battleCardItemId,
        fields: buildFieldsOfCar47AheadAndCar52Behind(),
      },
    ]);
  });
});

describe('what the box says about its source', () => {
  it('says several sources send positions when the item reads none, and keeps its buttons off', () => {
    // Arrange: the card typed by hand, while the simulator and the replay both send positions.
    drawTheStripWithTheBattleCard(buildSlicesWithTwoSourcesAndTheCardTypedByHand());

    // Act: open its box.
    const box = openTheBoxWithTheChevron();

    // Assert: the reason, and nothing can be sent.
    expect(
      box.getByText('Mais de uma fonte manda posições: escolha a fonte no editor do item.'),
      'the box must say why it has no source',
    ).toBeInTheDocument();
    expect(box.getByRole('button', { name: 'No ar' }), 'no source, no take').toBeDisabled();
    expect(box.getByRole('button', { name: 'Prévia' }), 'no source, no preview').toBeDisabled();
  });

  it('marks a stale source with Camadas’ "fonte atrasada"', () => {
    // Arrange: the simulator late, its last good data kept.
    drawTheStripWithTheBattleCard(buildSlicesWithTheSimulatorLate());

    // Act: open the box.
    const box = openTheBoxWithTheChevron();

    // Assert: the chip beside the source's name.
    expect(
      box.getByText('fonte atrasada'),
      'the operator must know the read-out is the last good data, not the race now',
    ).toBeInTheDocument();
  });
});

describe('"No ar" for an item also in "Prévia"', () => {
  it('previews it again with the new cars, still automatic, before the take', async () => {
    // Arrange: the card in an automatic preview with its old cars; 47 and 52 typed.
    const { fakeServer } = drawTheStripWithTheBattleCard(
      buildSlicesWithTheBattleCardButtonInPreview('auto'),
    );
    const box = openTheBoxWithTheChevron();
    fireEvent.change(box.getByLabelText('Carro da frente'), { target: { value: '47' } });
    fireEvent.change(box.getByLabelText('Carro de trás'), { target: { value: '52' } });

    // Act: press "No ar", and let the server accept the save and the preview.
    fireEvent.click(box.getByRole('button', { name: 'No ar' }));
    await letThePageFinishWhatItStarted();
    fakeServer.acceptLastCommand();
    await letThePageFinishWhatItStarted();
    fakeServer.acceptLastCommand();
    await letThePageFinishWhatItStarted();

    // Assert: save, preview again (automatic), then the take.
    expect(
      fakeServer.listCommandsReceived(),
      'the preview must never keep the old cars for a later "Tomar"',
    ).toEqual([
      {
        type: 'updateItemFields',
        itemId: battleCardItemId,
        fields: buildFieldsOfCar47AheadAndCar52Behind(),
      },
      { type: 'previewItem', itemId: battleCardItemId, origin: 'auto' },
      { type: 'takeItem', itemId: battleCardItemId, instanceIdSeenOnAir: null },
    ]);
  });
});

describe('Dados and "Escolher carros"', () => {
  it('turns the chevron and the menu entry off for Dados', () => {
    // Arrange: the strip, as the Dados role.
    drawTheStripWithTheBattleCard(buildSlicesWithTheBattleCardButton(), dataRoleAtMesa2);
    const chevron = screen.getByRole('button', { name: `Escolher carros: ${battleCardLabel}` });

    // Act: open the battle card's "⋯" menu.
    fireEvent.keyDown(screen.getByRole('button', { name: `Mais ações: ${battleCardLabel}` }), {
      key: 'Enter',
    });

    // Assert: both ways in are off; the box ends in a take or a preview, which are not Dados'.
    expect(chevron, 'Dados may not open the box with the chevron').toBeDisabled();
    expect(
      screen.getByRole('menuitem', { name: 'Escolher carros' }),
      'Dados may not open the box from the menu',
    ).toHaveAttribute('aria-disabled', 'true');
  });
});

describe('the keyboard in the box', () => {
  it('moves with Enter from the car ahead to the car behind, then to "Prévia"', () => {
    // Arrange: the box open, the focus in "Carro da frente".
    drawTheStripWithTheBattleCard(buildSlicesWithTheBattleCardButton());
    const box = openTheBoxWithTheChevron();
    const carAheadBox = box.getByLabelText('Carro da frente');
    const carBehindBox = box.getByLabelText('Carro de trás');

    // Act: Enter in the car ahead's box, then Enter in the car behind's.
    fireEvent.keyDown(carAheadBox, { key: 'Enter' });
    const focusAfterTheFirstEnter = document.activeElement;
    fireEvent.keyDown(carBehindBox, { key: 'Enter' });

    // Assert: the car behind's box first, then "Prévia".
    expect(focusAfterTheFirstEnter, 'Enter must move to the next car').toBe(carBehindBox);
    expect(document.activeElement, 'Enter in the last box must move to "Prévia"').toBe(
      box.getByRole('button', { name: 'Prévia' }),
    );
  });

  it('keeps a digit pressed on its tabs from firing the strip’s 1st button', async () => {
    // Arrange: the box open.
    const { fakeServer } = drawTheStripWithTheBattleCard(buildSlicesWithTheBattleCardButton());
    const box = openTheBoxWithTheChevron();

    // Act: press 1 on the "Por número" tab (a tab is not a place the page sees as typing).
    fireEvent.keyDown(box.getByRole('tab', { name: 'Por número' }), { key: '1' });
    await letThePageFinishWhatItStarted();

    // Assert: no take of "Logo Baja", the strip's 1st button.
    expect(
      fakeServer.listCommandsReceived(),
      'a key pressed inside the box belongs to the box',
    ).toEqual([]);
  });
});
