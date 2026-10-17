/**
 * Rundown rows and shortcut buttons load nothing into "Edição rápida" (apps/control)
 *
 * What this module is for:
 *   Until BAJAOVRLAY-36 "Edição rápida" followed the graphic taken most recently, so a
 *   take from the rundown could change what "Atualizar" would touch. Now the panel edits
 *   only what a "Camadas" row's "Editar" loaded into it. A take fired from a rundown row
 *   or a shortcut button, and a click on a row's label, put things on air or move the
 *   cursor, and leave the panel exactly as it was.
 *
 * What these tests prove:
 *   - After "Disparar" on a rundown row, a click on a row's label, or a click on a
 *     shortcut button, with the server putting the item on air, the panel still makes a
 *     new entry, offers no "Atualizar", and its form was not refilled from the air.
 *
 * What these tests deliberately do not cover:
 *   - What those presses send: features/rundown and features/quickFire tests.
 *   - Loading an instance with "Editar": QuickEditPanelTarget.test.tsx.
 */
import type { Instance } from '@bajaovrlay/shared';
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { QuickFireStrip } from '@/features/quickFire/QuickFireStrip';
import { RundownPanel } from '@/features/rundown/RundownPanel';
import {
  letThePageFinishWhatItStarted,
  renderOnControlPageConnectedToFakeServer,
} from '@/state/controlPageOnFakeServer.testSupport';
import {
  buildSlicesWithShortcutsAndMacros,
  enduranceClockItemId,
} from '@/state/quickFireLikeTheServerSends.testSupport';
import { enduranceStartItemId } from '@/state/rundownLikeTheServerSends.testSupport';
import { buildRaceClockInstanceOnTheClockLayer } from '@/state/slicesLikeTheServerSends.testSupport';

import { QuickEditPanel } from './QuickEditPanel';

// The item editor has its own tests; a stand-in takes its place where the rundown is drawn.
vi.mock(
  '@/features/items/ItemEditorPanel',
  () => import('@/features/rundown/itemEditorStandIn.testSupport'),
);

// Saturday of the endurance race, 10:00: the moment the item goes on air.
const momentOfTheTake = '2026-10-10T13:00:00.000Z';

/** The race clock on air under green, put there by this item. */
function buildClockOnAirTakenFromItem(itemId: string): Instance {
  return { ...buildRaceClockInstanceOnTheClockLayer(momentOfTheTake), itemId, status: 'on-air' };
}

const pressScenarios: Array<{
  name: string;
  pressTheControl: () => void;
  itemPutOnAir: string;
}> = [
  // A row's "Disparar": the most common take of the show.
  {
    name: '"Disparar" on a rundown row',
    pressTheControl: () => {
      const startRow = within(screen.getByRole('listitem', { name: 'Largada do enduro' }));
      fireEvent.click(startRow.getByRole('button', { name: 'Disparar' }));
    },
    itemPutOnAir: enduranceStartItemId,
  },
  // A click on a row's label only moves the cursor; it must not load the item either.
  {
    name: 'a click on a rundown row label',
    pressTheControl: () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Marcar como próximo: Largada do enduro' }),
      );
    },
    itemPutOnAir: enduranceStartItemId,
  },
  // A shortcut button of the quick-fire strip.
  {
    name: 'a shortcut button',
    pressTheControl: () => {
      const shortcutsGrid = within(screen.getByRole('list', { name: 'Atalhos de Atalhos' }));
      const clockButton = within(
        shortcutsGrid.getByRole('listitem', { name: 'Relógio do enduro' }),
      );
      // The button itself reads its label then its graphic; its "⋯" is "Mais ações: …".
      fireEvent.click(clockButton.getByRole('button', { name: /^Relógio do enduro/ }));
    },
    itemPutOnAir: enduranceClockItemId,
  },
];

describe('"Edição rápida" while items are fired elsewhere on the page', () => {
  it.each(pressScenarios)(
    'loads nothing after $name',
    async ({ pressTheControl, itemPutOnAir }) => {
      // Arrange: the rundown, the shortcut strip and the panel, nothing on air.
      const { fakeServer } = renderOnControlPageConnectedToFakeServer(
        <>
          <RundownPanel />
          <QuickFireStrip />
          <QuickEditPanel />
        </>,
        buildSlicesWithShortcutsAndMacros(),
      );

      // Act: press the control; the server puts the race clock on air and answers ok.
      pressTheControl();
      fakeServer.sendMessage({
        type: 'slice',
        name: 'instances',
        slice: [buildClockOnAirTakenFromItem(itemPutOnAir)],
      });
      fakeServer.acceptLastCommand();
      await letThePageFinishWhatItStarted();

      // Assert: the panel is still a new entry, with its defaults and no "Atualizar".
      expect(
        screen.getByRole('heading', { level: 3 }),
        'a take or a cursor move elsewhere must not load anything into the panel',
      ).toHaveTextContent('Nova entrada — não altera nenhum item');
      expect(
        screen.queryByRole('button', { name: 'Atualizar' }),
        'with nothing loaded there is nothing to update',
      ).toBeNull();
      expect(
        screen.getByRole('combobox', { name: 'Bandeira' }),
        'the form must not be refilled from what went on air',
      ).toHaveTextContent('Pré-largada');
    },
  );
});
