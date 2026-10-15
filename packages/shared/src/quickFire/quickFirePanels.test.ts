/**
 * Quick-fire panels and their commands (packages/shared)
 *
 * What this module is for:
 *   A quick-fire panel is a named grid of buttons, one per item, for the things an
 *   operator fires ad hoc ("Atalhos", "Patrocinadores"). The panels are a slice of their
 *   own, `quickFirePanels`, each with a position among the panels (`order`); the items
 *   say which panel they sit in through their `home`. Three commands create, rename and
 *   delete a panel.
 *
 * What these tests prove:
 *   - A panel is accepted unchanged, and refused with an empty name or a negative order.
 *   - createQuickFirePanel needs a name, renameQuickFirePanel a panel and a new name,
 *     deleteQuickFirePanel a panel; an empty name is refused, naming the field.
 *
 * What these tests deliberately do not cover:
 *   - The `quickFirePanels` slice inside the whole state; slices.test.ts covers it.
 *   - Whether the panel exists, is empty, or is the last one; the reducers in
 *     apps/server check that against the state.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { CommandSchema } from '../commands/command.js';
import { QuickFirePanelSchema } from './quickFirePanel.js';

describe('QuickFirePanelSchema', () => {
  it('accepts the seeded panel "Atalhos" unchanged', () => {
    // Arrange: the panel the server seeds on the first boot.
    const shortcutsPanel = { id: 'atalhos', name: 'Atalhos', order: 0 };

    // Act: check it against the panel schema.
    const result = QuickFirePanelSchema.safeParse(shortcutsPanel);

    // Assert: accepted exactly as written.
    expect(result.success, 'the seeded panel must be accepted').toBe(true);
    expect(result.data, 'the accepted panel must not be altered').toEqual(shortcutsPanel);
  });

  const refusedPanelScenarios = [
    // A tab with no name cannot be told apart from the others.
    { name: 'refuses a panel with an empty name', panel: { id: 'atalhos', name: '', order: 0 } },
    // Positions count from 0; a negative one is a server bug.
    {
      name: 'refuses a panel with a negative order',
      panel: { id: 'patrocinadores', name: 'Patrocinadores', order: -1 },
    },
  ];

  it.each(refusedPanelScenarios)('$name', ({ panel }) => {
    // Arrange: the panel of this row (built above).

    // Act: check it.
    const result = QuickFirePanelSchema.safeParse(panel);

    // Assert: refused.
    expect(result.success, 'this panel must be refused').toBe(false);
  });
});

describe('the quick-fire panel commands', () => {
  const acceptedCommandScenarios = [
    // A new tab in the strip, named by the operator.
    {
      name: 'accepts createQuickFirePanel with a name',
      command: { type: 'createQuickFirePanel', name: 'Patrocinadores' },
    },
    // Renaming keeps the panel's id, so its buttons stay where they are.
    {
      name: 'accepts renameQuickFirePanel with the panel and its new name',
      command: { type: 'renameQuickFirePanel', panelId: 'atalhos', name: 'Atalhos do enduro' },
    },
    // Deleting names only the panel; the server refuses a panel that still has items.
    {
      name: 'accepts deleteQuickFirePanel with the panel',
      command: { type: 'deleteQuickFirePanel', panelId: 'patrocinadores' },
    },
  ];

  it.each(acceptedCommandScenarios)('$name', ({ command }) => {
    // Arrange: the command of this row (built above).

    // Act: check it.
    const result = CommandSchema.safeParse(command);

    // Assert: accepted unchanged.
    expect(result.success, 'this panel command must be accepted').toBe(true);
    expect(result.data, 'nothing may be added to the command').toEqual(command);
  });

  const refusedCommandScenarios = [
    // A panel with no name would be a blank tab.
    {
      name: 'refuses createQuickFirePanel with an empty name',
      command: { type: 'createQuickFirePanel', name: '' },
      fieldNamed: 'name',
    },
    // Renaming to nothing is the same mistake.
    {
      name: 'refuses renameQuickFirePanel with an empty name',
      command: { type: 'renameQuickFirePanel', panelId: 'atalhos', name: '' },
      fieldNamed: 'name',
    },
    // Without the panel the server cannot know which tab to delete.
    {
      name: 'refuses deleteQuickFirePanel without the panel',
      command: { type: 'deleteQuickFirePanel' },
      fieldNamed: 'panelId',
    },
  ];

  it.each(refusedCommandScenarios)('$name', ({ command, fieldNamed }) => {
    // Arrange: the command of this row (built above).

    // Act: check it and turn the failure into readable text.
    const result = CommandSchema.safeParse(command);
    const failureMessage = result.error ? z.prettifyError(result.error) : '';

    // Assert: refused, naming the field that is wrong.
    expect(result.success, 'this panel command must be refused').toBe(false);
    expect(failureMessage, 'the failure must name the bad field').toContain(fieldNamed);
  });
});
