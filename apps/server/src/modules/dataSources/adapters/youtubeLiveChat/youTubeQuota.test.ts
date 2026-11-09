/**
 * The YouTube key's daily quota (apps/server)
 *
 * What this module is for:
 *   Google gives a YouTube key 10 000 units a day, reset at midnight Pacific time. Each
 *   look-up of the live's chat costs 1 unit and each read of the chat 5. The server counts
 *   what it spent today in a small file in DATA_DIR, so a restart goes on from the same
 *   count, and stops reading at its budget (BAJAOVRLAY_YOUTUBE_DAILY_UNITS, 9 000 unless
 *   set) with a reason the operator can act on (BAJAOVRLAY-35).
 *
 * What these tests prove:
 *   - The reset in Brasília is 5h in the northern winter and 4h in the northern summer,
 *     and the quota day changes at Pacific midnight, not at Brasília's, also on the two
 *     days the US clocks change (gate 2 of PR #54).
 *   - Units are counted per request, shown by the adapter, and kept across a restart (a
 *     new adapter on the same file). The file is written whole or not at all: no
 *     temporary file is left behind, and one a crash left is ignored at the next boot.
 *   - At the budget no request is sent and the poll fails with "Cota diária do YouTube
 *     esgotada; volta às 5h"; after Pacific midnight (the clock moved by hand) it reads again.
 *   - A budget variable that is not a number fails the poll naming it.
 *
 * What these tests deliberately do not cover:
 *   - Reading the chat itself: youTubeLiveChatAdapter.test.ts.
 *   - The count on the source's status through the store: youTubeKeyNeverAppears.test.ts
 *     runs the real poller and reads it there.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, onTestFinished } from 'vitest';

import {
  buildChatPage,
  createPollContextAt,
  createYouTubeAdapterForTests,
  enduroLiveAddress,
  startFakeYouTube,
} from './fakeYouTube.testSupport.js';
import { parseYouTubeDailyUnitsBudget } from './youTubeDailyUnitsBudget.js';
import {
  findNextPacificMidnightMs,
  readBrasiliaHourOfTheNextQuotaDay,
  readPacificQuotaDay,
} from './youTubeQuotaDay.js';

/** 12:02:30 in Brasília on Saturday 10 October 2026 (still US summer time). */
const octoberEnduroMs = Date.parse('2026-10-10T15:02:30.000Z');

/** 12:02:30 in Brasília on Saturday 14 November 2026 (US winter time). */
const novemberEnduroMs = Date.parse('2026-11-14T15:02:30.000Z');

/** The enduro live's config. */
const enduroLiveConfig = { liveAddress: enduroLiveAddress };

/** A new ledger file's path in a temporary folder, removed after the test. */
function createTemporaryLedgerPath(): string {
  const folder = mkdtempSync(join(tmpdir(), 'bajaovrlay-cota-youtube-'));
  onTestFinished(() => rmSync(folder, { recursive: true, force: true }));
  return join(folder, 'youtube-quota.json');
}

/** Runs a poll that must fail, and gives back its pt-BR error message. */
async function captureThePollError(polling: Promise<unknown>): Promise<string> {
  try {
    await polling;
  } catch (pollError) {
    return pollError instanceof Error ? pollError.message : String(pollError);
  }
  throw new Error('the poll was expected to fail');
}

/** YouTube answering empty pages with no wait, so every poll reads the chat. */
async function startFakeYouTubeWithNoWait() {
  const fakeYouTube = await startFakeYouTube();
  fakeYouTube.answerChatPages({
    status: 200,
    body: buildChatPage({ messages: [], pollingIntervalMillis: 0 }),
  });
  return fakeYouTube;
}

