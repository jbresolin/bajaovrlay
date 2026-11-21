/**
 * "Escolher carros" on a quick-fire button (apps/control)
 *
 * What this module is for:
 *   During a race the operator wants the battle card's two cars changed in seconds,
 *   without opening the item editor (BAJAOVRLAY-82). On a quick-fire button whose
 *   graphic has cars to pick, a small chevron (and "Escolher carros" in the "⋯" menu)
 *   opens a box: one number box per car, with suggestions from the positions, or
 *   "Disputa pela posição"; one line naming the cars as they run now; "Prévia" and
 *   "No ar". A press saves the cars into the item exactly as the editor's car picker does
 *   (one `updateItemFields`), then previews or takes the item the page's usual way.
 *
 * What these tests prove:
 *   - The box opens with the cars the item stores (31 and 38) and names them as they run.
 *   - 47 and 52 typed, then "No ar": `updateItemFields` with the eleven bindings to cars 47
 *     and 52, then, once the server accepted it, `takeItem`; the box closes.
 *   - "Pela posição" 3, then "Prévia": the battle for 3rd place saved, then `previewItem`
 *     (origin manual).
 *   - The same cars again send no save, only the take.
 *   - A car the positions do not list (12) is refused under its box when it is left, and
 *     "No ar" then sends nothing.
 *   - A refused save keeps the box open with the server's sentence and takes nothing.
 *   - While the item is on air, the box says "No ar" will put it on air again.
 *   - A button without cars (a race clock) offers neither the chevron nor the entry, and a
 *     click on the battle card's button itself still just takes it.
 *
 * What these tests deliberately do not cover:
 *   - Each check and message: quickCarPickChecks.test.ts. Each binding written, field by
 *     field: carGroupPicksOfStoredItem.test.ts (features/schemaForm).
 *   - The guards (a place the source cannot fill, a box closed while its save waits, the
 *     source line, a stale preview, Dados, Enter and the page's keys):
 *     QuickCarPickGuards.test.tsx. The same box on a rundown row:
 *     QuickCarPickOnARundownRow.test.tsx.
 *   - The real server and the graphic on air: e2e/quickBattlePick.e2e.ts.
 */
import type { Slices } from '@bajaovrlay/shared';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { letThePageFinishWhatItStarted } from '@/state/controlPageOnFakeServer.testSupport';

import {
  battleCardLabel,
  buildBattleCardButton,
  buildFieldsOfCar47AheadAndCar52Behind,
  buildFieldsOfTheBattleForThirdPlace,
  buildSlicesWithTheBattleCardButton,
  buildSlicesWithTheBattleCardButtonOnAir,
} from './battleCardButton.testSupport';
import {
  drawTheStripWithTheBattleCard,
  openTheBoxWithTheChevron,
} from './quickCarPickOnTheStrip.testSupport';

const battleCardItemId = buildBattleCardButton().id;

/** Draws the strip with the battle card and opens its box, both part of an arrangement. */
function openTheBoxOfTheBattleCard(slices: Slices) {
  const page = drawTheStripWithTheBattleCard(slices);
  return { ...page, box: openTheBoxWithTheChevron() };
}

