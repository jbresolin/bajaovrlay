// Test support: what the server says its clock follows, in the three cases the operator
// may meet (BAJAOVRLAY-76), with the sentence the page must show for each. Built fresh on
// every call, so no test changes another's.
import type { ServerClockSource } from '@bajaovrlay/shared';

import { formatTimeOfDay } from '@/i18n/timeOfDayText';

/** 10 October 2026, 13:00:04 UTC: when the last answer of these tests arrived. */
export const momentOfTheLastAnswerMs = Date.parse('2026-10-10T13:00:04.000Z');

/** One case: what the server sends, and the sentence expected on the page. */
export type ServerClockSourceCase = {
  name: string;
  source: ServerClockSource;
  expectedSentence: string;
};

/** The three sources, each with its sentence (the time of day in this computer's zone). */
export function buildTheThreeServerClockSources(): ServerClockSourceCase[] {
  const timeOfTheAnswer = formatTimeOfDay(momentOfTheLastAnswerMs);
  return [
    {
      // NTP answers: the usual case.
      name: 'NTP',
      source: {
        following: 'ntp',
        lastAnswer: {
          source: 'ntp',
          serverName: 'a.st1.ntp.br',
          atMs: momentOfTheLastAnswerMs,
          differenceMs: 12,
        },
      },
      expectedSentence: `Relógio: NTP (a.st1.ntp.br), última resposta às ${timeOfTheAnswer}, diferença de +12 ms.`,
    },
    {
      // The venue blocks NTP: Cloudflare's Date header feeds the clock.
      name: 'HTTPS',
      source: {
        following: 'https',
        lastAnswer: {
          source: 'https',
          serverName: 'www.cloudflare.com',
          atMs: momentOfTheLastAnswerMs,
          differenceMs: -41,
        },
      },
      expectedSentence: `Relógio: HTTPS (www.cloudflare.com), última resposta às ${timeOfTheAnswer}, diferença de -41 ms.`,
    },
    {
      // The uplink is down: nothing answers, NTP's last answer is still told.
      name: 'nothing',
      source: {
        following: 'none',
        lastAnswer: {
          source: 'ntp',
          serverName: 'a.st1.ntp.br',
          atMs: momentOfTheLastAnswerMs,
          differenceMs: 12,
        },
      },
      expectedSentence: `Relógio: sem sincronização — hora do computador; última resposta às ${timeOfTheAnswer}, de NTP (a.st1.ntp.br), diferença de +12 ms.`,
    },
  ];
}
