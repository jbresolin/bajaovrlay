/**
 * Chaos: the server dies mid-show and starts again (apps/control, Playwright)
 *
 * What this module is for:
 *   The stream PC's server process can die mid-show: a crash, Docker restarting it, an
 *   update gone wrong. It starts again on the same data folder. The promise: what was on
 *   program comes back as it was, a running clock keeps its time, the output never shows a
 *   flash (it keeps drawing what it had while the server is gone, and does not replay any
 *   entrance once it is back), and the rest follows its documented boot rule.
 *
 * What these tests prove (the process killed with SIGKILL, so no shutdown code runs):
 *   - Program comes back as it was: the same instances, by id, on the same layers.
 *   - The race clock running on air keeps counting through the restart: its time shown
 *     afterwards is its time before plus the time that really passed, within a second.
 *   - Across the outage the clock and the lower third were on the output at every frame,
 *     and each played its entrance once.
 *   - Preview comes back empty: previews are dropped at every boot (docs/decisions.md,
 *     PR #12).
 *   - A macro killed in its wait is not resumed (docs/decisions.md, PR #13): no run after
 *     the boot, and the clear its last step would have made never comes; what it took
 *     stays on air.
 *   - The console reconnects by itself and shows program as it was.
 *
 * What these tests deliberately do not cover:
 *   - The event inbox's boot rule (nothing listed twice, nothing replayed):
 *     eventInboxAfterARestart.e2e.ts restarts a server mid-race for it.
 *   - A data source's last data kept and marked late at boot: startServerRestart.test.ts.
 *   - A stop with SIGTERM: a gentler death than this one; the boot rules are the same.
 */

import { chaosServerPort } from './steps/chaosPorts';
import { expect, test } from './steps/chaosTest';
import {
  findRaceClockTimeOnTheOutput,
  readRaceClockSecondsOnTheOutput,
} from './steps/clockOnTheOutput';
import {
  findLayerRowInCamadas,
  openTheConsoleAt,
  openTheProgramOutputAt,
  waitUntilTheConsoleIsConnected,
} from './steps/pagesOfTheShow';
import {
  makeLowerThirdButton,
  makeMacro,
  readStateOfTheChaosServer,
  sendCommandOrFail,
  takeRunningEnduroClock,
} from './steps/showOnTheChaosServer';
import { expectTheInstanceStayedOnAirUntouched } from './steps/whatTheAirShowed';

// The macro's wait before its clear: long enough to kill the server inside it, short
// enough that the scenario can then wait past it to prove the clear never comes.
const waitOfTheMacroInMilliseconds = 4_000;
// The clock may read up to a second either side of the time that passed: it shows whole
// seconds, read at two moments the test cannot line up with its ticks.
const clockToleranceInSeconds = 1;

