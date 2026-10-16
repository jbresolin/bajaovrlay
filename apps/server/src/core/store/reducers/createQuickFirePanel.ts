import type { CreateQuickFirePanelCommand, QuickFirePanel } from '@bajaovrlay/shared';

import type { ReducerContext, ReducerOutcome, SlicesChangedByCommands } from './reducerTypes.js';

/**
 * createQuickFirePanel: adds an empty panel after the last one, with the id the store
 * made. Never refused: two panels may share a name, as two items may share a label.
 */
export function reduceCreateQuickFirePanel(
  slices: SlicesChangedByCommands,
  command: CreateQuickFirePanelCommand,
  context: ReducerContext,
): ReducerOutcome {
  // The panels are always numbered 0..n-1, so their count is the position after the last.
  const newPanel: QuickFirePanel = {
    id: context.newQuickFirePanelId,
    name: command.name,
    order: slices.quickFirePanels.length,
  };
  return {
    status: 'applied',
    slices: { ...slices, quickFirePanels: [...slices.quickFirePanels, newPanel] },
  };
}
