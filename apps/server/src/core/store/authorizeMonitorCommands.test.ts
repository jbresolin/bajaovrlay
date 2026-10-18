/**
 * The authorisation hook for monitor connections (apps/server)
 *
 * What this module is for:
 *   The control page frames two copies of the renderer page: "Programa"
 *   (`/render/?monitor=1`) and "Prévia" (`/render/?target=preview&monitor=1`). Both dial
 *   `/ws?role=monitor` and act as `monitor:<connection id>`. They only draw: the renderer
 *   page never sends a command, and on a monitor it is given no reporter, so it never
 *   sends an instanceStatus either. `allowCommandForActorRole` therefore allows a monitor
 *   nothing at all, so a page that only draws can never change what is on air, nor claim
 *   what OBS shows.
 *
 * What these tests prove:
 *   - A monitor is refused a report of what is on screen (only the program renderer
 *     reports), the panic clear, a take, a preview, an item edit, turning a data source
 *     on, and a poll result.
 *   - The same reportInstanceStatus is still allowed from the program renderer, so the
 *     refusal comes from the monitor role and not from the command.
 *
 * What these tests deliberately do not cover:
 *   - How a connection gets the monitor role; ws/connectionActor.test.ts covers it, and
 *     ws/webSocketHubRoles.test.ts shows the NOT_ALLOWED answer over a real socket.
 *   - Every command of the set: the rule is "nothing", so a row per command would only
 *     repeat it; these rows cover each family of commands once.
 */
import type { Command } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { allowCommandForActorRole } from './authorizeCommand.js';

const monitorActor = 'monitor:5c9e2f14-7a3b-4d8e-b1f6-0e4a7c2d9b35';
const rendererActor = 'renderer:b8d4e6f0-1a2c-4e3b-9d5f-6a7c8e9f0b12';

const reportRaceClockOnAir: Command = {
  type: 'reportInstanceStatus',
  instanceId: '7d3c1a52-4f0e-4b8e-9a51-2f6f1e0c9b11',
  status: 'on-air',
};
const takeYellowFlagItem: Command = {
  type: 'takeItem',
  itemId: '2b8f4c1d-6e3a-4f9b-8d27-5a1c0e7b3f62',
};
const previewYellowFlagItem: Command = {
  type: 'previewItem',
  itemId: '2b8f4c1d-6e3a-4f9b-8d27-5a1c0e7b3f62',
  origin: 'manual',
};
const deleteYellowFlagItem: Command = {
  type: 'deleteItem',
  itemId: '2b8f4c1d-6e3a-4f9b-8d27-5a1c0e7b3f62',
};
const turnOnEnduroSimulator: Command = {
  type: 'setDataSourceEnabled',
  sourceId: 'simulador-enduro',
  isEnabled: true,
};
const pollOfTheEnduroSimulator: Command = {
  type: 'recordDataSourcePoll',
  sourceId: 'simulador-enduro',
  result: { ok: false, error: 'Falha simulada.', attemptedAtMs: 1_786_717_925_000 },
};

const authorisationScenarios: Array<{
  name: string;
  command: Command;
  actor: string;
  expectedIsAllowed: boolean;
  expectationInWords: string;
}> = [
  // Only the program output says what really went on air; a monitor's "on air" would lie.
  {
    name: 'refuses reportInstanceStatus from a monitor',
    command: reportRaceClockOnAir,
    actor: monitorActor,
    expectedIsAllowed: false,
    expectationInWords: 'a monitor only draws, so this command from it must be refused',
  },
  // The same report from OBS is allowed, so the row above is about the monitor role.
  {
    name: 'still allows reportInstanceStatus from the program renderer',
    command: reportRaceClockOnAir,
    actor: rendererActor,
    expectedIsAllowed: true,
    expectationInWords: 'the program renderer must still be allowed to report what is on air',
  },
  // A frame on the control page must never be able to empty the screen.
  {
    name: 'refuses clearAll from a monitor',
    command: { type: 'clearAll' },
    actor: monitorActor,
    expectedIsAllowed: false,
    expectationInWords: 'a monitor only draws, so this command from it must be refused',
  },
  // Nor put a graphic on air.
  {
    name: 'refuses takeItem from a monitor',
    command: takeYellowFlagItem,
    actor: monitorActor,
    expectedIsAllowed: false,
    expectationInWords: 'a monitor only draws, so this command from it must be refused',
  },
  // Nor change what "Prévia" shows, although it is the "Prévia" frame itself.
  {
    name: 'refuses previewItem from a monitor',
    command: previewYellowFlagItem,
    actor: monitorActor,
    expectedIsAllowed: false,
    expectationInWords: 'a monitor only draws, so this command from it must be refused',
  },
  // Nor touch the rundown or its items.
  {
    name: 'refuses deleteItem from a monitor',
    command: deleteYellowFlagItem,
    actor: monitorActor,
    expectedIsAllowed: false,
    expectationInWords: 'a monitor only draws, so this command from it must be refused',
  },
  // Nor turn a data source on or off.
  {
    name: 'refuses setDataSourceEnabled from a monitor',
    command: turnOnEnduroSimulator,
    actor: monitorActor,
    expectedIsAllowed: false,
    expectationInWords: 'a monitor only draws, so this command from it must be refused',
  },
  // Nor fake race data, like every page.
  {
    name: 'refuses recordDataSourcePoll from a monitor',
    command: pollOfTheEnduroSimulator,
    actor: monitorActor,
    expectedIsAllowed: false,
    expectationInWords: 'a monitor only draws, so this command from it must be refused',
  },
];

describe('allowCommandForActorRole for a monitor', () => {
  it.each(authorisationScenarios)(
    '$name',
    ({ command, actor, expectedIsAllowed, expectationInWords }) => {
      // Arrange: the command and the actor of this scenario (see the table above).

      // Act: ask the default hook whether this actor may run this command.
      const isAllowed = allowCommandForActorRole(command, actor);

      // Assert: a monitor may send nothing; the program renderer may still report.
      expect(isAllowed, expectationInWords).toBe(expectedIsAllowed);
    },
  );
});
