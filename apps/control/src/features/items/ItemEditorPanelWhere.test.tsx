/**
 * Item editor: "Onde", where a new item goes (apps/control)
 *
 * What this module is for:
 *   A new item lives in the rundown on screen or in one of the quick-fire panels. The
 *   editor offers that choice in a dropdown named "Onde", which starts on the place the
 *   editor was opened from: the rundown after the rundown's "+ Item", a panel after that
 *   panel's "+ Atalho". `createItem` carries the choice as its `home`.
 *
 * What these tests prove:
 *   - Opened from the rundown, "Onde" starts on the rundown and lists the rundown and
 *     every panel (in tab order); choosing "Atalhos" creates the item in that panel.
 *   - Opened from a panel, "Onde" starts on that panel and the item is created there.
 *   - A stored item is not offered "Onde": it is moved with "Mover para rundown".
 *
 * What these tests deliberately do not cover:
 *   - The rest of createItem (fields, label, colour): ItemEditorPanel.test.tsx.
 *   - "+ Atalho" opening the editor on a panel: QuickFireStripPanels.test.tsx.
 */
import type { Slices } from '@bajaovrlay/shared';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  chooseOptionInDropdown,
  typeIntoField,
} from '@/features/schemaForm/schemaFormOnTestPage.testSupport';

import {
  pressSaveAndWaitForCommand,
  renderItemEditorPanelOnFakeServerWithSlices,
} from './itemEditorOnFakeServer.testSupport';
import {
  buildEnduranceStartClockItem,
  buildSlicesWithTheRaceClockAndTheLowerThird,
} from './itemsLikeTheEditorSaves.testSupport';

/** The editor's usual slices, with a second panel "Box" listed before "Atalhos". */
function buildSlicesWithTwoPanels(): Slices {
  return {
    ...buildSlicesWithTheRaceClockAndTheLowerThird(),
    quickFirePanels: [
      { id: 'painel-box', name: 'Box', order: 1 },
      { id: 'atalhos', name: 'Atalhos', order: 0 },
    ],
  };
}

/** Fills the two fields a new race clock item needs: its label and its session name. */
function fillTheClockItem(): void {
  typeIntoField('Rótulo', 'Relógio do enduro');
  typeIntoField('Nome da sessão', 'Enduro de Resistência');
}

describe('"Onde" in the item editor', () => {
  it('starts on the rundown it was opened from and lists every panel in tab order', () => {
    // Arrange: the editor opened from the rundown, with two panels on the server.
    renderItemEditorPanelOnFakeServerWithSlices(null, buildSlicesWithTwoPanels());
    const whereDropdown = screen.getByRole('combobox', { name: 'Onde' });

    // Act: open "Onde" to see its choices.
    fireEvent.keyDown(whereDropdown, { key: 'Enter' });

    // Assert: it shows the rundown, and offers the rundown then each panel in tab order.
    expect(whereDropdown, '"Onde" must start where the editor was opened').toHaveTextContent(
      'Rundown: Sessão principal',
    );
    expect(
      screen.getAllByRole('option').map((option) => option.textContent),
      '"Onde" must offer the rundown, then each panel in tab order',
    ).toEqual([
      'Rundown: Sessão principal',
      'Painel de atalhos: Atalhos',
      'Painel de atalhos: Box',
    ]);
  });

  it('creates the item in the panel chosen', async () => {
    // Arrange: the editor opened from the rundown, filled in.
    const { fakeServer } = renderItemEditorPanelOnFakeServerWithSlices(
      null,
      buildSlicesWithTwoPanels(),
    );
    fillTheClockItem();

    // Act: choose "Atalhos" and save.
    chooseOptionInDropdown('Onde', 'Painel de atalhos: Atalhos');
    await pressSaveAndWaitForCommand(1, fakeServer);

    // Assert: the item went to "Atalhos".
    expect(
      fakeServer.listCommandsReceived()[0],
      'the new item must be created in the panel chosen',
    ).toMatchObject({ type: 'createItem', home: { kind: 'quickFire', panelId: 'atalhos' } });
  });

  it('starts on the panel it was opened from, and creates the item there', async () => {
    // Arrange: the editor opened from the "Box" panel's "+ Atalho".
    const { fakeServer } = renderItemEditorPanelOnFakeServerWithSlices(
      null,
      buildSlicesWithTwoPanels(),
      { kind: 'quickFire', panelId: 'painel-box' },
    );
    fillTheClockItem();

    // Act: save without touching "Onde".
    await pressSaveAndWaitForCommand(1, fakeServer);

    // Assert: shown and sent as "Box".
    expect(
      screen.getByRole('combobox', { name: 'Onde' }),
      '"Onde" must start on the panel the editor was opened from',
    ).toHaveTextContent('Painel de atalhos: Box');
    expect(
      fakeServer.listCommandsReceived()[0],
      'the new item must be created in that panel',
    ).toMatchObject({ type: 'createItem', home: { kind: 'quickFire', panelId: 'painel-box' } });
  });

  it('is not offered for a stored item', () => {
    // Arrange: nothing beyond the slices.
    const slices = buildSlicesWithTwoPanels();

    // Act: open a stored item.
    renderItemEditorPanelOnFakeServerWithSlices(buildEnduranceStartClockItem(), slices);

    // Assert: no "Onde".
    expect(
      screen.queryByRole('combobox', { name: 'Onde' }),
      'a stored item is moved with "Mover para rundown", not from the editor',
    ).toBeNull();
  });
});
