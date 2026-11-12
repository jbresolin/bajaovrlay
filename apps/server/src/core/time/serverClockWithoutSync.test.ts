/**
 * When the server clock is "without sync" (apps/server)
 *
 * What this module is for:
 *   The header's clock warning needs an answer to know how far off the clock is; when no
 *   source answers at all, the operator saw it only in "Verificar servidor". Since the
 *   addition of 2026-11-12 to BAJAOVRLAY-76, the discipline says the clock is "without
 *   sync" once neither NTP nor HTTPS has answered for a full poll interval (64 s), and the
 *   header shows "Relógio sem sincronização"; the first good answer of either clears it.
 *
 * What these tests prove (on fake time, against a fake NTP and a fake HTTPS poll;
 *   serverClockDiscipline.test.ts's world):
 *   - Not during the first 64 s with nothing answering; said once they have passed and
 *     HTTPS has failed too.
 *   - Cleared by the first good answer of HTTPS, and of NTP.
 *   - Not said while the first HTTPS poll is still under way (no flash in the header).
 *   - With the fallback off, NTP quiet for 64 s is enough.
 *
 * What these tests deliberately do not cover:
 *   - The chip on the page; apps/control's ServerClockWithoutSyncChip.test.tsx.
 *   - Which source is followed meanwhile; serverClockHttpFallback.test.ts.
 */
import { describe, expect, it, vi } from 'vitest';

import { startAServerClockInAFakeWorld } from './fakeWorldOfTime.testSupport.js';

const oneMinuteMs = 60_000;

describe('"without sync", for the header', () => {
  it('is said once neither NTP nor HTTPS has answered for a full poll interval', async () => {
    // Arrange: an accurate machine whose uplink is down from the boot on, the fallback on.
    const world = startAServerClockInAFakeWorld({
      monotonicRunsFastBy: 0,
      wallClockAheadOfRealTimeAtBootMs: 0,
      isHttpsFallbackOn: true,
    });
    world.setNtpReachable(false);
    world.setHttpsReachable(false);
    await world.discipline.stepToRealTimeAtBoot();

    // Act: 60 s pass (under a full interval), then 10 s more (past it, HTTPS asked too).
    await vi.advanceTimersByTimeAsync(60_000);
    const withoutSyncAtSixtySeconds = world.discipline.readStatus().isWithoutSync;
    await vi.advanceTimersByTimeAsync(10_000);

    // Assert: not yet at 60 s; said at 70 s.
    expect(withoutSyncAtSixtySeconds, 'not before a full poll interval').toBe(false);
    expect(world.discipline.readStatus().isWithoutSync, 'neither answered for 64 s').toBe(true);
  });

  // Each row is a source that answers again; either one clears it.
  it.each([
    {
      name: 'HTTPS',
      bringBack: (world: ReturnType<typeof startAServerClockInAFakeWorld>) =>
        world.setHttpsReachable(true),
    },
    {
      name: 'NTP',
      bringBack: (world: ReturnType<typeof startAServerClockInAFakeWorld>) =>
        world.setNtpReachable(true),
    },
  ])('clears on the first good answer from $name', async ({ bringBack }) => {
    // Arrange: neither answering for two minutes, the fallback on.
    const world = startAServerClockInAFakeWorld({
      monotonicRunsFastBy: 0,
      wallClockAheadOfRealTimeAtBootMs: 0,
      isHttpsFallbackOn: true,
    });
    world.setNtpReachable(false);
    world.setHttpsReachable(false);
    await world.discipline.stepToRealTimeAtBoot();
    await vi.advanceTimersByTimeAsync(2 * oneMinuteMs);
    const withoutSyncBefore = world.discipline.readStatus().isWithoutSync;

    // Act: the row's source answers again; the next poll comes.
    bringBack(world);
    await vi.advanceTimersByTimeAsync(oneMinuteMs + 4_000);

    // Assert: said before, cleared after.
    expect(withoutSyncBefore, 'without sync while neither answered').toBe(true);
    expect(world.discipline.readStatus().isWithoutSync, 'cleared by one good answer').toBe(false);
  });

  it('is not said while the first HTTPS poll is still under way', async () => {
    // Arrange: NTP blocked from the boot, HTTPS polls that never end (a slow uplink).
    const world = startAServerClockInAFakeWorld({
      monotonicRunsFastBy: 0,
      wallClockAheadOfRealTimeAtBootMs: 0,
      isHttpsFallbackOn: true,
    });
    world.setNtpReachable(false);
    world.makeHttpsNeverAnswer();
    await world.discipline.stepToRealTimeAtBoot();

    // Act: two minutes pass: NTP quiet for 64 s, the HTTPS poll still under way.
    await vi.advanceTimersByTimeAsync(2 * oneMinuteMs);

    // Assert: not said: HTTPS has not failed yet.
    expect(world.discipline.readStatus().isWithoutSync, 'HTTPS has not said no yet').toBe(false);
  });

  it('with the fallback off, is said once NTP has been quiet for a full poll interval', async () => {
    // Arrange: NTP blocked from the boot, BAJAOVRLAY_HTTP_TIME_SERVERS=off.
    const world = startAServerClockInAFakeWorld({
      monotonicRunsFastBy: 0,
      wallClockAheadOfRealTimeAtBootMs: 0,
      isHttpsFallbackOn: false,
    });
    world.setNtpReachable(false);
    await world.discipline.stepToRealTimeAtBoot();

    // Act: 70 s pass.
    await vi.advanceTimersByTimeAsync(70_000);

    // Assert: said: no source is left to ask.
    expect(world.discipline.readStatus().isWithoutSync, 'NTP alone, quiet for 64 s').toBe(true);
  });
});