describe('"Escolher carros" on a quick-fire button', () => {
  it('opens with the cars the item stores, named as they run now', () => {
    // Arrange: the strip with the leaders' card.
    drawTheStripWithTheBattleCard(buildSlicesWithTheBattleCardButton());

    // Act: press its chevron.
    const box = openTheBoxWithTheChevron();

    // Assert: 31 and 38 in the boxes, and the read-out naming the 1st and the 2nd.
    expect(box.getByLabelText('Carro da frente'), 'the car ahead stored').toHaveValue('31');
    expect(box.getByLabelText('Carro de trás'), 'the car behind stored').toHaveValue('38');
    expect(
      box.getByText(/^Agora:/),
      'the read-out must name both cars as they run now',
    ).toHaveTextContent('Agora: 1º 31 Acauã Baja × 2º 38 Coruja Racing');
    expect(
      box.getByText(/^Fonte:/),
      'the box must say which source the cars are read from, and that they stay live',
    ).toHaveTextContent('Fonte: Simulador — Enduro · ao vivo');
  });

  it('saves cars 47 and 52, then takes the item, once the save is accepted', async () => {
    // Arrange: the box open, 47 typed ahead and 52 behind.
    const { box, fakeServer } = openTheBoxOfTheBattleCard(buildSlicesWithTheBattleCardButton());
    fireEvent.change(box.getByLabelText('Carro da frente'), { target: { value: '47' } });
    fireEvent.change(box.getByLabelText('Carro de trás'), { target: { value: '52' } });

    // Act: press "No ar", and let the server accept the save.
    fireEvent.click(box.getByRole('button', { name: 'No ar' }));
    await letThePageFinishWhatItStarted();
    fakeServer.acceptLastCommand();
    await letThePageFinishWhatItStarted();

    // Assert: the save of the eleven fields first, then the take; the box is gone.
    expect(
      fakeServer.listCommandsReceived(),
      'the cars must be saved into the item before the take, which follows the accepted save',
    ).toEqual([
      {
        type: 'updateItemFields',
        itemId: battleCardItemId,
        fields: buildFieldsOfCar47AheadAndCar52Behind(),
      },
      { type: 'takeItem', itemId: battleCardItemId, instanceIdSeenOnAir: null },
    ]);
    expect(screen.queryByRole('dialog'), 'the box must close once it has sent').toBeNull();
  });

  it('saves the battle for 3rd place, then previews the item', async () => {
    // Arrange: the box open on "Pela posição", 3 typed.
    const { box, fakeServer } = openTheBoxOfTheBattleCard(buildSlicesWithTheBattleCardButton());
    fireEvent.mouseDown(box.getByRole('tab', { name: 'Pela posição' }));
    fireEvent.change(box.getByLabelText('Disputa pela posição'), { target: { value: '3' } });

    // Act: press "Prévia", and let the server accept the save.
    fireEvent.click(box.getByRole('button', { name: 'Prévia' }));
    await letThePageFinishWhatItStarted();
    fakeServer.acceptLastCommand();
    await letThePageFinishWhatItStarted();

    // Assert: the 3rd and 4th places saved, then a preview asked for by hand.
    expect(
      fakeServer.listCommandsReceived(),
      'the battle for 3rd place must be saved, then the item previewed',
    ).toEqual([
      {
        type: 'updateItemFields',
        itemId: battleCardItemId,
        fields: buildFieldsOfTheBattleForThirdPlace(),
      },
      { type: 'previewItem', itemId: battleCardItemId, origin: 'manual' },
    ]);
  });

  it('sends no save when the cars are the ones the item already stores', async () => {
    // Arrange: the box open with 31 and 38, as stored.
    const { box, fakeServer } = openTheBoxOfTheBattleCard(buildSlicesWithTheBattleCardButton());

    // Act: press "No ar" without changing anything.
    fireEvent.click(box.getByRole('button', { name: 'No ar' }));
    await letThePageFinishWhatItStarted();

    // Assert: the take alone.
    expect(
      fakeServer.listCommandsReceived(),
      'the same pair again must not rewrite the item',
    ).toEqual([{ type: 'takeItem', itemId: battleCardItemId, instanceIdSeenOnAir: null }]);
  });

  it('refuses car 12, which does not race, under its box, and sends nothing', async () => {
    // Arrange: the box open, 12 typed ahead.
    const { box, fakeServer } = openTheBoxOfTheBattleCard(buildSlicesWithTheBattleCardButton());
    const carAheadBox = box.getByLabelText('Carro da frente');
    fireEvent.change(carAheadBox, { target: { value: '12' } });

    // Act: leave the box, then press "No ar" anyway.
    fireEvent.blur(carAheadBox);
    fireEvent.click(box.getByRole('button', { name: 'No ar' }));
    await letThePageFinishWhatItStarted();

    // Assert: the message under the box, and nothing sent.
    expect(
      box.getByRole('alert'),
      'a car the positions do not list must be refused under its box',
    ).toHaveTextContent('O carro 12 não está nas posições de Simulador — Enduro.');
    expect(carAheadBox, 'the box must be marked wrong').toHaveAttribute('aria-invalid', 'true');
    expect(fakeServer.listCommandsReceived(), 'nothing may be sent for a wrong car').toEqual([]);
  });

  it('keeps the box open with the server’s sentence when the save is refused', async () => {
    // Arrange: the box open, 47 and 52 typed, "No ar" pressed.
    const { box, fakeServer } = openTheBoxOfTheBattleCard(buildSlicesWithTheBattleCardButton());
    fireEvent.change(box.getByLabelText('Carro da frente'), { target: { value: '47' } });
    fireEvent.change(box.getByLabelText('Carro de trás'), { target: { value: '52' } });
    fireEvent.click(box.getByRole('button', { name: 'No ar' }));
    await letThePageFinishWhatItStarted();

    // Act: the server refuses the save.
    fakeServer.refuseLastCommand({
      code: 'ITEM_NOT_FOUND',
      message: 'O item não existe mais.',
    });
    await letThePageFinishWhatItStarted();

    // Assert: the sentence in the box, and no take after the save.
    expect(box.getByRole('alert'), 'the refusal must be shown in the box').toHaveTextContent(
      'O item não existe mais.',
    );
    expect(
      fakeServer.listCommandsReceived(),
      'a refused save must never be followed by a take',
    ).toEqual([
      {
        type: 'updateItemFields',
        itemId: battleCardItemId,
        fields: buildFieldsOfCar47AheadAndCar52Behind(),
      },
    ]);
  });

  it('says "No ar" puts the card on air again while it is on air', () => {
    // Arrange: the strip, with the card on the program output.
    drawTheStripWithTheBattleCard(buildSlicesWithTheBattleCardButtonOnAir());

    // Act: open its box.
    const box = openTheBoxWithTheChevron();

    // Assert: the note about taking it again.
    expect(
      box.getByText('Já está no ar: "No ar" troca o gráfico pelo dos carros escolhidos.'),
      'the operator must know the card goes out and in with the new cars',
    ).toBeInTheDocument();
  });
});