describe('the quota day', () => {
  const resetScenarios = [
    // November: Pacific midnight is 08:00 UTC, 5h in Brasília.
    { name: 'resets at 5h in Brasília in November', momentMs: novemberEnduroMs, hour: 5 },
    // October, before the US clocks go back: Pacific midnight is 07:00 UTC, 4h in Brasília.
    { name: 'resets at 4h in Brasília in October', momentMs: octoberEnduroMs, hour: 4 },
  ];

  it.each(resetScenarios)('$name', ({ momentMs, hour }) => {
    // Arrange: the moment in the row, during a race day.

    // Act: read the hour of the next reset on Brasília's clock.
    const brasiliaHour = readBrasiliaHourOfTheNextQuotaDay(momentMs);

    // Assert: the hour the operator must read in the reason.
    expect(brasiliaHour, 'the reset hour in Brasília').toBe(hour);
  });

  it('changes the quota day at Pacific midnight, not at Brasília midnight', () => {
    // Arrange: 01:30 in Brasília on Sunday 15 November, still Saturday in California.
    const afterBrasiliaMidnightMs = Date.parse('2026-11-15T04:30:00.000Z');

    // Act: read the quota day then, and when the next one starts.
    const quotaDay = readPacificQuotaDay(afterBrasiliaMidnightMs);
    const nextMidnightMs = findNextPacificMidnightMs(afterBrasiliaMidnightMs);

    // Assert: still Saturday's quota, which ends at 08:00 UTC on Sunday.
    expect(quotaDay, 'the quota day must be the Pacific calendar day').toBe('2026-11-14');
    expect(new Date(nextMidnightMs).toISOString(), 'the next quota day starts at 08:00 UTC').toBe(
      '2026-11-15T08:00:00.000Z',
    );
  });
});

describe('the quota day when the US clocks change', () => {
  const clockChangeScenarios = [
    // Saturday 7 March 2026, the eve of US summer time: midnight is still winter time,
    // 08:00 UTC, 5h in Brasília.
    {
      name: 'the eve of US summer time ends at 08:00 UTC',
      momentMs: Date.parse('2026-03-07T15:00:00.000Z'),
      quotaDay: '2026-03-07',
      nextMidnight: '2026-03-08T08:00:00.000Z',
    },
    // Sunday 8 March 2026, US summer time from 2h: a 23-hour quota day, ending at 07:00 UTC.
    {
      name: 'the day US summer time starts ends at 07:00 UTC',
      momentMs: Date.parse('2026-03-08T15:00:00.000Z'),
      quotaDay: '2026-03-08',
      nextMidnight: '2026-03-09T07:00:00.000Z',
    },
    // Saturday 31 October 2026, the eve of US winter time: midnight is still summer time.
    {
      name: 'the eve of US winter time ends at 07:00 UTC',
      momentMs: Date.parse('2026-10-31T15:00:00.000Z'),
      quotaDay: '2026-10-31',
      nextMidnight: '2026-11-01T07:00:00.000Z',
    },
    // Sunday 1 November 2026, US winter time from 2h: a 25-hour quota day, ending at 08:00 UTC.
    {
      name: 'the day US winter time starts ends at 08:00 UTC',
      momentMs: Date.parse('2026-11-01T15:00:00.000Z'),
      quotaDay: '2026-11-01',
      nextMidnight: '2026-11-02T08:00:00.000Z',
    },
  ];

  it.each(clockChangeScenarios)('$name', ({ momentMs, quotaDay, nextMidnight }) => {
    // Arrange: a moment of a race on the day in the row.

    // Act: read its quota day and when the next one starts.
    const quotaDayRead = readPacificQuotaDay(momentMs);
    const nextMidnightRead = new Date(findNextPacificMidnightMs(momentMs)).toISOString();

    // Assert: the Pacific calendar day, and the next Pacific midnight in UTC.
    expect(quotaDayRead, 'the quota day').toBe(quotaDay);
    expect(nextMidnightRead, 'the next quota day starts at Pacific midnight').toBe(nextMidnight);
  });

  it('keeps counting through the US clock change, and resets once at Pacific midnight', async () => {
    // Arrange: the adapter polling at 23:30 Pacific on Saturday 31 October 2026 (06:30 UTC).
    const fakeYouTube = await startFakeYouTubeWithNoWait();
    const adapter = createYouTubeAdapterForTests({ fakeYouTube });
    const clock = { nowMs: Date.parse('2026-11-01T06:30:00.000Z') };
    await adapter.pollOnce(enduroLiveConfig, createPollContextAt(clock));

    // Act: poll at 00:30 Pacific (07:30 UTC, the new day), then at 01:30 PST after the
    // clocks went back (09:30 UTC, the same day).
    clock.nowMs = Date.parse('2026-11-01T07:30:00.000Z');
    await adapter.pollOnce(enduroLiveConfig, createPollContextAt(clock));
    const unitsAfterMidnight = adapter.readQuotaUsage(clock.nowMs).unitsSpentToday;
    clock.nowMs = Date.parse('2026-11-01T09:30:00.000Z');
    await adapter.pollOnce(enduroLiveConfig, createPollContextAt(clock));

    // Assert: the count started again at midnight only, not when the clocks went back.
    expect(unitsAfterMidnight, 'a new quota day starts at Pacific midnight').toBe(5);
    expect(
      adapter.readQuotaUsage(clock.nowMs).unitsSpentToday,
      'the clock change itself starts no new day',
    ).toBe(10);
  });
});

