/**
 * The item editor stays fast during a race (apps/control, Playwright)
 *
 * What this module is for:
 *   Operators edit items while the race runs. Gate 2 of PR #27 found the editor crawling
 *   there: with the simulator at speed 60 and a battle card's eleven fields read live,
 *   each click took longer than the one before (0,2 s, then 16 s by the 6th bound field)
 *   and "Salvar e disparar" took 71 s to register (BAJAOVRLAY-45). This test opens such
 *   an item while the race runs and times the two things an operator does most, so that
 *   slowness fails here with a clear message instead of somewhere else as a timeout.
 *
 * What these tests prove:
 *   - With the simulator at 60×, read every 0,5 s, and a battle card on air whose eleven
 *     fields read cars 1 and 2 by number, live, opened in the item editor:
 *     - a click on a bound field's "O que … lê da fonte" shows its options within 5 s;
 *     - "Salvar item" after a new label is accepted, and the editor closed, within 5 s.
 *
 * Why these bounds (João's ruling, gate 2 round 1 of PR #29):
 *   - Pinned to two cores here (`taskset -c 0,1`, server and browser on the same two) the
 *     broken editor took 8,5–11,3 s to open the dropdown and 2,1–2,4 s to save; the fixed
 *     one takes 0,29–0,33 s and 0,37–0,43 s. On a 2-core box about three times slower the
 *     review measured the fixed one at 0,6–0,95 s and 1,0–1,4 s, too close to a 2 s bound.
 *   - 5 s leaves CI's runner and React's development build (the control page's dev
 *     server) room. The broken editor took more than 5 s for the dropdown on every machine
 *     measured, so the dropdown still catches it.
 *   - The save's bound does not catch the old save (2,1–2,4 s): it guards against a stall
 *     like gate 2 of PR #27's 71 s. Redraws themselves are counted exactly by the component
 *     tests (ItemEditorPanelRenders.test.tsx), which fail at the first extra row.
 *   - About half of the fixed dropdown's time is not the editor's: a dropdown of three
 *     options opens in 130–160 ms here (Radix placing the list, the browser's layout and
 *     Playwright's own checks before a click).
 *
 * What these tests deliberately do not cover:
 *   - Which field rows redraw when a snapshot arrives: the component tests
 *     (ItemEditorPanelRenders.test.tsx) count them exactly.
 *   - Binding the fields by hand while the race runs: podiumBattleQrWalk.e2e.ts does that.
 *
 * What it needs: `pnpm build` (the server registers built graphics only).
 */
import { expect, type Locator, type Page, test } from '@playwright/test';

import { readInstanceOnAirOfLayerFromTheRealServer } from './dataSourceStateOnTheRealServer';
import {
  openDataSourcesPageAndWaitUntilConnected,
  seededSimulatorLabel,
  startTheSeededSimulatorFastFromTheGreenFlag,
} from './dataSourcesTestSteps';
import { emptyTheServerState, realServerPort } from './emptyTheServerState';
import { sendCommandOrFail } from './eventInboxOnTheRealServer';
import { findItemEditorOwnTextField } from './itemEditorOwnFields';
import { openControlPageAndWaitUntilConnected } from './previewTestSteps';

// The seeded simulator's id and the rundown every new database has.
const seededSimulatorId = 'simulador-enduro';
const mainSessionRundownId = 'sessao-principal';
const battleCardItemLabel = 'Disputa — carros 1 e 2';
// João's ruling: room for a runner three times slower, under the broken dropdown (header).
const slowestDropdownOpeningAllowedInMilliseconds = 5_000;
const slowestSaveAllowedInMilliseconds = 5_000;
// How long a wait inside a timed action may last: past every bound, so a slow editor
// fails with the bound's message below, not as the test's own timeout.
const longestWaitInATimedActionInMilliseconds = 60_000;
// A take reaches the server at once; a few seconds cover a slow machine.
const waitForTheAirInMilliseconds = 10_000;

/** One field of the battle card read live from a car chosen by its number. */
function buildLiveBindingToCar(path: string, carNumber: number) {
  return {
    kind: 'binding',
    sourceId: seededSimulatorId,
    shapeKey: 'positions',
    path: `entryOfCar.${path}`,
    carNumber,
    isLive: true,
  };
}

/**
 * The battle card as the walk binds it: car 1 ahead and car 2 behind, five values each and
 * the gap, all eleven read live, as an operator prepares it for the two leaders.
 */
