/**
 * The reportInstanceStatus command (packages/shared)
 *
 * What this module is for:
 *   After a take, only the renderer knows whether the graphic really reached the
 *   screen. `reportInstanceStatus` is the command behind the renderer's report: it
 *   names the instance and says `on-air` (it is showing) or `failed` (it could not be
 *   loaded or played), with an optional detail a person can read in the layer panel.
 *
 * What these tests prove:
 *   - An `on-air` report without a detail and a `failed` report with one are both
 *     accepted unchanged, on their own schema and as commands of CommandSchema.
 *   - A report that leaves out the instance or the status is refused, and the failure
 *     names the missing field.
 *   - A status the renderer may not report (`loading`, or one that does not exist) is
 *     refused, naming `status`.
 *
 * What these tests deliberately do not cover:
 *   - Who may send it (only a renderer) and which instance statuses it may change;
 *     the authorisation step and the reducer in apps/server check those.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { CommandSchema } from './command.js';
import { ReportInstanceStatusCommandSchema } from './reportInstanceStatus.js';

const raceClockInstanceId = '7d3c1a52-4f0e-4b8e-9a51-2f6f1e0c9b11';

const acceptedReportScenarios = [
  // The usual report: the play animation finished and the clock is showing.
  {
    name: 'accepts a report that the race clock is on air, with no detail',
    command: { type: 'reportInstanceStatus', instanceId: raceClockInstanceId, status: 'on-air' },
  },
  // The failure report carries what went wrong, for the layer panel's tooltip.
  {
    name: 'accepts a report that the race clock failed, with the reason',
    command: {
      type: 'reportInstanceStatus',
      instanceId: raceClockInstanceId,
      status: 'failed',
      detail: 'Failed to fetch dynamically imported module: /graphics/race-clock/race-clock.js',
    },
  },
];

describe('ReportInstanceStatusCommandSchema', () => {
  it.each(acceptedReportScenarios)('$name', ({ command }) => {
    // Arrange: the report as the server builds it from the renderer's message.
    const reportFromRenderer = command;

    // Act: check the command.
    const result = ReportInstanceStatusCommandSchema.safeParse(reportFromRenderer);

    // Assert: it is accepted unchanged.
    expect(result.success, 'a complete report must be accepted').toBe(true);
    expect(result.data, 'the report has no defaults to fill in').toEqual(reportFromRenderer);
  });

  const refusedReportScenarios = [
    // Without the instance the server cannot know which graphic the report is about.
    {
      name: 'refuses a report that does not say which instance, naming instanceId',
      command: { type: 'reportInstanceStatus', status: 'on-air' },
      fieldNamedInTheFailure: 'instanceId',
    },
    // A report with no status says nothing.
    {
      name: 'refuses a report without a status, naming status',
      command: { type: 'reportInstanceStatus', instanceId: raceClockInstanceId },
      fieldNamedInTheFailure: 'status',
    },
    // `loading` is a real instance status, but it is the server's to set, not the renderer's.
    {
      name: 'refuses a report of loading, which only the server sets, naming status',
      command: { type: 'reportInstanceStatus', instanceId: raceClockInstanceId, status: 'loading' },
      fieldNamedInTheFailure: 'status',
    },
    // A status that does not exist anywhere (a typo, or a newer renderer).
    {
      name: 'refuses a status that does not exist, naming status',
      command: { type: 'reportInstanceStatus', instanceId: raceClockInstanceId, status: 'paused' },
      fieldNamedInTheFailure: 'status',
    },
    // An empty detail would show an empty tooltip; leaving it out is the way to say nothing.
    {
      name: 'refuses an empty detail, naming detail',
      command: {
        type: 'reportInstanceStatus',
        instanceId: raceClockInstanceId,
        status: 'failed',
        detail: '',
      },
      fieldNamedInTheFailure: 'detail',
    },
  ];

  it.each(refusedReportScenarios)('$name', ({ command, fieldNamedInTheFailure }) => {
    // Arrange: a broken report (from the table above).
    const brokenReport = command;

    // Act: check it and turn the failure into readable text.
    const result = ReportInstanceStatusCommandSchema.safeParse(brokenReport);
    const failureMessage = result.error ? z.prettifyError(result.error) : '';

    // Assert: it is refused and the message points at the field that is wrong.
    expect(result.success, 'a broken report must be refused').toBe(false);
    expect(failureMessage, 'the failure must name the field that is wrong').toContain(
      fieldNamedInTheFailure,
    );
  });
});

describe('CommandSchema with a reportInstanceStatus', () => {
  it.each(acceptedReportScenarios)('$name', ({ command }) => {
    // Arrange: the same report, as the store receives it.
    const reportFromRenderer = command;

    // Act: check it against the list of every command.
    const result = CommandSchema.safeParse(reportFromRenderer);

    // Assert: it is accepted unchanged.
    expect(result.success, 'reportInstanceStatus must be a known command').toBe(true);
    expect(result.data, 'the command has no defaults to fill in').toEqual(reportFromRenderer);
  });
});