describe('counting the units', () => {
  it('counts 1 unit for the look-up and 5 for each read', async () => {
    // Arrange: the adapter with the default budget.
    const fakeYouTube = await startFakeYouTubeWithNoWait();
    const adapter = createYouTubeAdapterForTests({ fakeYouTube });
    const clock = { nowMs: novemberEnduroMs };

    // Act: two polls, 30 s apart.
    await adapter.pollOnce(enduroLiveConfig, createPollContextAt(clock));
    clock.nowMs += 30_000;
    await adapter.pollOnce(enduroLiveConfig, createPollContextAt(clock));

    // Assert: 1 + 5 + 5 units of 9 000.
    expect(adapter.readQuotaUsage(clock.nowMs), 'the units spent today and the budget').toEqual({
      unitsSpentToday: 11,
      dailyUnitsBudget: 9_000,
    });
  });

  it('goes on from the same count after a restart', async () => {
    // Arrange: one adapter that polls once on a ledger file, then is gone (the restart).
    const fakeYouTube = await startFakeYouTubeWithNoWait();
    const ledgerFilePath = createTemporaryLedgerPath();
    const adapterBeforeTheRestart = createYouTubeAdapterForTests({ fakeYouTube, ledgerFilePath });
    const clock = { nowMs: novemberEnduroMs };
    await adapterBeforeTheRestart.pollOnce(enduroLiveConfig, createPollContextAt(clock));

    // Act: a new adapter on the same file polls a minute later.
    const adapterAfterTheRestart = createYouTubeAdapterForTests({ fakeYouTube, ledgerFilePath });
    clock.nowMs += 60_000;
    await adapterAfterTheRestart.pollOnce(enduroLiveConfig, createPollContextAt(clock));

    // Assert: 6 before the restart, 6 more after it (the look-up again, and a read).
    expect(
      adapterAfterTheRestart.readQuotaUsage(clock.nowMs).unitsSpentToday,
      'a restart must not reset the count',
    ).toBe(12);
  });
});

describe('the ledger file', () => {
  it('is written whole, leaving no temporary file behind', async () => {
    // Arrange: an adapter on a new ledger file.
    const fakeYouTube = await startFakeYouTubeWithNoWait();
    const ledgerFilePath = createTemporaryLedgerPath();
    const adapter = createYouTubeAdapterForTests({ fakeYouTube, ledgerFilePath });

    // Act: one poll (the look-up and a read).
    await adapter.pollOnce(enduroLiveConfig, createPollContextAt({ nowMs: novemberEnduroMs }));

    // Assert: the file holds the day's count, and the temporary file was renamed away.
    expect(
      JSON.parse(readFileSync(ledgerFilePath, 'utf8')),
      'the file must hold the quota day and its count',
    ).toEqual({ quotaDay: '2026-11-14', unitsSpent: 6 });
    expect(
      existsSync(`${ledgerFilePath}.tmp`),
      'the temporary file is renamed over the real one',
    ).toBe(false);
  });

  it('ignores a temporary file a crash left, and goes on from the real count', async () => {
    // Arrange: a ledger with 6 units, and an empty temporary file beside it, as a crash
    // halfway through a write would leave.
    const fakeYouTube = await startFakeYouTubeWithNoWait();
    const ledgerFilePath = createTemporaryLedgerPath();
    writeFileSync(ledgerFilePath, JSON.stringify({ quotaDay: '2026-11-14', unitsSpent: 6 }));
    writeFileSync(`${ledgerFilePath}.tmp`, '');

    // Act: the server boots on it and reads the count.
    const adapter = createYouTubeAdapterForTests({ fakeYouTube, ledgerFilePath });

    // Assert: the count of the real file, never zero.
    expect(
      adapter.readQuotaUsage(novemberEnduroMs).unitsSpentToday,
      'a crash mid-write must not reset the count',
    ).toBe(6);
  });
});

