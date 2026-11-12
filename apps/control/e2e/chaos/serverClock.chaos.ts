/**
 * Chaos: the server clock and NTP (apps/control, Playwright)
 *
 * What this module is for:
 *   Every clock on air counts on the server clock, which follows NTP (BAJAOVRLAY-62). NTP
 *   can be out of reach at the track, and real time can turn out to be far from the
 *   server's (a stream PC whose clock drifted, a wrong NTP answer corrected). The promise:
 *   a clock on air never jumps by itself; the operator is told; and when the operator
 *   chooses to set the clock now, the warning says what will jump, and only that jumps.
 *   The server asks a fake NTP server on this machine (faults/fakeNtpForTheServer.ts),
 *   which answers this machine's time moved by an offset, so nobody touches a real clock.
 *
 * What these tests prove:
 *   - NTP out of reach: the server starts all the same, "Verificar servidor" says the
 *     clock follows nothing ("sem sincronização — hora do computador": the HTTPS fallback
 *     of BAJAOVRLAY-76 is off in every browser test), and a race clock on air runs on with
 *     real time.
 *   - Real time found 30 s ahead, with a race clock on air: once the step is confirmed (a
 *     second answer, 16 s after the first), the server holds it: the clock on air, read
 *     every second through it all, keeps counting without a jump, never blanks nor replays
 *     its entrance, and the header warns "Relógio do servidor 30 s fora da hora certa".
 *   - "Acertar relógio agora" with a countdown, a race clock and a lower third on air: the
 *     confirm says the race clock and the countdowns jump, and how far; once set, the
 *     countdown has 30 s less to go and the race clock 30 s more, while the lower third is
 *     untouched; none of the three blanks or replays its entrance.
 *
 * What these tests deliberately do not cover:
 *   - The arithmetic of NTP and the step rules (1 s, 24 h, the confirmation's second
 *     server): apps/server/src/core/time's Vitest tests.
 *   - A step with nothing counting time on air, which the server takes by itself:
 *     serverClockDiscipline's tests.
 */
import { type Page } from '@playwright/test';

import { type FakeNtpForTheServer, openFakeNtpForTheServer } from './faults/fakeNtpForTheServer';
import { chaosServerPort } from './steps/chaosPorts';
import { expect, test } from './steps/chaosTest';
import {
  readClockTextAsSeconds,
  readRaceClockSecondsOnTheOutput,
  startReadingTheRaceClockEverySecond,
  waitUntilTheRaceClockShowsATime,
} from './steps/clockOnTheOutput';
import {
  checkTheServerFromTheMenu,
  openTheConsoleAt,
  openTheProgramOutputAt,
} from './steps/pagesOfTheShow';
import {
  makeLowerThirdButton,
  readInstanceOnProgram,
  readServerClockHealth,
  sendCommandOrFail,
  takeCountdownToTheStart,
  takeRunningEnduroClock,
} from './steps/showOnTheChaosServer';
import { expectTheInstanceStayedOnAirUntouched } from './steps/whatTheAirShowed';

// How far real time turns out to be from the server's: far past the 1 s that makes a step,
// and far past a second's reading error, so a jump cannot be mistaken for a tick.
const realTimeAheadByMs = 30_000;
// A clock read at two moments the test cannot line up with its ticks may be a second off,
// either way, and the reading itself takes a moment.
const clockToleranceInSeconds = 1.5;
// The server's polls: one at boot, then every 16 s, each up to 4 questions 2 s apart. The
// confirmation comes 16 s after the first answer that saw the step: about 40 s at most.
const waitForTwoNtpPollsInMilliseconds = 60_000;

/** Finds the countdown's time left on the output ("09:41"). */
function findCountdownOnTheOutput(outputPage: Page) {
  return outputPage
    .locator('[data-layer-id="fullscreen"] > baja-graphic-countdown')
    .getByTestId('countdown-count');
}

/** Reads the countdown's time left on the output, in whole seconds. */
async function readCountdownSecondsOnTheOutput(outputPage: Page): Promise<number> {
  return readClockTextAsSeconds((await findCountdownOnTheOutput(outputPage).textContent()) ?? '');
}

/** Counts the NTP answers since `sinceMs` that found real time this far from the server's. */
async function waitForNtpAnswersThatSawTheOffset(
  port: number,
  answerCount: number,
  sinceMs: number,
): Promise<void> {
  const momentsOfTheAnswers = new Set<number>();
  await expect
    .poll(
      async () => {
        const { lastNtpAnswer } = await readServerClockHealth(port);
        const didItSeeTheOffset =
          lastNtpAnswer !== null &&
          lastNtpAnswer.atMs > sinceMs &&
          Math.abs(lastNtpAnswer.differenceMs) > realTimeAheadByMs - 1_000;
        if (didItSeeTheOffset) {
          momentsOfTheAnswers.add(lastNtpAnswer.atMs);
        }
        return momentsOfTheAnswers.size;
      },
      {
        message: `the server must ask NTP ${String(answerCount)} times and see real time 30 s ahead`,
        timeout: waitForTwoNtpPollsInMilliseconds,
      },
    )
    .toBeGreaterThanOrEqual(answerCount);
}

