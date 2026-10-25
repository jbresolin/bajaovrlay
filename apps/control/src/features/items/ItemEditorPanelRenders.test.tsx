/**
 * What the item editor redraws during a race (apps/control)
 *
 * What this module is for:
 *   Operators edit items while the race runs, and a source sends new data every half
 *   second. Gate 2 of PR #27 found the editor redrawing every field at every poll and at
 *   every pick, which on a battle card with eleven live fields made each click slower
 *   than the last (BAJAOVRLAY-45). The editor must redraw only what changed.
 *
 * What these tests prove, on a stored battle card whose eleven fields read the two
 * leaders live:
 *   - A poll that changes nothing the card shows (the gap of a car further back) redraws
 *     no field row.
 *   - A poll that changes one value the card shows (the 2nd car's gap to the leader)
 *     redraws at most the row that shows it, and its "Valor agora" then says the new gap.
 *   - A pick in one field ("Congelado na entrada") redraws that field's row alone.
 *   - Typing in the one typed number field redraws no other row, and typing the item's
 *     label redraws no row of the graphic.
 *
 * How a row draw is counted: every field row draws its field's label with the ui Label,
 * once per draw, so the ui Label is replaced by a stand-in that counts its draws by text
 * (labelDrawCounter.testSupport.tsx).
 *
 * What these tests deliberately do not cover:
 *   - How long a draw takes in a real browser: itemEditorStaysFastDuringARace.e2e.ts.
 *   - What the controls of a bound field offer and save: ItemEditorPanelBindings.test.tsx.
 */
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { chooseOptionInDropdown } from '@/features/schemaForm/schemaFormOnTestPage.testSupport';
import type { ServerStateStore } from '@/state/serverStateStore';

import {
  battleCardFieldLabels,
  buildBattleCardOfTheLeadersItem,
  buildNextPollWhereOnlyACarOffTheCardMoves,
  buildNextPollWhereTheSecondCarCloses,
  buildSlicesWithTheBattleCardOfTheLeaders,
  momentOfTheNextPollMs,
} from './battleCardOfTheLeaders.testSupport';
import { renderItemEditorPanelOnFakeServerWithSlices } from './itemEditorOnFakeServer.testSupport';
import { countDrawsOfEachLabel, startCountingLabelDraws } from './labelDrawCounter.testSupport';

// The ui Label is replaced by the counting stand-in for this whole file (header).
vi.mock('@/components/ui/label', () => import('./labelDrawCounter.testSupport'));

/** The labels of the battle card's rows, as the editor draws them. */
const gapLabel = 'Diferença entre os carros (ms)';
const leaderTeamLabel = 'Equipe do carro da frente';
const handSetChangeLabel = 'Variação à mão (ms)';

/** Every row label but these, for "no other row was drawn". */
function listFieldLabelsOtherThan(labelsLeftOut: string[]): string[] {
  return battleCardFieldLabels.filter((label) => !labelsLeftOut.includes(label));
}

/** The same labels, each with no draw: what "nothing was redrawn" looks like. */
function buildNoDrawForEach(labelTexts: string[]): Record<string, number> {
  const noDraws: Record<string, number> = {};
  for (const labelText of labelTexts) {
    noDraws[labelText] = 0;
  }
  return noDraws;
}

/** Opens the editor on the stored battle card of the two leaders, the race at lap 34. */
function renderEditorOnTheBattleCardOfTheLeaders() {
  return renderItemEditorPanelOnFakeServerWithSlices(
    buildBattleCardOfTheLeadersItem(),
    buildSlicesWithTheBattleCardOfTheLeaders(),
  );
}

/** When the simulator's data the page holds was received. */
function readMomentOfTheSimulatorsData(serverStateStore: ServerStateStore): number | undefined {
  return serverStateStore.getState().dataSnapshots[0]?.receivedAtMs;
}

/** The row of one field, found from its label up to the row's own box. */
function findRowOfField(fieldLabel: string): HTMLElement {
  const label = screen.getByText(fieldLabel, { selector: 'label' });
  const row = label.closest<HTMLElement>('.flex.flex-col.gap-2');
  if (row === null) {
    throw new Error(`the row of ${fieldLabel} is not on the page`);
  }
  return row;
}

