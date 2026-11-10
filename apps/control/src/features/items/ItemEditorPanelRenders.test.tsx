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
 * leaders, each car's position frozen at the take and the rest live, so the editor opens
 * each car's fields one by one ("Campos separados", BAJAOVRLAY-66; the rows these tests
 * count are drawn only then, and opening split costs no click before the counting):
 *   - A poll that changes nothing the card shows (the gap of a car further back) redraws
 *     no field row.
 *   - A poll that changes one value the card shows (the 2nd car's gap to the leader)
 *     redraws at most the row that shows it, and its "Valor agora" then says the new gap.
 *   - Two picks in two fields ("Congelado na entrada") redraw those fields' rows alone.
 *   - In every case above and below, the form around the rows is not drawn again either.
 *   - Typing in the one typed number field redraws no other row, and typing the item's
 *     label redraws no row of the graphic.
 * And with each car picked once, as the card opens: a poll that changes the gap redraws
 * neither car's picker nor the form, and the gap's line in the picker says the new gap.
 *
 * How a draw is counted: every field row draws its field's label with the ui Label,
 * once per draw, so the ui Label is replaced by a stand-in that counts its draws by text
 * (labelDrawCounter.testSupport.tsx). The rows are memoised, which would hide a form that
 * redraws around them, so SchemaFormFields, drawn at every draw of that form, is replaced
 * by a stand-in that counts its draws too (generatedFormDrawCounter.testSupport.tsx;
 * gate 2 round 1 of PR #29: the form subscribed to the snapshots again kept the row
 * counts at zero).
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
  buildBattleCardOfTheLeadersItemThatOpensSplit,
  buildNextPollWhereOnlyACarOffTheCardMoves,
  buildNextPollWhereTheSecondCarCloses,
  buildSlicesWithTheBattleCardOfTheLeaders,
  findRowOfField,
  momentOfTheNextPollMs,
} from './battleCardOfTheLeaders.testSupport';
import {
  countGeneratedFormDraws,
  startCountingGeneratedFormDraws,
} from './generatedFormDrawCounter.testSupport';
import { renderItemEditorPanelOnFakeServerWithSlices } from './itemEditorOnFakeServer.testSupport';
import { countDrawsOfEachLabel, startCountingLabelDraws } from './labelDrawCounter.testSupport';

// The ui Label is replaced by the counting stand-in for this whole file (header).
vi.mock('@/components/ui/label', () => import('./labelDrawCounter.testSupport'));
// And the generated form by its counting stand-in, so a form that redraws is seen even
// when its memoised rows hide it (header).
vi.mock('@/features/schemaForm', async (importOriginal) => {
  const schemaForm = await importOriginal<typeof import('@/features/schemaForm')>();
  const { buildSchemaFormFieldsThatCountTheirDraws } =
    await import('./generatedFormDrawCounter.testSupport');
  return {
    ...schemaForm,
    SchemaFormFields: buildSchemaFormFieldsThatCountTheirDraws(schemaForm.SchemaFormFields),
  };
});

// Twice the suite's 15 s for this file only: the card is the editor's worst case (eleven
// bound rows, each with its own dropdowns), and two picks in it took about 2.5 s here and
// 16.5 s on a slower machine under the full suite (gate 2 of PR #55), over the 15 s that
// is meant to catch a hang. Opening the card already split saved under 0.5 s; the
// dropdowns are the cost. A test that hangs still fails, at 30 s.
vi.setConfig({ testTimeout: 30_000 });

/** The labels of the battle card's rows, as the editor draws them. */
const gapLabel = 'Diferença entre os carros (ms)';
const leaderTeamLabel = 'Equipe do carro da frente';
const secondSchoolLabel = 'Escola do carro de trás';
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

/**
 * Opens the editor on the stored battle card of the two leaders, the race at lap 34, with
 * each car's fields in rows of their own ("Campos separados") from the start.
 */
function renderEditorOnTheBattleCardOfTheLeaders() {
  const itemThatOpensSplit = buildBattleCardOfTheLeadersItemThatOpensSplit();
  return renderItemEditorPanelOnFakeServerWithSlices(itemThatOpensSplit, {
    ...buildSlicesWithTheBattleCardOfTheLeaders(),
    items: [itemThatOpensSplit],
  });
}

/** The labels each car's picker draws once per draw: its car number's. */
const carPickerLabels = ['Número do carro — Carro da frente', 'Número do carro — Carro de trás'];

/** Forgets every draw of the rows and of the form counted so far. */
function startCountingDraws(): void {
  startCountingLabelDraws();
  startCountingGeneratedFormDraws();
}

/** When the simulator's data the page holds was received. */
function readMomentOfTheSimulatorsData(serverStateStore: ServerStateStore): number | undefined {
  return serverStateStore.getState().dataSnapshots[0]?.receivedAtMs;
}

