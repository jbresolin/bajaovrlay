/**
 * Whether anything on air counts time (apps/server)
 *
 * What this module is for:
 *   When NTP finds the server clock a second or more off real time, the server clock
 *   steps to real time at once, unless something on program or preview counts time, which
 *   the step would make jump on screen (BAJAOVRLAY-62). Two kinds of graphic count time:
 *   a running clock (the four clock roles, its clockRunning field true), and a graphic
 *   counting down to a moment (a field marked with the unit epochMs, still ahead): the
 *   countdown, and the intermission board's next session. Both are found by what their
 *   manifest marks, never by a graphic's name.
 *
 * What these tests prove (the real manifests of the race clock, the countdown and the
 *   intermission board; instances built by hand):
 *   - A running race clock counts, on program and on preview; a held one does not.
 *   - A countdown to 14:00 counts at 13:00, and no longer at 14:00:01, when it shows 0:00.
 *   - The intermission board's next session counts the same way.
 *   - A graphic that marks neither (the lower third) does not count, nor does nothing.
 *
 * What these tests deliberately do not cover:
 *   - What the server clock does with the answer; serverClockDiscipline.test.ts.
 */
import { readFileSync } from 'node:fs';

import type { Graphic, Instance, InstanceTarget } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { isAnythingCountingTimeOnAnOutput } from './timeCountedOnAnOutput.js';

/** 10 October 2026, 13:00 UTC: the enduro is an hour in. */
const oneOClockOfTheEnduroMs = Date.parse('2026-10-10T13:00:00.000Z');

/** 14:00 UTC: the start of the next session, "Suspensão e Tração". */
const twoOClockStartMs = Date.parse('2026-10-10T14:00:00.000Z');

/** A graphic as the server registers it, with its real manifest from packages/graphics. */
function buildGraphicFromItsRealManifest(graphicId: string, manifestFileName: string): Graphic {
  const manifestAddress = new URL(
    `../../../../../packages/graphics/${graphicId}/${manifestFileName}`,
    import.meta.url,
  );
  return {
    id: graphicId,
    manifest: JSON.parse(readFileSync(manifestAddress, 'utf8')) as Graphic['manifest'],
    defaultLayerId: 'main',
    category: 'other',
    thumbnailUrl: null,
    defaultFields: {},
  };
}

/** The four graphics of these tests, as the server registers them. */
function buildTheGraphicsOfTheTests(): Graphic[] {
  return [
    buildGraphicFromItsRealManifest('race-clock', 'race-clock.ograf.json'),
    buildGraphicFromItsRealManifest('countdown', 'countdown.ograf.json'),
    buildGraphicFromItsRealManifest('intermission-board', 'intermission-board.ograf.json'),
    buildGraphicFromItsRealManifest('lower-third', 'lower-third.ograf.json'),
  ];
}

/** One instance on an output, with the data the graphic shows. */
function buildInstanceOn(
  target: InstanceTarget,
  graphicId: string,
  resolvedData: Record<string, unknown>,
): Instance {
  return {
    id: `instancia-${graphicId}-${target}`,
    layerId: 'main',
    graphicId,
    target,
    resolvedData,
    currentStep: 0,
    status: 'on-air',
    takenAt: '2026-10-10T12:00:00.000Z',
  };
}

/** The enduro's race clock, running or held. */
function buildEnduroClockData(isRunning: boolean): Record<string, unknown> {
  return {
    sessionName: 'Enduro de Resistência',
    state: 'green',
    clockMode: 'elapsed',
    referenceTimeMs: 3_600_000,
    referenceWallClockMs: oneOClockOfTheEnduroMs,
    running: isRunning,
  };
}

const onAirScenarios = [
  // The enduro clock running on program: a step would make it jump on air.
  {
    name: 'a running race clock on program counts',
    instances: [buildInstanceOn('program', 'race-clock', buildEnduroClockData(true))],
    nowMs: oneOClockOfTheEnduroMs,
    isCounting: true,
  },
  // The preview monitor shows the operator the same jump.
  {
    name: 'a running race clock on preview counts',
    instances: [buildInstanceOn('preview', 'race-clock', buildEnduroClockData(true))],
    nowMs: oneOClockOfTheEnduroMs,
    isCounting: true,
  },
  // A held clock shows the same time whatever the server clock reads.
  {
    name: 'a held race clock does not count',
    instances: [buildInstanceOn('program', 'race-clock', buildEnduroClockData(false))],
    nowMs: oneOClockOfTheEnduroMs,
    isCounting: false,
  },
  // An hour to go: the count on screen reads the server clock every frame.
  {
    name: 'a countdown to 14:00 counts at 13:00',
    instances: [
      buildInstanceOn('program', 'countdown', {
        layout: 'strip',
        sessionName: 'Suspensão e Tração',
        startsAtMs: twoOClockStartMs,
      }),
    ],
    nowMs: oneOClockOfTheEnduroMs,
    isCounting: true,
  },
  // Past the moment the countdown shows 0:00 and stops: a step moves nothing on it.
  {
    name: 'a countdown to 14:00 no longer counts at 14:00:01',
    instances: [
      buildInstanceOn('program', 'countdown', {
        layout: 'strip',
        sessionName: 'Suspensão e Tração',
        startsAtMs: twoOClockStartMs,
      }),
    ],
    nowMs: twoOClockStartMs + 1_000,
    isCounting: false,
  },
  // The intermission board counts to its next session the same way.
  {
    name: "the intermission board's next session counts",
    instances: [
      buildInstanceOn('program', 'intermission-board', {
        nextSessionName: 'Suspensão e Tração',
        nextStartsAtMs: twoOClockStartMs,
      }),
    ],
    nowMs: oneOClockOfTheEnduroMs,
    isCounting: true,
  },
  // A lower third has neither a clock nor a moment: nothing on it moves with time.
  {
    name: 'a lower third does not count',
    instances: [buildInstanceOn('program', 'lower-third', { name: 'Baja UFPR' })],
    nowMs: oneOClockOfTheEnduroMs,
    isCounting: false,
  },
  // Nothing on air at all, between sessions.
  {
    name: 'nothing on air does not count',
    instances: [],
    nowMs: oneOClockOfTheEnduroMs,
    isCounting: false,
  },
];

describe('whether anything on air counts time', () => {
  it.each(onAirScenarios)('$name', ({ instances, nowMs, isCounting }) => {
    // Arrange: the graphics, and the instances of this row on the outputs.
    const slices = { graphics: buildTheGraphicsOfTheTests(), instances };

    // Act: ask whether anything counts time at the row's moment.
    const answer = isAnythingCountingTimeOnAnOutput(slices, nowMs);

    // Assert: as the row says.
    expect(answer, 'only a running clock or a count to a moment still ahead counts').toBe(
      isCounting,
    );
  });
});
