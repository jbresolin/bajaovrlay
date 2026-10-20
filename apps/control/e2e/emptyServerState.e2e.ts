/**
 * Emptying the server between browser tests (apps/control, Playwright)
 *
 * What this module is for:
 *   Every browser test of the control page runs against one real server, one after the
 *   other. A test that stops halfway leaves the clock on air or an item in the rundown,
 *   and the next test then fails for a reason that is not its own. So every test file in
 *   this folder calls `emptyTheServerState` before each of its tests. This file proves
 *   that function does what the others rely on.
 *
 * What these tests prove:
 *   - With the race clock on air, an item in the rundown and that item previewed,
 *     `emptyTheServerState` leaves the clock layer "vazia", nothing in preview and the
 *     rundown without items, as the control page shows it, and the seeded rundown
 *     "Sessão principal" is still there.
 *   - With the clock layer marked "vai limpar" ("Prévia: limpar"), `emptyTheServerState`
 *     leaves no mark: its `clearAll` removes the marks with everything else.
 *   - With a second panel, a button in "Atalhos" and a macro, `emptyTheServerState` leaves
 *     only the seeded panel "Atalhos", empty, and no macro.
 *   - With the seeded simulator set to speed 60, read every 0,5 s, with "Falha simulada"
 *     on, turned on and recording, and a second simulator "Simulador — Treino livre",
 *     `emptyTheServerState` leaves only the seeded simulator, off ("Desligada"), not
 *     recording, and with its default settings back (read every 2 s, speed 1, "Falha
 *     simulada" off). Its race start is not put back: no command can while it is off,
 *     so each data source test restarts the race itself ("Reiniciar corrida").
 *   - With the simulator's session name corrected ("Corrigir valor…"), `emptyTheServerState`
 *     leaves no correction (BAJAOVRLAY-20).
 *   - Called on a server that is already empty, it changes nothing and does not fail.
 *
 * What these tests deliberately do not cover:
 *   - That the other test files call it before each test; each of them does so in a
 *     `test.beforeEach` at its top, which is there to be read.
 *   - Layers and graphics: no command changes them, so there is nothing to put back.
 *   - The event log, which keeps its rows; no browser test reads it.
 *   - A macro still running when the reset starts: the reset waits for it to end, which
 *     the macro e2e (macroTakeWaitClear.e2e.ts) leaves behind only for half a second.
 *   - "Atalhos" renamed by a test: no test renames it today; the reset names it back.
 *   - Recordings: their files stay replayable, so the reset keeps them listed; and the
 *     seeded simulator's last data, which no command deletes (it shows as "fonte
 *     desligada" until the simulator is turned on again).
 *   - The seeded simulator deleted by a test: no test deletes it, and no command can
 *     bring it back (only a restart on an empty source list does), so the reset skips it.
 *
 * What it needs: the race clock built (`pnpm build`), because the server only registers
 * built graphics.
 */
import { expect, type Page, test } from '@playwright/test';

import {
  changeSimulatorInItsEditForm,
  findDataSourceRow,
  findStatusChipOfSourceRow,
  openDataSourcesPageAndWaitUntilConnected,
  openNewSourceFormOfKind,
  pollIntervalOfTheTestsAsTyped,
  seededSimulatorLabel,
  turnSourceOnWithItsSwitch,
} from './dataSourcesTestSteps';
import { emptyTheServerState } from './emptyTheServerState';
import { openItemEditorWithNewGraphic, saveAndTakeTheItemInTheEditor } from './previewTestSteps';
import { createRaceClockButtonInPanelShown, findQuickFireArea } from './quickFireTestSteps';

/** Opens the control page and waits until it says it is connected to the server. */
async function openControlPageAndWaitUntilConnected(page: Page): Promise<void> {
  await page.goto('/');
  await expect(
    page.getByRole('status', { name: 'Conexão com o servidor' }),
    'the page must connect to the server before anything can be taken',
  ).toHaveText('Conectado');
}

test.beforeEach(async () => {
  await emptyTheServerState();
});