function buildBattleCardOfCars1And2Command() {
  return {
    type: 'createItem',
    home: { kind: 'rundown', rundownId: mainSessionRundownId },
    graphicId: 'battle-card',
    layerId: 'lower-third',
    label: battleCardItemLabel,
    fields: {
      aheadPosition: buildLiveBindingToCar('position', 1),
      aheadCarNumber: buildLiveBindingToCar('carNumber', 1),
      aheadTeamName: buildLiveBindingToCar('teamName', 1),
      aheadSchoolName: buildLiveBindingToCar('schoolName', 1),
      aheadLaps: buildLiveBindingToCar('laps', 1),
      behindPosition: buildLiveBindingToCar('position', 2),
      behindCarNumber: buildLiveBindingToCar('carNumber', 2),
      behindTeamName: buildLiveBindingToCar('teamName', 2),
      behindSchoolName: buildLiveBindingToCar('schoolName', 2),
      behindLaps: buildLiveBindingToCar('laps', 2),
      gapMs: buildLiveBindingToCar('intervalMs', 2),
    },
  };
}

/** Opens the stored item in the editor from its rundown row ("Editar item"). */
async function openStoredItemInTheEditor(page: Page, itemLabel: string): Promise<Locator> {
  await page
    .getByRole('listitem', { name: itemLabel })
    .getByRole('button', { name: 'Editar item', exact: true })
    .click();
  const itemEditor = page.getByRole('region', { name: 'Editor de item' });
  await expect(itemEditor, 'the editor must open on the battle card').toBeVisible();
  return itemEditor;
}

/** Writes a measured time on the test's report, where the PR's table is read from. */
function recordMeasuredTime(name: string, milliseconds: number): void {
  test.info().annotations.push({ type: name, description: `${milliseconds.toFixed(0)} ms` });
}

test.beforeEach(async () => {
  await emptyTheServerState();
});

test.describe('the item editor on a battle card read live while the race runs at 60×', () => {
  test('opens a bound field’s path dropdown within 5 s and saves within 5 s', async ({ page }) => {
    // The arrange (about 15 s) and both timed actions at their longest wait (header).
    test.setTimeout(150_000);

    // Arrange: the race at 60×, read every 0,5 s; the battle card of cars 1 and 2 stored
    // and on air, so its eleven live fields refresh at every poll; the editor open on it.
    await openDataSourcesPageAndWaitUntilConnected(page);
    await startTheSeededSimulatorFastFromTheGreenFlag(page);
    const { createdItemId } = await sendCommandOrFail(
      realServerPort,
      buildBattleCardOfCars1And2Command(),
    );
    await sendCommandOrFail(realServerPort, { type: 'takeItem', itemId: createdItemId });
    await expect
      .poll(async () => readInstanceOnAirOfLayerFromTheRealServer('lower-third'), {
        message: 'the battle card must be on air before the editor is opened',
        timeout: waitForTheAirInMilliseconds,
      })
      .toBeDefined();
    await openControlPageAndWaitUntilConnected(page);
    const itemEditor = await openStoredItemInTheEditor(page, battleCardItemLabel);
    const pathDropdown = itemEditor.getByRole('combobox', {
      name: 'O que Equipe do carro da frente lê da fonte',
      exact: true,
    });
    await expect(pathDropdown, 'the bound field must show its path dropdown').toBeVisible();

    // Act 1: click the path dropdown of the car ahead's team and wait for its options.
    const dropdownClickedAtMs = performance.now();
    await pathDropdown.click();
    await expect(
      page.getByRole('option', {
        name: 'Posições › Carro escolhido pelo número › Equipe',
        exact: true,
      }),
      'the dropdown must list the path the field reads',
    ).toBeVisible({ timeout: longestWaitInATimedActionInMilliseconds });
    const dropdownOpeningMs = performance.now() - dropdownClickedAtMs;
    recordMeasuredTime('dropdownOpeningMs', dropdownOpeningMs);

    // Assert 1: the dropdown opened in time, checked at once so a slow one fails here.
    expect(
      dropdownOpeningMs,
      `the dropdown must open within ${slowestDropdownOpeningAllowedInMilliseconds} ms during the race`,
    ).toBeLessThan(slowestDropdownOpeningAllowedInMilliseconds);
    await page.keyboard.press('Escape');

    // Act 2: give the item a new label and press "Salvar item"; the editor closes once the
    // server has accepted the save.
    await findItemEditorOwnTextField(itemEditor, 'Rótulo').fill(`${battleCardItemLabel} (final)`);
    const saveClickedAtMs = performance.now();
    await itemEditor.getByRole('button', { name: 'Salvar item' }).click();
    await expect(itemEditor, 'the editor must close once the server accepted the save').toBeHidden({
      timeout: longestWaitInATimedActionInMilliseconds,
    });
    const saveMs = performance.now() - saveClickedAtMs;
    recordMeasuredTime('saveMs', saveMs);

    // Assert 2: the save registered in time, and the rundown shows the new label.
    expect(
      saveMs,
      `the save must register within ${slowestSaveAllowedInMilliseconds} ms during the race`,
    ).toBeLessThan(slowestSaveAllowedInMilliseconds);
    expect(
      await page.getByRole('listitem', { name: `${battleCardItemLabel} (final)` }).count(),
      `the rundown must list the item under its new label, with ${seededSimulatorLabel} on`,
    ).toBe(1);
  });
});
