/**
 * HTTPS takes over only after two lost NTP polls in a row (apps/server)
 *
 * What this module is for:
 *   When NTP stops answering, the server clock's discipline turns to the Date headers of
 *   HTTPS servers (BAJAOVRLAY-76). NTP runs on UDP, and one lost packet loses a whole
 *   poll now and then on a lossy uplink. If one lost poll were enough, the clock would
 *   flap between the two sources, and every change of source empties the rate's window,
 *   so the rate would never settle. HTTPS therefore takes over only after two NTP polls
 *   in a row got no answer (and NTP has been quiet for a full poll interval, 64 s).
 *
 * What these tests prove (on fake time, against a fake NTP and a fake HTTPS poll;
 *   serverClockDiscipline.test.ts's world):
 *   - One lost NTP poll, the next answered: HTTPS is never asked, the clock follows NTP
 *     throughout, and the header never says "sem sincronização".
 *   - Two lost NTP polls in a row: HTTPS is asked right after the second, and followed.
 *
 * What these tests deliberately do not cover:
 *   - NTP quiet from the boot (the boot's failure counts as the first lost poll);
 *     serverClockHttpFallback.test.ts.
 *   - What HTTPS's answers do to the clock; serverClockHttpFallback.test.ts.
 */
import { describe, expect, it, vi } from 'vitest';

import { startAServerClockInAFakeWorld } from './fakeWorldOfTime.testSupport.js';

const oneMinuteMs = 60_000;

type WorldOfTheTest = ReturnType<typeof startAServerClockInAFakeWorld>;

/** An accurate machine booted on NTP, with the fallback on, ten minutes into the enduro. */
async function bootAMachineOnNtpForTenMinutes(): Promise<WorldOfTheTest> {
  const world = startAServerClockInAFakeWorld({
    monotonicRunsFastBy: 0,
    wallClockAheadOfRealTimeAtBootMs: 0,
    isHttpsFallbackOn: true,
  });
  await world.discipline.stepToRealTimeAtBoot();
  await vi.advanceTimersByTimeAsync(10 * oneMinuteMs);
  return world;
}

/**
 * Cuts NTP off until it has lost this many polls in a row, a second at a time, then lets
 * it answer again. Returns whether the clock was ever said to be without sync meanwhile.
 */
async function loseNtpPollsInARow(world: WorldOfTheTest, pollsToLose: number) {
  const pollsBefore = world.readPollsMade().length;
  let wasEverWithoutSync = false;
  world.setNtpReachable(false);
  while (world.readPollsMade().length < pollsBefore + pollsToLose) {
    await vi.advanceTimersByTimeAsync(1_000);
    wasEverWithoutSync = wasEverWithoutSync || world.discipline.readStatus().isWithoutSync;
  }
  world.setNtpReachable(true);
  return { wasEverWithoutSync };
}

describe('NTP polls lost on a lossy uplink', () => {
  it('stays on NTP after one lost poll, and never asks HTTPS', async () => {
    // Arrange: a machine that has followed NTP for ten minutes (polls 64 s apart).
    const world = await bootAMachineOnNtpForTenMinutes();

    // Act: one NTP poll is lost; then five minutes pass with NTP answering, looking at
    // the source followed every second.
    const { wasEverWithoutSync } = await loseNtpPollsInARow(world, 1);
    const sourcesFollowed = new Set<string>();
    for (let second = 0; second < 5 * 60; second += 1) {
      await vi.advanceTimersByTimeAsync(1_000);
      sourcesFollowed.add(world.discipline.readStatus().source.following);
    }

    // Assert: HTTPS never asked, NTP followed throughout, no "sem sincronização".
    expect(world.readHttpsPollsMadeAtMs(), 'one lost poll is not enough for HTTPS').toEqual([]);
    expect([...sourcesFollowed], 'the clock follows NTP throughout').toEqual(['ntp']);
    expect(wasEverWithoutSync, 'the header never says "sem sincronização"').toBe(false);
  });

  it('asks HTTPS right after the second lost poll in a row, and follows it', async () => {
    // Arrange: a machine that has followed NTP for ten minutes (polls 64 s apart).
    const world = await bootAMachineOnNtpForTenMinutes();

    // Act: two NTP polls in a row are lost (NTP comes back only afterwards).
    await loseNtpPollsInARow(world, 2);

    // Assert: HTTPS asked once, at the second lost poll, and followed for now.
    const secondLostPoll = world.readPollsMade().at(-1);
    expect(world.readHttpsPollsMadeAtMs(), 'HTTPS asked right after the second').toEqual([
      secondLostPoll?.monotonicSinceBootMs,
    ]);
    expect(world.discipline.readStatus().source.following, 'the clock follows HTTPS').toBe('https');
  });
});