test.describe('emptying the server state', () => {
  test('takes the clock off air and every item out of the rundown, and keeps the rundown itself', async ({
    page,
  }) => {
    // Arrange: leave behind what a test that stopped halfway would: one item prepared in
    // the rundown, the race clock on air from it ("Salvar e disparar" in the item
    // editor), and the same item on the preview output.
    await openControlPageAndWaitUntilConnected(page);
    const clockLayerRow = page
      .getByRole('region', { name: 'Camadas' })
      .getByRole('listitem', { name: 'Relógio' });
    const rundownArea = page.getByRole('region', { name: 'Rundown' });
    const quickEditArea = page.getByRole('region', { name: 'Programa e edição rápida' });
    await page.getByRole('button', { name: '+ Item' }).click();
    const itemEditor = page.getByRole('region', { name: 'Editor de item' });
    await itemEditor.getByLabel('Rótulo', { exact: true }).fill('Largada do enduro');
    await itemEditor.getByLabel('Título', { exact: true }).fill('Enduro — Largada');
    await saveAndTakeTheItemInTheEditor(itemEditor);
    await expect(clockLayerRow, 'the clock must be on its layer before the reset').toContainText(
      'Relógio de prova',
    );
    await expect(
      rundownArea.getByRole('listitem'),
      'the rundown must hold the one item before the reset',
    ).toHaveCount(1);
    // And that item previewed: a preview is server state too, and it would show up under
    // the "Prévia" monitor of the next test.
    await rundownArea
      .getByRole('listitem', { name: 'Largada do enduro' })
      .getByRole('button', { name: 'Prévia', exact: true })
      .click();
    await expect(
      quickEditArea.getByRole('list', { name: 'Em prévia' }).getByRole('listitem'),
      'the item must be previewed before the reset',
    ).toHaveCount(1);
    await expect(
      clockLayerRow,
      'the clock layer must carry the preview chip before the reset',
    ).toContainText('em prévia');

    // Act: empty the server, as every test file does before each of its tests.
    await emptyTheServerState();

    // Assert: the page, which only repeats the server, shows an empty layer, nothing in
    // preview and an empty rundown, and the seeded rundown is still there to be filled.
    await expect(clockLayerRow, 'after the reset the clock layer must say "vazia"').toContainText(
      'vazia',
    );
    await expect(
      quickEditArea.getByText('Nada em prévia.'),
      'after the reset nothing may be left on the preview output',
    ).toBeVisible();
    await expect(
      clockLayerRow,
      'after the reset the clock layer must no longer carry the preview chip',
    ).not.toContainText('em prévia');
    await expect(
      rundownArea.getByRole('listitem'),
      'after the reset the rundown must hold no item',
    ).toHaveCount(0);
    await expect(
      rundownArea.getByRole('heading', { name: 'Sessão principal' }),
      'the reset must keep the seeded rundown itself',
    ).toBeVisible();
  });

  test('removes a "vai limpar" mark', async ({ page }) => {
    // Arrange: the race clock on air from a new graphic ("Novo gráfico…", "Salvar e
    // disparar"), and its layer marked with "Prévia: limpar" on its "Camadas" row; the mark
    // is server state the next test would see.
    await openControlPageAndWaitUntilConnected(page);
    const clockLayerRow = page
      .getByRole('region', { name: 'Camadas' })
      .getByRole('listitem', { name: 'Relógio' });
    const quickEditArea = page.getByRole('region', { name: 'Programa e edição rápida' });
    const itemEditor = await openItemEditorWithNewGraphic(page, 'Relógio da sessão');
    await itemEditor.getByLabel('Título', { exact: true }).fill('Enduro de Resistência');
    await saveAndTakeTheItemInTheEditor(itemEditor);
    await expect(clockLayerRow, 'the clock must be on its layer before the mark').toContainText(
      'Relógio de prova',
    );
    await clockLayerRow.getByRole('button', { name: 'Prévia: limpar' }).click();
    await expect(clockLayerRow, 'the clock layer must be marked before the reset').toContainText(
      'vai limpar',
    );

    // Act: empty the server.
    await emptyTheServerState();

    // Assert: no mark on the row, nothing under "Prévia", and the layer empty.
    await expect(clockLayerRow, 'after the reset the clock layer must say "vazia"').toContainText(
      'vazia',
    );
    await expect(
      clockLayerRow,
      'after the reset no layer may still be marked "vai limpar"',
    ).not.toContainText('vai limpar');
    await expect(
      quickEditArea.getByText('Nada em prévia.'),
      'after the reset no mark may be listed under the "Prévia" monitor',
    ).toBeVisible();
  });

  test('deletes the macros, the panels made since the seed and every button', async ({ page }) => {
    // Arrange: leave behind a button in "Atalhos", a second panel "Patrocinadores" and a
    // macro "Fechar a sessão" (one "Limpar tudo" step), all made from the page.
    await openControlPageAndWaitUntilConnected(page);
    const quickFireArea = findQuickFireArea(page);
    await createRaceClockButtonInPanelShown(page, 'Relógio do box', 'Entrevista no box');
    await quickFireArea.getByRole('button', { name: '+ Painel' }).click();
    await quickFireArea.getByLabel('Nome do novo painel').fill('Patrocinadores');
    await quickFireArea.getByRole('button', { name: 'Criar painel' }).click();
    await expect(
      quickFireArea.getByRole('tab', { name: 'Patrocinadores' }),
      'the second panel must exist before the reset',
    ).toBeVisible();
    await quickFireArea.getByRole('tab', { name: 'Macros' }).click();
    await quickFireArea.getByRole('button', { name: '+ Macro' }).click();
    const macroEditor = page.getByRole('region', { name: 'Editor de macro' });
    await macroEditor.getByLabel('Rótulo da macro').fill('Fechar a sessão');
    await macroEditor.getByRole('button', { name: '+ Passo' }).click();
    await macroEditor.getByRole('combobox', { name: 'Tipo do passo 1' }).click();
    await page.getByRole('option', { name: 'Limpar tudo', exact: true }).click();
    await macroEditor.getByRole('button', { name: 'Salvar macro' }).click();
    await expect(
      quickFireArea.getByRole('list', { name: 'Macros' }).getByRole('listitem'),
      'the macro must exist before the reset',
    ).toHaveCount(1);

    // Act: empty the server.
    await emptyTheServerState();

    // Assert: no macro, only "Atalhos" (plus the Macros tab), and "Atalhos" is empty.
    await expect(
      quickFireArea.getByText('Nenhuma macro. Use "+ Macro" para criar a primeira.'),
      'after the reset no macro may be left',
    ).toBeVisible();
    await expect(
      quickFireArea.getByRole('tab'),
      'after the reset only the seeded panel and the Macros tab may be left',
    ).toHaveText([/^Atalhos/, /^Macros/]);
    await quickFireArea.getByRole('tab', { name: 'Atalhos' }).click();
    await expect(
      quickFireArea.getByText('Crie um item aqui para ter um atalho'),
      'after the reset the seeded panel must have no button',
    ).toBeVisible();
  });

  test('turns the seeded simulator off with its default settings and deletes the other sources', async ({
    page,
  }) => {
    // Arrange: on the "Fontes de dados" page, leave behind what a data source test that
    // stopped halfway would: the seeded simulator at speed 60, read every 0,5 s, failing
    // on purpose, on and recording; and a second simulator, "Simulador — Treino livre",
    // made with "+ Fonte".
    await openDataSourcesPageAndWaitUntilConnected(page);
    await changeSimulatorInItsEditForm(page, seededSimulatorLabel, {
      pollIntervalAsTyped: pollIntervalOfTheTestsAsTyped,
      speedAsTyped: '60',
      isFailing: true,
    });
    await turnSourceOnWithItsSwitch(page, seededSimulatorLabel);
    const seededSimulatorRow = findDataSourceRow(page, seededSimulatorLabel);
    await seededSimulatorRow.getByRole('button', { name: 'Gravar' }).click();
    await expect(
      seededSimulatorRow.getByText('Gravando'),
      'the seeded simulator must be recording before the reset',
    ).toBeVisible();
    const newSimulatorForm = await openNewSourceFormOfKind(page, 'Simulador');
    await newSimulatorForm.getByLabel('Nome da fonte').fill('Simulador — Treino livre');
    await newSimulatorForm.getByRole('button', { name: 'Salvar fonte' }).click();
    await expect(
      findDataSourceRow(page, 'Simulador — Treino livre'),
      'the second simulator must exist before the reset',
    ).toBeVisible();

    // Act: empty the server.
    await emptyTheServerState();

    // Assert: only the seeded simulator is listed, off and not recording, and its
    // "Editar" form shows the seeded read every 2 s, the default speed 1 and "Falha
    // simulada" off.
    await expect(
      page.getByRole('list', { name: 'Fontes de dados' }).getByRole('listitem'),
      'after the reset only the seeded simulator may be listed',
    ).toHaveCount(1);
    await expect(
      findStatusChipOfSourceRow(seededSimulatorRow),
      'after the reset the seeded simulator must be off',
    ).toHaveText('Desligada');
    await expect(
      seededSimulatorRow.getByText('Gravando'),
      'after the reset the seeded simulator must not be recording',
    ).toBeHidden();
    await seededSimulatorRow.getByRole('button', { name: 'Editar' }).click();
    const editForm = page.getByRole('region', { name: `Editar fonte: ${seededSimulatorLabel}` });
    await expect(
      editForm.getByLabel('Intervalo de leitura (segundos)'),
      'after the reset the seeded simulator must be read every 2 s again',
    ).toHaveValue('2');
    await expect(
      editForm.getByLabel('Velocidade (vezes o tempo real)'),
      'after the reset the seeded simulator must run at its default speed 1',
    ).toHaveValue('1');
    await expect(
      editForm.getByRole('switch', { name: 'Falha simulada' }),
      'after the reset the seeded simulator must not fail on purpose',
    ).not.toBeChecked();
  });

  test("removes the corrections of a source's values", async ({ page }) => {
    // Arrange: the seeded simulator on with data, and its session name corrected from
    // the session card, as a data operator does ("Corrigir valor…").
    await openDataSourcesPageAndWaitUntilConnected(page);
    await turnSourceOnWithItsSwitch(page, seededSimulatorLabel);
    const sessionNameButton = page.getByRole('button', { name: /^Nome da sessão: / });
    await sessionNameButton.press('Enter');
    await page.getByRole('menuitem', { name: 'Corrigir valor…' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Valor corrigido').fill('Enduro — Etapa Nacional');
    await dialog.getByLabel('Motivo (obrigatório)').fill('Nome oficial da prova.');
    await dialog.getByRole('button', { name: 'Salvar correção' }).click();
    // The dialog closes on the server's ok: only then is the correction stored, and only
    // then may the reset run (gate 2 of PR #18). "corrigido" alone, not inside "Corrigir".
    await expect(dialog, 'the dialog closes once the correction is stored').toBeHidden();
    await expect(
      page.getByText('corrigido', { exact: true }),
      'the correction must be in force',
    ).toBeVisible();

    // Act: empty the server.
    await emptyTheServerState();

    // Assert: the correction is gone, the simulator's own name is back.
    await expect(
      page.getByText('corrigido', { exact: true }),
      'after the reset no value is corrected',
    ).toBeHidden();
  });

  test('changes nothing and does not fail on a server that is already empty', async ({ page }) => {
    // Arrange: the server was emptied before this test; open the page to see it.
    await openControlPageAndWaitUntilConnected(page);
    const clockLayerRow = page
      .getByRole('region', { name: 'Camadas' })
      .getByRole('listitem', { name: 'Relógio' });

    // Act: empty it once more.
    await emptyTheServerState();

    // Assert: still empty, and the call above did not throw.
    await expect(clockLayerRow, 'an already empty clock layer must stay "vazia"').toContainText(
      'vazia',
    );
    await expect(
      page.getByRole('region', { name: 'Rundown' }).getByRole('listitem'),
      'an already empty rundown must stay without items',
    ).toHaveCount(0);
  });
});
