import type { RenameQuickFirePanelCommand } from '@bajaovrlay/shared';

import { refuseUnknownQuickFirePanel } from '../quickFireAndMacroRefusals.js';
import type { ReducerOutcome, SlicesChangedByCommands } from './reducerTypes.js';

/**
 * renameQuickFirePanel: gives a panel a new name; its id, position and items stay.
 * Refused if the panel does not exist. The name it already has hands back the same
 * slices, so nothing is saved, logged or broadcast.
 */
export function reduceRenameQuickFirePanel(
  slices: SlicesChangedByCommands,
  command: RenameQuickFirePanelCommand,
): ReducerOutcome {
  const panel = slices.quickFirePanels.find((candidate) => candidate.id === command.panelId);
  if (panel === undefined) {
    return { status: 'refused', error: refuseUnknownQuickFirePanel(command.panelId) };
  }
  if (panel.name === command.name) {
    return { status: 'applied', slices };
  }
  const panelsAfter = slices.quickFirePanels.map((candidate) =>
    candidate.id === panel.id ? { ...candidate, name: command.name } : candidate,
  );
  return { status: 'applied', slices: { ...slices, quickFirePanels: panelsAfter } };
}
