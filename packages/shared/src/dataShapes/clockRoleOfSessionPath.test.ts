/**
 * The clock role of a session clock path (packages/shared)
 *
 * What this module is for:
 *   The session clock's fields fill a graphic's clock fields, which a manifest marks by
 *   role (clockTime, wallClock, clockRunning, clockMode). The control page writes a clock
 *   value in words by its role (a time, a moment), so it must learn the role of a path
 *   from the shape that names the paths, not by naming them itself (gate 2 of PR #18).
 *
 * What these tests prove:
 *   - Each of the session clock's four paths has its role.
 *   - A path outside the clock, and the whole clock, have none.
 *
 * What these tests deliberately do not cover:
 *   - Writing the values; sourceValueText.test.ts in apps/control.
 */
import { describe, expect, it } from 'vitest';

import { findClockRoleOfSessionPath } from './bindablePaths.js';

describe('findClockRoleOfSessionPath', () => {
  const scenarios = [
    // The four fields of the session clock, each with the role it fills.
    { name: 'gives the time its role', path: 'clock.referenceTimeMs', role: 'clockTime' },
    { name: 'gives the moment its role', path: 'clock.referenceWallClockMs', role: 'wallClock' },
    { name: 'gives the switch its role', path: 'clock.running', role: 'clockRunning' },
    { name: 'gives the mode its role', path: 'clock.clockMode', role: 'clockMode' },
    // The flag is a session field, not a clock field.
    { name: 'gives the flag none', path: 'state', role: undefined },
    // The whole clock is the group, not one of its fields.
    { name: 'gives the whole clock none', path: 'clock', role: undefined },
  ];

  it.each(scenarios)('$name', ({ path, role }) => {
    // Arrange: this row's path.

    // Act: find its clock role.
    const found = findClockRoleOfSessionPath(path);

    // Assert: the role the path fills, or none.
    expect(found, 'the clock role of this path').toBe(role);
  });
});