describe('the budget', () => {
  it('stops at the budget with the reason, and reads again after Pacific midnight', async () => {
    // Arrange: a budget of 11 units: the look-up and two reads.
    const fakeYouTube = await startFakeYouTubeWithNoWait();
    const adapter = createYouTubeAdapterForTests({ fakeYouTube, dailyUnitsBudget: '11' });
    const clock = { nowMs: novemberEnduroMs };
    await adapter.pollOnce(enduroLiveConfig, createPollContextAt(clock));
    clock.nowMs += 30_000;
    await adapter.pollOnce(enduroLiveConfig, createPollContextAt(clock));
    const requestsAtTheBudget = fakeYouTube.readRequestsReceived().length;

    // Act: a third poll 30 s later, then one just after Pacific midnight.
    clock.nowMs += 30_000;
    const error = await captureThePollError(
      adapter.pollOnce(enduroLiveConfig, createPollContextAt(clock)),
    );
    const requestsAfterTheRefusal = fakeYouTube.readRequestsReceived().length;
    clock.nowMs = findNextPacificMidnightMs(clock.nowMs) + 1_000;
    await adapter.pollOnce(enduroLiveConfig, createPollContextAt(clock));

    // Assert: refused with the reason and nothing sent; the new day reads and counts from 0.
    expect(error, 'the operator must read when the quota comes back').toBe(
      'Cota diária do YouTube esgotada; volta às 5h',
    );
    expect(requestsAfterTheRefusal, 'no request may go past the budget').toBe(requestsAtTheBudget);
    expect(
      fakeYouTube.readRequestsReceived().length,
      'after Pacific midnight the chat must be read again',
    ).toBe(requestsAtTheBudget + 1);
    expect(
      adapter.readQuotaUsage(clock.nowMs).unitsSpentToday,
      'the new day must count only its own read',
    ).toBe(5);
  });

  it('fails naming the variable when the budget is not a number', async () => {
    // Arrange: a budget written as a word.
    const fakeYouTube = await startFakeYouTubeWithNoWait();
    const adapter = createYouTubeAdapterForTests({ fakeYouTube, dailyUnitsBudget: 'nove mil' });

    // Act: poll once.
    const error = await captureThePollError(
      adapter.pollOnce(enduroLiveConfig, createPollContextAt({ nowMs: novemberEnduroMs })),
    );

    // Assert: the variable is named, and nothing was sent.
    expect(error, 'a budget that is not a number must be named').toBe(
      'BAJAOVRLAY_YOUTUBE_DAILY_UNITS deve ser um número inteiro de 1 a 10000 (vazio: 9000).',
    );
    expect(fakeYouTube.readRequestsReceived(), 'no request may go without a budget').toEqual([]);
  });

  const budgetTextScenarios = [
    // Unset: the default keeps a tenth of the quota back.
    {
      name: 'reads unset as 9 000',
      text: undefined,
      expected: { isValid: true, dailyUnitsBudget: 9_000 },
    },
    // A smaller budget, for a day shared with another tool on the same key.
    { name: 'reads 5000', text: '5000', expected: { isValid: true, dailyUnitsBudget: 5_000 } },
    // More than Google gives could never be spent: a typo.
    { name: 'refuses 90000', text: '90000', expected: { isValid: false } },
    // Zero would never read the chat at all.
    { name: 'refuses 0', text: '0', expected: { isValid: false } },
  ];

  it.each(budgetTextScenarios)('$name', ({ text, expected }) => {
    // Arrange: the variable's text in the row.

    // Act: parse it.
    const parsing = parseYouTubeDailyUnitsBudget(text);

    // Assert: the budget, or not valid.
    expect(parsing, `the budget read from ${String(text)}`).toEqual(expected);
  });
});