describe('the item editor on a battle card read live, when a poll arrives', () => {
  it('redraws no field row when the poll changes nothing the card shows', () => {
    // Arrange: the editor open on the battle card, every draw so far forgotten.
    const { fakeServer, serverStateStore } = renderEditorOnTheBattleCardOfTheLeaders();
    startCountingDraws();

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
    expect(countGeneratedFormDraws(), 'a poll must not redraw the form around the rows').toBe(0);
  });

  it('redraws at most the row whose value the poll changed, and that row says the new value', () => {
    // Arrange: the editor open on the battle card, car 38 19,1 s behind the leader.
    const { fakeServer, serverStateStore } = renderEditorOnTheBattleCardOfTheLeaders();
    startCountingDraws();

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
    expect(countGeneratedFormDraws(), 'a poll must not redraw the form around the rows').toBe(0);
    expect(
      countDrawsOfEachLabel([gapLabel])[gapLabel],
      'the row of the changed value is drawn at most once',
    ).toBeLessThanOrEqual(1);
    expect(
      within(findRowOfField(gapLabel)).getByText('Valor agora: 18.400'),
      '"Valor agora" of the gap must say the new gap',
    ).toBeInTheDocument();
  });
});

describe('the item editor on a battle card read live, when the operator works', () => {
  it('redraws only the fields picked in, pick after pick', () => {
    // Arrange: the editor open on the battle card, every draw so far forgotten.
    renderEditorOnTheBattleCardOfTheLeaders();
    startCountingDraws();

    // Act: the car ahead's team, then the car behind's school, set to "Congelado na entrada".
    chooseOptionInDropdown(`Quando ${leaderTeamLabel} lê a fonte`, 'Congelado na entrada');
    chooseOptionInDropdown(`Quando ${secondSchoolLabel} lê a fonte`, 'Congelado na entrada');

    // Assert: no other row was drawn again, nor the form around them.
    const otherLabels = listFieldLabelsOtherThan([leaderTeamLabel, secondSchoolLabel]);
    expect(
      countDrawsOfEachLabel(otherLabels),
      'a pick in one field must redraw no other row',
    ).toEqual(buildNoDrawForEach(otherLabels));
    expect(countGeneratedFormDraws(), 'a pick must not redraw the form around the rows').toBe(0);
  });

  it('redraws no other row while the operator types in the one typed field', () => {
    // Arrange: the editor open on the battle card, every draw so far forgotten.
    renderEditorOnTheBattleCardOfTheLeaders();
    startCountingDraws();

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
    expect(
      countGeneratedFormDraws(),
      'typing in one field must not redraw the form around the rows',
    ).toBe(0);
  });

  it('redraws no row of the graphic while the operator types the item’s label', () => {
    // Arrange: the editor open on the battle card, every draw so far forgotten.
    renderEditorOnTheBattleCardOfTheLeaders();
    startCountingDraws();

    // Act: rename the item, one keystroke at a time, in the editor's own "Rótulo".
    const itemLabelInput = screen.getByRole('textbox', { name: 'Rótulo' });
    fireEvent.change(itemLabelInput, { target: { value: 'Disputa — líder e 2º!' } });
    fireEvent.change(itemLabelInput, { target: { value: 'Disputa — líder e 2º!!' } });

    // Assert: no row of the battle card was drawn again.
    expect(
      countDrawsOfEachLabel(battleCardFieldLabels),
      'typing the item’s label must redraw no row of the graphic',
    ).toEqual(buildNoDrawForEach(battleCardFieldLabels));
    expect(
      countGeneratedFormDraws(),
      'typing the item’s label must not redraw the graphic’s form',
    ).toBe(0);
  });
});

describe('the item editor on a battle card with each car picked once, when a poll arrives', () => {
  it("redraws neither car's picker, and the gap's line says the new gap", () => {
    // Arrange: the editor open on the battle card as it opens, each car picked by number.
    const { fakeServer, serverStateStore } = renderItemEditorPanelOnFakeServerWithSlices(
      buildBattleCardOfTheLeadersItem(),
      buildSlicesWithTheBattleCardOfTheLeaders(),
    );
    startCountingDraws();

    // Act: the next poll, in which car 38 closes to 18,4 s.
    fakeServer.sendMessage(buildNextPollWhereTheSecondCarCloses());

    // Assert: the page took the poll; no picker and no form drawn again; the line updated.
    expect(
      readMomentOfTheSimulatorsData(serverStateStore),
      'the page must have taken the next poll, or nothing was tested',
    ).toBe(momentOfTheNextPollMs);
    expect(countDrawsOfEachLabel(carPickerLabels), "a poll must not redraw a car's picker").toEqual(
      buildNoDrawForEach(carPickerLabels),
    );
    expect(countGeneratedFormDraws(), 'a poll must not redraw the form around the pickers').toBe(0);
    expect(
      within(findRowOfField(gapLabel)).getByText('Valor agora: 18.400'),
      "the gap's line in the car behind's picker must say the new gap",
    ).toBeInTheDocument();
  });
});