describe('the item editor on a battle card read live, when a poll arrives', () => {
  // Fails on main (BAJAOVRLAY-45): flipped to `it` by the fix.
  it.fails('redraws no field row when the poll changes nothing the card shows', () => {
    // Arrange: the editor open on the battle card, every draw so far forgotten.
    const { fakeServer, serverStateStore } = renderEditorOnTheBattleCardOfTheLeaders();
    startCountingLabelDraws();

    // Act: the next poll, in which only car 78 (on no field) drops back from car 25.
    fakeServer.sendMessage(buildNextPollWhereOnlyACarOffTheCardMoves());

    // Assert: the page took the poll, and not one row of the card was drawn again.
    expect(
      readMomentOfTheSimulatorsData(serverStateStore),
      'the page must have taken the next poll, or nothing was tested',
    ).toBe(momentOfTheNextPollMs);
    expect(
      countDrawsOfEachLabel(battleCardFieldLabels),
      'a poll that changes nothing the card shows must redraw no row',
    ).toEqual(buildNoDrawForEach(battleCardFieldLabels));
  });

  // Fails on main (BAJAOVRLAY-45): flipped to `it` by the fix.
  it.fails(
    'redraws at most the row whose value the poll changed, and that row says the new value',
    () => {
      // Arrange: the editor open on the battle card, car 38 19,1 s behind the leader.
      const { fakeServer, serverStateStore } = renderEditorOnTheBattleCardOfTheLeaders();
      startCountingLabelDraws();

      // Act: the next poll, in which car 38 closes to 18,4 s.
      fakeServer.sendMessage(buildNextPollWhereTheSecondCarCloses());

      // Assert: the page took the poll; no other row drawn; the gap's row at most once,
      // reading the new gap.
      expect(
        readMomentOfTheSimulatorsData(serverStateStore),
        'the page must have taken the next poll, or nothing was tested',
      ).toBe(momentOfTheNextPollMs);
      const otherLabels = listFieldLabelsOtherThan([gapLabel]);
      expect(
        countDrawsOfEachLabel(otherLabels),
        'a poll must redraw no row whose value it did not change',
      ).toEqual(buildNoDrawForEach(otherLabels));
      expect(
        countDrawsOfEachLabel([gapLabel])[gapLabel],
        'the row of the changed value is drawn at most once',
      ).toBeLessThanOrEqual(1);
      expect(
        within(findRowOfField(gapLabel)).getByText('Valor agora: 18.400'),
        '"Valor agora" of the gap must say the new gap',
      ).toBeInTheDocument();
    },
  );
});

describe('the item editor on a battle card read live, when the operator works', () => {
  // Fails on main (BAJAOVRLAY-45): flipped to `it` by the fix.
  it.fails('redraws only the field picked in', () => {
    // Arrange: the editor open on the battle card, every draw so far forgotten.
    renderEditorOnTheBattleCardOfTheLeaders();
    startCountingLabelDraws();

    // Act: the car ahead's team set to "Congelado na entrada".
    chooseOptionInDropdown(`Quando ${leaderTeamLabel} lê a fonte`, 'Congelado na entrada');

    // Assert: no other row was drawn again.
    const otherLabels = listFieldLabelsOtherThan([leaderTeamLabel]);
    expect(
      countDrawsOfEachLabel(otherLabels),
      'a pick in one field must redraw no other row',
    ).toEqual(buildNoDrawForEach(otherLabels));
  });

  // Fails on main (BAJAOVRLAY-45): flipped to `it` by the fix.
  it.fails('redraws no other row while the operator types in the one typed field', () => {
    // Arrange: the editor open on the battle card, every draw so far forgotten.
    renderEditorOnTheBattleCardOfTheLeaders();
    startCountingLabelDraws();

    // Act: type a hand-set change of 700 ms, one keystroke at a time.
    const handSetChangeInput = screen.getByLabelText(handSetChangeLabel);
    fireEvent.change(handSetChangeInput, { target: { value: '7' } });
    fireEvent.change(handSetChangeInput, { target: { value: '70' } });
    fireEvent.change(handSetChangeInput, { target: { value: '700' } });

    // Assert: no row but the typed one was drawn again.
    const otherLabels = listFieldLabelsOtherThan([handSetChangeLabel]);
    expect(
      countDrawsOfEachLabel(otherLabels),
      'typing in one field must redraw no other row',
    ).toEqual(buildNoDrawForEach(otherLabels));
  });

  it('redraws no row of the graphic while the operator types the item’s label', () => {
    // Arrange: the editor open on the battle card, every draw so far forgotten.
    renderEditorOnTheBattleCardOfTheLeaders();
    startCountingLabelDraws();

    // Act: rename the item, one keystroke at a time, in the editor's own "Rótulo".
    const itemLabelInput = screen.getByRole('textbox', { name: 'Rótulo' });
    fireEvent.change(itemLabelInput, { target: { value: 'Disputa — líder e 2º!' } });
    fireEvent.change(itemLabelInput, { target: { value: 'Disputa — líder e 2º!!' } });

    // Assert: no row of the battle card was drawn again.
    expect(
      countDrawsOfEachLabel(battleCardFieldLabels),
      'typing the item’s label must redraw no row of the graphic',
    ).toEqual(buildNoDrawForEach(battleCardFieldLabels));
  });
});