test.describe('the server clock when NTP misbehaves', () => {
  test('starts with NTP out of reach, says so, and the clock on air runs on', async ({
    context,
    startChaosServer,
  }) => {
    let fakeNtp: FakeNtpForTheServer | undefined;
    try {
      // Arrange: an NTP server that answers nothing; the server pointed at it.
      fakeNtp = await openFakeNtpForTheServer();
      fakeNtp.stopAnswering();
      const server = await startChaosServer('ntpOutOfReach', chaosServerPort, {
        BAJAOVRLAY_NTP_SERVERS: fakeNtp.ntpServersSetting,
      });
      const output = await openTheProgramOutputAt(context, server.address);
      const consolePage = await openTheConsoleAt(context, server.address);

      // Act: a running race clock is taken.
      await takeRunningEnduroClock(server.port);

      // Assert: "Verificar servidor" says the clock follows nothing; the clock counts on
      // with real time.
      await expect(
        await checkTheServerFromTheMenu(consolePage),
        '"Verificar servidor" must say no source answers',
      ).toContainText('Relógio: sem sincronização — hora do computador.');
      await waitUntilTheRaceClockShowsATime(output.page);
      const clockSecondsFirst = await readRaceClockSecondsOnTheOutput(output.page);
      const firstReadingAtMs = Date.now();
      await expect
        .poll(() => readRaceClockSecondsOnTheOutput(output.page), {
          message: 'the race clock must count on without NTP',
        })
        .toBeGreaterThanOrEqual(clockSecondsFirst + 3);
      const secondsThatPassed = (Date.now() - firstReadingAtMs) / 1000;
      const clockSecondsSecond = await readRaceClockSecondsOnTheOutput(output.page);
      expect(
        Math.abs(clockSecondsSecond - clockSecondsFirst - secondsThatPassed),
        'the race clock must count real seconds without NTP',
      ).toBeLessThanOrEqual(clockToleranceInSeconds);
    } finally {
      fakeNtp?.close();
    }
  });

  test('holds a confirmed step while a clock is on air, and the header warns', async ({
    context,
    startChaosServer,
  }) => {
    let fakeNtp: FakeNtpForTheServer | undefined;
    try {
      // Arrange: NTP answering this machine's time; the server on it; a race clock on air.
      fakeNtp = await openFakeNtpForTheServer();
      const server = await startChaosServer('stepHeld', chaosServerPort, {
        BAJAOVRLAY_NTP_SERVERS: fakeNtp.ntpServersSetting,
      });
      const output = await openTheProgramOutputAt(context, server.address);
      const consolePage = await openTheConsoleAt(context, server.address);
      await takeRunningEnduroClock(server.port);
      await waitUntilTheRaceClockShowsATime(output.page);
      const clockOnAir = await readInstanceOnProgram(server.port, 'clock');
      const clockSecondsBefore = await readRaceClockSecondsOnTheOutput(output.page);
      const readingBeforeAtMs = Date.now();

      // Act: real time turns out 30 s ahead; the server sees it, and confirms it, while the
      // clock on air is read every second.
      const clockReadings = startReadingTheRaceClockEverySecond(output.page);
      fakeNtp.answerTimeMovedBy(realTimeAheadByMs);
      await waitForNtpAnswersThatSawTheOffset(server.port, 2, readingBeforeAtMs);
      await expect(
        consolePage.getByText(/^Relógio do servidor \d+ s fora da hora certa$/),
        'the header must warn that the server clock is off real time',
      ).toHaveText('Relógio do servidor 30 s fora da hora certa');
      const readingsThroughTheStep = await clockReadings.stop();

      // Assert: the header warned (above); at every reading, a second apart, the clock on
      // air showed its start plus the real time that had passed: it never jumped.
      expect(
        readingsThroughTheStep.length,
        'the clock must have been read through the whole step',
      ).toBeGreaterThan(20);
      const readingsThatJumped = readingsThroughTheStep.filter((reading) => {
        const secondsThatPassed = (reading.readAtMs - readingBeforeAtMs) / 1000;
        const howFarOff = reading.seconds - clockSecondsBefore - secondsThatPassed;
        return Math.abs(howFarOff) > clockToleranceInSeconds;
      });
      expect(
        readingsThatJumped,
        `the clock on air must not jump while the step is held (it showed ${String(clockSecondsBefore)} s at the start)`,
      ).toEqual([]);
      await expectTheInstanceStayedOnAirUntouched(
        output,
        'clock',
        clockOnAir?.id ?? 'no clock on air',
        'real time was found 30 s ahead',
      );
    } finally {
      fakeNtp?.close();
    }
  });

  test('"Acertar relógio agora" says what jumps, and only the clock and the countdown jump', async ({
    context,
    startChaosServer,
  }) => {
    let fakeNtp: FakeNtpForTheServer | undefined;
    try {
      // Arrange: NTP on this machine's time; a race clock, a countdown to a start ten
      // minutes away and a lower third on air; then real time turns out 30 s ahead, and
      // the header says so.
      fakeNtp = await openFakeNtpForTheServer();
      const server = await startChaosServer('setClockNow', chaosServerPort, {
        BAJAOVRLAY_NTP_SERVERS: fakeNtp.ntpServersSetting,
      });
      const lowerThirdItemId = await makeLowerThirdButton(
        server.port,
        'Tarja — capitã da UFPR',
        'Ana Souza',
      );
      const output = await openTheProgramOutputAt(context, server.address);
      const consolePage = await openTheConsoleAt(context, server.address);
      await takeRunningEnduroClock(server.port);
      await takeCountdownToTheStart(server.port, Date.now() + 10 * 60_000);
      await waitUntilTheRaceClockShowsATime(output.page);
      await sendCommandOrFail(server.port, { type: 'takeItem', itemId: lowerThirdItemId });
      const takenAtMs = Date.now();
      fakeNtp.answerTimeMovedBy(realTimeAheadByMs);
      await waitForNtpAnswersThatSawTheOffset(server.port, 1, takenAtMs);
      await expect(
        consolePage.getByText(/^Relógio do servidor \d+ s fora da hora certa$/),
        'the header must warn before the operator acts',
      ).toBeVisible({ timeout: 15_000 });
      const instancesOnAir = [
        await readInstanceOnProgram(server.port, 'clock'),
        await readInstanceOnProgram(server.port, 'fullscreen'),
        await readInstanceOnProgram(server.port, 'lower-third'),
      ];

      // Act: Menu → "Acertar relógio agora"; the confirm is read; "Acertar agora".
      await consolePage.getByRole('button', { name: 'Menu' }).click();
      await consolePage.getByRole('menuitem', { name: 'Acertar relógio agora' }).click();
      const confirm = consolePage.getByRole('dialog', {
        name: 'Acertar o relógio do servidor agora?',
      });
      await expect(confirm, 'the confirm must say what jumps on air').toContainText(
        'O relógio de prova e as contagens regressivas no Programa e na Prévia pulam de uma vez para a hora certa.',
      );
      await expect(confirm, 'the confirm must say how far').toContainText(
        'O relógio do servidor está 30 s atrasado.',
      );
      const clockSecondsBefore = await readRaceClockSecondsOnTheOutput(output.page);
      const countdownSecondsBefore = await readCountdownSecondsOnTheOutput(output.page);
      const readingBeforeAtMs = Date.now();
      await confirm.getByRole('button', { name: 'Acertar agora' }).click();

      // Assert: set 30 s forward; the race clock 30 s more, the countdown 30 s less, each
      // besides the time that passed; nothing blanked or replayed, the lower third included.
      // The server says the step it measured: 30 s give or take the moment of the question.
      await expect(
        confirm,
        'the dialog must say the clock was set about 30 s forward',
      ).toContainText(/Relógio acertado: (29|30)(,\d+)? s para a frente\./);
      await expect
        .poll(
          async () => {
            const secondsThatPassed = (Date.now() - readingBeforeAtMs) / 1000;
            const clockSeconds = await readRaceClockSecondsOnTheOutput(output.page);
            return Math.round(clockSeconds - clockSecondsBefore - secondsThatPassed);
          },
          { message: 'the race clock on air must jump 30 s forward' },
        )
        .toBe(30);
      const secondsThatPassed = (Date.now() - readingBeforeAtMs) / 1000;
      const countdownSecondsAfter = await readCountdownSecondsOnTheOutput(output.page);
      expect(
        Math.abs(countdownSecondsBefore - countdownSecondsAfter - secondsThatPassed - 30),
        `the countdown must have 30 s less to go (it went from ${String(countdownSecondsBefore)} to ${String(countdownSecondsAfter)} s)`,
      ).toBeLessThanOrEqual(clockToleranceInSeconds);
      for (const instance of instancesOnAir) {
        await expectTheInstanceStayedOnAirUntouched(
          output,
          instance?.layerId ?? 'missing layer',
          instance?.id ?? 'missing instance',
          'the operator set the server clock',
        );
      }
    } finally {
      fakeNtp?.close();
    }
  });
});
