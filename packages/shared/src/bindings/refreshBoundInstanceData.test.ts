/**
 * The refresh of an instance's live bound fields, as a command (packages/shared)
 *
 * What this module is for:
 *   When a source's data changes, the server's refresher sends refreshBoundInstanceData
 *   (instanceId, data) through the one command path, so the change is validated, saved
 *   and broadcast like any other. The command is part of the shared union so the
 *   server's single code path can read it.
 *
 * What these tests prove:
 *   - A refresh of the flag of the clock on air is accepted, unchanged.
 *   - A refresh with no instance id, or with no data, is refused, naming the part.
 *
 * What these tests deliberately do not cover:
 *   - Who may send it (only `sistema:vinculos`); authorizeBindingCommands.test.ts.
 *   - What it does to an instance; refreshBoundInstanceData.test.ts in apps/server.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { CommandSchema } from '../commands/command.js';

describe('refreshBoundInstanceData in the command union', () => {
  it('accepts the yellow flag for the clock on air, unchanged', () => {
    // Arrange: what the refresher sends when the simulator raises the yellow flag.
    const refresh = {
      type: 'refreshBoundInstanceData',
      instanceId: '0b6c8f2e-3d1a-4c55-8e2f-9a7b6c5d4e3f',
      data: { state: 'yellow' },
    };

    // Act: check it.
    const result = CommandSchema.safeParse(refresh);

    // Assert: accepted as sent.
    expect(result.success, 'the refresh must be accepted').toBe(true);
    expect(result.data, 'the refresh must not be altered').toEqual(refresh);
  });

  const refusedRefreshes = [
    // A refresh of no instance would change nothing on air.
    {
      name: 'refuses a refresh with no instance id, naming instanceId',
      command: { type: 'refreshBoundInstanceData', data: { state: 'yellow' } },
      partNamed: 'instanceId',
    },
    // The values are the point of a refresh.
    {
      name: 'refuses a refresh with no data, naming data',
      command: { type: 'refreshBoundInstanceData', instanceId: 'relogio-no-ar' },
      partNamed: 'data',
    },
  ];

  it.each(refusedRefreshes)('$name', ({ command, partNamed }) => {
    // Arrange: the command of this row.

    // Act: check it and read the failure.
    const result = CommandSchema.safeParse(command);
    const failureMessage = result.error ? z.prettifyError(result.error) : '';

    // Assert: refused, naming the missing part.
    expect(result.success, 'a refresh missing a part must be refused').toBe(false);
    expect(failureMessage, 'the failure must name the missing part').toContain(partNamed);
  });
});
