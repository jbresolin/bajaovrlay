/**
 * Which source the server clock follows (packages/shared)
 *
 * What this module is for:
 *   The server clock follows NTP, or the Date headers of HTTPS servers while NTP is quiet,
 *   or nothing (the computer's own clock) (BAJAOVRLAY-76). ServerClockSourceSchema is how
 *   the server says which, in /health ("Verificar servidor") and in the `time` message
 *   (the header's menu), with the last answer's time and difference.
 *
 * What these tests prove:
 *   - Each of the three is accepted as the server sends it.
 *   - Following NTP or HTTPS needs that last answer; following nothing, the last answer
 *     may be null (no answer ever came).
 *   - A source the page does not know ("gps") is refused, so a newer server is not
 *     misread as one of the three.
 *
 * What these tests deliberately do not cover:
 *   - When the server follows which; apps/server's serverClockHttpFallback.test.ts.
 */
import { describe, expect, it } from 'vitest';

import { ServerClockSourceSchema } from './serverClockSource.js';

/** 10 October 2026, 13:00:04 UTC: when the last answer of these tests arrived. */
const momentOfTheLastAnswerMs = Date.parse('2026-10-10T13:00:04.000Z');

describe('ServerClockSourceSchema', () => {
  // Each row is one thing the server may say; all three must pass as sent.
  const sourcesTheServerSends = [
    {
      // NTP answers: the usual case at home and at a track whose router lets UDP 123 out.
      name: 'following NTP',
      source: {
        following: 'ntp',
        lastAnswer: {
          source: 'ntp',
          serverName: 'a.st1.ntp.br',
          atMs: momentOfTheLastAnswerMs,
          differenceMs: 3,
        },
      },
    },
    {
      // NTP blocked by the venue: the Date headers of HTTPS servers feed the clock.
      name: 'following HTTPS',
      source: {
        following: 'https',
        lastAnswer: {
          source: 'https',
          serverName: 'www.cloudflare.com',
          atMs: momentOfTheLastAnswerMs,
          differenceMs: -41,
        },
      },
    },
    {
      // Nothing answers now, but NTP did earlier: that answer is still told.
      name: 'following nothing, after an NTP answer',
      source: {
        following: 'none',
        lastAnswer: {
          source: 'ntp',
          serverName: 'a.st1.ntp.br',
          atMs: momentOfTheLastAnswerMs,
          differenceMs: 12,
        },
      },
    },
    {
      // Nothing ever answered: the uplink was out from the boot on.
      name: 'following nothing, no answer ever',
      source: { following: 'none', lastAnswer: null },
    },
  ];

  it.each(sourcesTheServerSends)('accepts the server $name', ({ source }) => {
    // Arrange: the source as the server sends it (the row).

    // Act: check it against the schema.
    const result = ServerClockSourceSchema.safeParse(source);

    // Assert: accepted unchanged.
    expect(result.success, 'what the server sends must pass').toBe(true);
    expect(result.data, 'and come back as sent').toEqual(source);
  });

  it('refuses following NTP without its last answer', () => {
    // Arrange: a source that says NTP but carries no answer.
    const ntpWithoutAnAnswer = { following: 'ntp', lastAnswer: null };

    // Act: check it.
    const result = ServerClockSourceSchema.safeParse(ntpWithoutAnAnswer);

    // Assert: refused: following NTP means NTP has answered.
    expect(result.success, 'a followed source always has an answer').toBe(false);
  });

  it('refuses a source the page does not know', () => {
    // Arrange: a source from a newer server.
    const gpsSource = {
      following: 'gps',
      lastAnswer: null,
    };

    // Act: check it.
    const result = ServerClockSourceSchema.safeParse(gpsSource);

    // Assert: refused, not misread as one of the three.
    expect(result.success, 'only ntp, https and none are known').toBe(false);
  });
});
