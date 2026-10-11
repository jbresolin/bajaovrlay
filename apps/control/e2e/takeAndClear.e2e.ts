/**
 * Take and clear, end to end (apps/control, Playwright)
 *
 * What this module is for:
 *   An operator must be able to open the control page, put the race clock on air, change
 *   it while it is on air without it leaving the screen, and take it off again, with the
 *   server as the only owner of the state. This test walks that path in a real Chromium
 *   against the real server, the real renderer page and a real SQLite file.
 *
 * What these tests prove:
 *   - Filling the race clock form and pressing "Colocar no ar" makes the layer panel
 *     show the clock on the "Relógio" layer within 2 seconds, and the program monitor
 *     (the renderer page in a frame, as OBS loads it) contains the race clock element.
 *   - Within 3 seconds of the take the layer panel says "No ar": the renderer page in the
 *     program monitor told the server it played the clock, and the server told this page.
 *   - Changing the flag and pressing "Atualizar" changes the flag band of the clock in
 *     the program monitor, and the clock there is the very same element as before: it
 *     was updated in place and never left the screen (no blink).
 *   - Reloading the page changes nothing: the panel still shows the clock, because the
 *     state lives on the server and not in the page; and the form comes back showing
 *     what is on air instead of its defaults.
 *   - Pressing "Limpar" on that layer brings it back to "vazia".
 *
 * What these tests deliberately do not cover:
 *   - What the clock in the program monitor looks like or which time it shows; the
 *     renderer's raceClockOnAir.e2e.ts checks that. Here it only has to be in the frame,
 *     stay the same element and show the new flag's word.
 *   - That "No ar" appears within one second, as the brief says. That is checked by eye
 *     in OBS; here the limit is 3 seconds, because the clock's own play-in animation
 *     takes 600 ms of any such second and a busy CI machine can use up the rest.
 *   - What OBS itself shows: the report comes from the program monitor's renderer page.
 *   - A graphic that fails to load ("Falhou"); the renderer's own browser tests and
 *     InstanceStatusBadge.test.tsx cover the two halves of that.
 *   - A restart of the server keeping the state; the server's storeRestart.test.ts does.
 *   - Field validation, clear all and the keyboard; the component tests cover those.
 *
 * What it needs: the race clock and the renderer built (`pnpm build`), because the server
 * only registers built graphics and the program monitor frames the built renderer page.
 */
import { expect, test } from '@playwright/test';

