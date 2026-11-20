/**
 * "Escolher carros" on a rundown row (apps/control)
 *
 * What this module is for:
 *   The battle card prepared in the rundown gets the same "Escolher carros" box as on a
 *   quick-fire button (BAJAOVRLAY-82), from the row's "⋯" menu. "No ar" there is the row's
 *   own "Disparar": the page's one take path, which previews the next item when
 *   "Prévia automática" is on.
 *
 * What these tests prove:
 *   - The row's "⋯" menu lists "Escolher carros" on the battle card, and not on a race
 *     clock row.
 *   - 47 and 52 typed, then "No ar": `updateItemFields` with the bindings to cars 47 and 52,
 *     then `takeItem` of the row.
 *
 * What these tests deliberately do not cover:
 *   - The box itself, case by case: QuickCarPickOnAQuickFireButton.test.tsx.
 *   - The automatic preview after a take: RundownPanelPreviewAfterTake.test.tsx
 *     (features/rundown); the box takes through the same function.
 */
import type { Slices } from '@bajaovrlay/shared';
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  buildBattleCardGraphic,
  buildBattleCardOfTheLeadersItem,
} from '@/features/items/battleCardOfTheLeaders.testSupport';
import { RundownPanel } from '@/features/rundown/RundownPanel';
import {
  letThePageFinishWhatItStarted,
  renderOnControlPageConnectedToFakeServer,
} from '@/state/controlPageOnFakeServer.testSupport';
import {
  buildEnduroSnapshotAtLap34,
  buildSimulatorThatIsOk,
  seededSimulatorId,
} from '@/state/dataSourcesLikeTheServerSends.testSupport';
import { buildSlicesWithTheEnduranceRundown } from '@/state/rundownLikeTheServerSends.testSupport';

import {
  battleCardLabel,
  buildFieldsOfCar47AheadAndCar52Behind,
} from './battleCardButton.testSupport';

// The item editor has its own tests; a stand-in takes its place here.
vi.mock(
  '@/features/items/ItemEditorPanel',
  () => import('@/features/rundown/itemEditorStandIn.testSupport'),
);

const battleCardItemId = buildBattleCardOfTheLeadersItem().id;

/** The endurance rundown, cursor on the start, with the leaders' battle card as its 4th row. */
function buildSlicesWithTheBattleCardInTheRundown(): Slices {
  const slices = buildSlicesWithTheEnduranceRundown('item-largada-do-enduro');
  return {
    ...slices,
    graphics: [...slices.graphics, buildBattleCardGraphic()],
    items: [...slices.items, { ...buildBattleCardOfTheLeadersItem(), order: 3 }],
    dataSources: [buildSimulatorThatIsOk()],
    dataSnapshots: [buildEnduroSnapshotAtLap34(seededSimulatorId)],
  };
}

/** Opens the "⋯" menu of one row, as a keyboard user does. */
function openTheMenuOfRow(itemLabel: string): void {
  fireEvent.keyDown(screen.getByRole('button', { name: `Mais ações: ${itemLabel}` }), {
    key: 'Enter',
  });
}

describe('"Escolher carros" on a rundown row', () => {
  it('is listed in the battle card’s menu and not in a race clock’s', () => {
    // Arrange: the rundown with three race clocks and the battle card.
    renderOnControlPageConnectedToFakeServer(
      <RundownPanel />,
      buildSlicesWithTheBattleCardInTheRundown(),
    );

    // Act: open the menu of the start (a race clock), read it, close it, open the card's.
    openTheMenuOfRow('Largada do enduro');
    const startMenuEntries = screen.queryAllByRole('menuitem').map((entry) => entry.textContent);
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    openTheMenuOfRow(battleCardLabel);

    // Assert: only the card offers "Escolher carros".
    expect(startMenuEntries, 'a race clock has no cars to pick').not.toContain('Escolher carros');
    expect(
      screen.getByRole('menuitem', { name: 'Escolher carros' }),
      'the battle card must offer its cars',
    ).toBeInTheDocument();
  });

  it('saves cars 47 and 52, then takes the row’s item', async () => {
    // Arrange: the card's box open from its menu, 47 and 52 typed.
    const { fakeServer } = renderOnControlPageConnectedToFakeServer(
      <RundownPanel />,
      buildSlicesWithTheBattleCardInTheRundown(),
    );
    openTheMenuOfRow(battleCardLabel);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Escolher carros' }));
    const box = within(
      screen.getByRole('dialog', { name: `Escolher carros — ${battleCardLabel}` }),
    );
    fireEvent.change(box.getByLabelText('Carro da frente'), { target: { value: '47' } });
    fireEvent.change(box.getByLabelText('Carro de trás'), { target: { value: '52' } });

    // Act: press "No ar", and let the server accept the save.
    fireEvent.click(box.getByRole('button', { name: 'No ar' }));
    await letThePageFinishWhatItStarted();
    fakeServer.acceptLastCommand();
    await letThePageFinishWhatItStarted();

    // Assert: the save, then the row's take.
    expect(
      fakeServer.listCommandsReceived(),
      'the cars must be saved, then the item taken as "Disparar" takes it',
    ).toEqual([
      {
        type: 'updateItemFields',
        itemId: battleCardItemId,
        fields: buildFieldsOfCar47AheadAndCar52Behind(),
      },
      { type: 'takeItem', itemId: battleCardItemId, instanceIdSeenOnAir: null },
    ]);
  });
});