describe('the buttons around "Escolher carros"', () => {
  it('offers no chevron and no entry on a button without cars', () => {
    // Arrange: the strip, with three race clocks and the battle card, and its chevrons
    // counted before a menu hides the rest of the page from a screen reader.
    drawTheStripWithTheBattleCard(buildSlicesWithTheBattleCardButton());
    const chevrons = screen.getAllByRole('button', { name: /^Escolher carros:/ });

    // Act: open the "⋯" menu of "Logo Baja", a race clock.
    fireEvent.keyDown(screen.getByRole('button', { name: 'Mais ações: Logo Baja' }), {
      key: 'Enter',
    });

    // Assert: no "Escolher carros" in its menu, and only one chevron on the strip.
    expect(
      screen.queryByRole('menuitem', { name: 'Escolher carros' }),
      'a race clock has no cars to pick',
    ).toBeNull();
    expect(
      chevrons.map((chevron) => chevron.getAttribute('aria-label')),
      'only the battle card carries the chevron',
    ).toEqual([`Escolher carros: ${battleCardLabel}`]);
  });

  it('opens the box from the battle card’s "⋯" menu', () => {
    // Arrange: the strip, and the battle card's "⋯" menu open.
    drawTheStripWithTheBattleCard(buildSlicesWithTheBattleCardButton());
    fireEvent.keyDown(screen.getByRole('button', { name: `Mais ações: ${battleCardLabel}` }), {
      key: 'Enter',
    });

    // Act: choose "Escolher carros".
    fireEvent.click(screen.getByRole('menuitem', { name: 'Escolher carros' }));

    // Assert: the box is open.
    expect(
      screen.getByRole('dialog', { name: `Escolher carros — ${battleCardLabel}` }),
      'the menu entry must open the same box as the chevron',
    ).toBeInTheDocument();
  });

  it('still takes the item when the button itself is clicked', async () => {
    // Arrange: the strip.
    const { fakeServer } = drawTheStripWithTheBattleCard(buildSlicesWithTheBattleCardButton());

    // Act: click the battle card's button.
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${battleCardLabel}`) }));
    await letThePageFinishWhatItStarted();

    // Assert: a plain take, with no box and no save.
    expect(fakeServer.listCommandsReceived(), 'a click must take, as before').toEqual([
      { type: 'takeItem', itemId: battleCardItemId, instanceIdSeenOnAir: null },
    ]);
    expect(screen.queryByRole('dialog'), 'a click must not open the box').toBeNull();
  });
});
