/**
 * The authorisation hook (apps/server)
 *
 * What this module is for:
 *   Every command passes an authorisation step between validation and the reducer.
 *   M0 has no operator login, so the default hook, `allowEveryCommand`, lets every
 *   command through. It exists now so that adding login later changes one function,
 *   not the command path.
 *
 * What these tests prove:
 *   - The default hook allows each of the three M0 commands from an operator.
 *
 * What these tests deliberately do not cover:
 *   - What the store does with a "no"; createStateStore.test.ts gives the store a
 *     hook that refuses and checks the command is refused and logged.
 */
import type { Command } from '@bajaovrlay/shared';
import { describe, expect, it } from 'vitest';

import { allowEveryCommand } from './authorizeCommand.js';

const everyM0CommandScenarios: Array<{ name: string; command: Command }> = [
  // The command that puts graphics on air.
  {
    name: 'allows takeGraphic',
    command: {
      type: 'takeGraphic',
      graphicId: 'race-clock',
      layerId: 'clock',
      data: { sessionName: 'Enduro de Resistência' },
      target: 'program',
    },
  },
  // Taking one layer off air.
  { name: 'allows clearLayer', command: { type: 'clearLayer', layerId: 'lower-third' } },
  // The panic button must never be blocked by a hook that does nothing yet.
  { name: 'allows clearAll', command: { type: 'clearAll' } },
];

describe('allowEveryCommand', () => {
  it.each(everyM0CommandScenarios)('$name', ({ command }) => {
    // Arrange: an operator connected from the control page.
    const operatorActor = 'operador:conexao-7';

    // Act: ask the default hook whether the command may run.
    const isAllowed = allowEveryCommand(command, operatorActor);

    // Assert: it may.
    expect(isAllowed, 'without login, every command must be allowed').toBe(true);
  });
});