test.describe('taking, updating and clearing the race clock', () => {
  test('shows the clock on its layer after the take, updates it in place, keeps it across a reload, and empties the layer on clear', async ({
    page,
  }) => {
    // Arrange: open the control page, wait until it is connected, and fill the form for
    // the endurance race, 12 min 34 s in, under the green flag, with the clock running.
    await page.goto('/');
    await expect(
      page.getByRole('status', { name: 'Conexão com o servidor' }),
      'the page must connect to the server before anything can be taken',
    ).toHaveText('Conectado');
    const clockLayerRow = page.getByRole('listitem', { name: 'Relógio' });
    await expect(clockLayerRow, 'the clock layer must start empty on a new database').toContainText(
      'vazia',
    );
    await page.getByLabel('Nome da sessão').fill('Enduro de Resistência — Bateria 1');
    await page.getByRole('combobox', { name: 'Bandeira' }).click();
    await page.getByRole('option', { name: 'Verde' }).click();
    await page.getByRole('switch', { name: 'Relógio correndo' }).click();
    await page.getByLabel('Tempo de referência (mm:ss)').fill('12:34');

    // Act: put the clock on air.
    await page.getByRole('button', { name: 'Colocar no ar' }).click();

    // Assert: the layer panel comes to say the clock is "No ar". That word only appears
    // after the renderer page in the program monitor has played the clock in (a 600 ms
    // animation) and reported it to the server, so it proves the whole round trip. The
    // limit is 3 seconds, by João's ruling: the brief's one second leaves too little
    // after the animation on a busy CI machine, and no limit at all would let a round
    // trip that has become slow go unnoticed.
    await expect(
      clockLayerRow,
      'the layer panel must say "No ar" within 3 seconds of the take, once the renderer page has reported the clock',
    ).toContainText('No ar', { timeout: 3_000 });
    // And within 2 seconds the layer panel shows the race clock on the clock layer.
    await expect(
      clockLayerRow,
      'the layer panel must show the race clock within 2 seconds of the take',
    ).toContainText('Relógio de prova', { timeout: 2_000 });
    await expect(clockLayerRow, 'a layer with the clock on it is not "vazia"').not.toContainText(
      'vazia',
    );
    // The program monitor is the renderer page in a frame, so the clock element must be
    // inside that frame, on the clock layer, exactly as OBS would have it.
    const raceClockInProgramMonitor = page
      .frameLocator('iframe[title="Programa"]')
      .locator('[data-layer-id="clock"] > baja-graphic-race-clock');
    await expect(
      raceClockInProgramMonitor,
      'the program monitor frame must contain the race clock element after the take',
    ).toBeAttached();

    await expect(
      raceClockInProgramMonitor.getByTestId('race-clock-flag-label'),
      'the clock in the program monitor must show the green flag it was taken with',
    ).toHaveText('VERDE');

    // Arrange (for the update): remember which element the clock in the program monitor
    // is. A handle points at that one element; it is not found again later.
    const raceClockElementBeforeTheUpdate = await raceClockInProgramMonitor.elementHandle();

    // Act: a yellow flag comes out. Change only the flag and press "Atualizar".
    await page.getByRole('combobox', { name: 'Bandeira' }).click();
    await page.getByRole('option', { name: 'Amarela' }).click();
    await page.getByRole('button', { name: 'Atualizar' }).click();

    // Assert: the clock in the program monitor shows the yellow flag, and it is the same
    // element as before the update. Had the clock been taken off and put back (the blink
    // this command exists to remove), a new element would be in its place.
    await expect(
      raceClockInProgramMonitor.getByTestId('race-clock-flag-label'),
      'after "Atualizar" the clock in the program monitor must show the yellow flag',
    ).toHaveText('AMARELA');
    const isTheSameElementAsBeforeTheUpdate = await raceClockInProgramMonitor.evaluate(
      (raceClockElementNow, raceClockElementBefore) =>
        raceClockElementNow === raceClockElementBefore,
      raceClockElementBeforeTheUpdate,
    );
    expect(
      isTheSameElementAsBeforeTheUpdate,
      'the race clock must be updated in place: the same element as before, not a new one',
    ).toBe(true);
    await expect(
      clockLayerRow,
      'an update must leave the clock "No ar"; it never goes back to "Carregando"',
    ).toContainText('No ar');

    // Act: reload the page, as an operator does when the browser misbehaves.
    await page.reload();

    // Assert: nothing was lost, because the server is the truth; and since the clock is
    // on air, the panel offers "Atualizar" and its form shows what is on air, yellow flag
    // included. (The time field is not checked: the clock is running, so its text depends
    // on the second.)
    await expect(
      clockLayerRow,
      'after a reload the layer panel must still show the race clock',
    ).toContainText('Relógio de prova');
    await expect(
      page.getByRole('button', { name: 'Atualizar' }),
      'with the clock on air the form must offer "Atualizar"',
    ).toBeVisible();
    await expect(
      page.getByLabel('Nome da sessão'),
      'after a reload the form must show the session name that is on air, not its default',
    ).toHaveValue('Enduro de Resistência — Bateria 1');
    await expect(
      page.getByRole('combobox', { name: 'Bandeira' }),
      'after a reload the form must show the flag that is on air',
    ).toHaveText('Amarela');
    await expect(
      page.getByRole('switch', { name: 'Relógio correndo' }),
      'after a reload the switch must be on, because the clock on air is running',
    ).toBeChecked();

    // Act: clear the clock layer.
    await clockLayerRow.getByRole('button', { name: 'Limpar' }).click();

    // Assert: the layer is empty again.
    await expect(clockLayerRow, 'after "Limpar" the clock layer must say "vazia"').toContainText(
      'vazia',
    );
  });
});