test.describe('the server is killed mid-show and starts again', () => {
  test('brings program back as it was, keeps the clock running, drops the preview, does not resume the macro, and the output never flashes', async ({
    context,
    startChaosServer,
  }) => {
    // Arrange: the output and the console open; a running race clock taken; a lower
    // third taken by a macro now waiting to clear it; another lower third in preview.
    const server = await startChaosServer('serverRestart', chaosServerPort);
    const interviewItemId = await makeLowerThirdButton(
      server.port,
      'Tarja — capitã da UFPR',
      'Ana Souza',
    );
    const chiefItemId = await makeLowerThirdButton(
      server.port,
      'Tarja — chefe da UFSC',
      'Bruno Lima',
    );
    const macroId = await makeMacro(server.port, 'Entrevista no box', [
      { kind: 'takeItem', itemId: interviewItemId },
      { kind: 'wait', ms: waitOfTheMacroInMilliseconds },
      { kind: 'clearLayer', layerId: 'lower-third' },
    ]);
    const output = await openTheProgramOutputAt(context, server.address);
    const consolePage = await openTheConsoleAt(context, server.address);
    await takeRunningEnduroClock(server.port);
    await sendCommandOrFail(server.port, { type: 'runMacro', macroId });
    const macroStartedAtMs = Date.now();
    await sendCommandOrFail(server.port, { type: 'previewItem', itemId: chiefItemId });
    await expect(
      output.page.locator('[data-layer-id="lower-third"] > baja-graphic-lower-third'),
      'the macro must have put the lower third on air',
    ).toContainText('Ana Souza');
    await expect(
      findRaceClockTimeOnTheOutput(output.page),
      'the race clock must be on the output, counting from 1:05:00',
    ).toHaveText(/^\s*1:05:\d\d\s*$/);
    const stateBefore = await readStateOfTheChaosServer(server.port);
    const programBefore = stateBefore.instances.filter((instance) => instance.target === 'program');
    const clockSecondsBefore = await readRaceClockSecondsOnTheOutput(output.page);
    const clockReadAtMs = Date.now();
    // The scenario is a death inside the wait: the run must still be listed, and the wait
    // not over, the moment before the kill. Otherwise it would prove nothing of the rule.
    const stateJustBeforeTheKill = await readStateOfTheChaosServer(server.port);
    const millisecondsSinceTheMacroStarted = Date.now() - macroStartedAtMs;
    expect(
      stateJustBeforeTheKill.macroRuns.map((run) => run.macroId),
      'the macro must still be running when the server is killed',
    ).toEqual([macroId]);
    expect(
      millisecondsSinceTheMacroStarted,
      "the kill must come inside the macro's 4 s wait, before its clear is due",
    ).toBeLessThan(waitOfTheMacroInMilliseconds);

    // Act: the server is killed in the macro's wait, and started again on its folder.
    await server.kill();
    await server.startAgain();

    // Assert: program as it was, the preview dropped, no macro run.
    const stateAfter = await readStateOfTheChaosServer(server.port);
    const programAfter = stateAfter.instances.filter((instance) => instance.target === 'program');
    expect(
      programAfter.map((instance) => `${instance.layerId}: ${instance.id}`).sort(),
      'program must come back with the same instances on the same layers',
    ).toEqual(programBefore.map((instance) => `${instance.layerId}: ${instance.id}`).sort());
    expect(
      stateAfter.instances.filter((instance) => instance.target === 'preview'),
      'previews are dropped at boot (decisions.md, PR #12)',
    ).toEqual([]);
    expect(stateAfter.macroRuns, 'a macro cut by the death is not resumed').toEqual([]);

    // Assert: the console is back by itself and shows program, with Prévia empty.
    await waitUntilTheConsoleIsConnected(consolePage);
    await expect(
      findLayerRowInCamadas(consolePage, 'Tarja'),
      'the console must show the lower third still on air',
    ).toContainText('Tarja — capitã da UFPR');
    await expect(
      findLayerRowInCamadas(consolePage, 'Relógio'),
      'the console must show the clock still on air',
    ).toContainText('Relógio do enduro');

    // Assert: the clock on the output kept counting through the outage.
    await expect
      .poll(
        () => output.logLines.filter((line) => line.message === 'connected to the server').length,
        { message: 'the output must reconnect to the server started again' },
      )
      .toBe(2);
    const clockSecondsAfter = await readRaceClockSecondsOnTheOutput(output.page);
    const secondsThatPassed = (Date.now() - clockReadAtMs) / 1000;
    expect(
      Math.abs(clockSecondsAfter - clockSecondsBefore - secondsThatPassed),
      `the clock must have counted the ${secondsThatPassed.toFixed(1)} s that passed (it went from ${String(clockSecondsBefore)} to ${String(clockSecondsAfter)} s)`,
    ).toBeLessThanOrEqual(clockToleranceInSeconds + 0.5);

    // Assert: past the moment the macro's clear was due, the lower third is still on
    // air. A fixed wait, proving something does not happen: the rest of the wait and a
    // second more.
    const timeLeftOfTheWaitMs = macroStartedAtMs + waitOfTheMacroInMilliseconds - Date.now();
    await output.page.waitForTimeout(Math.max(timeLeftOfTheWaitMs, 0) + 1_000);
    await expect(
      output.page.locator('[data-layer-id="lower-third"] > baja-graphic-lower-third'),
      'the clear the killed macro would have made must never come',
    ).toContainText('Ana Souza');
    for (const instance of programBefore) {
      await expectTheInstanceStayedOnAirUntouched(
        output,
        instance.layerId,
        instance.id,
        'the server was killed and started again',
      );
    }
  });
});
