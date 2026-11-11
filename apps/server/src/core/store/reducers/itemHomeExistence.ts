import type { CommandError, ItemHome } from '@bajaovrlay/shared';

import { refuseUnknownQuickFirePanel } from '../quickFireAndMacroRefusals.js';
import { refuseUnknownRundown } from '../rundownCommandRefusals.js';
import type { SlicesChangedByCommands } from './reducerTypes.js';

/**
 * The refusal for a home that does not exist (an unknown rundown, or an unknown
 * quick-fire panel), or undefined when it exists; the event templates always do. Shared
 * by createItem and moveItemToHome, the two commands that put an item into a home.
 */
export function findRefusalOfUnknownItemHome(
  slices: SlicesChangedByCommands,
  home: ItemHome,
): CommandError | undefined {
  if (home.kind === 'eventTemplates') {
    return undefined;
  }
  if (home.kind === 'rundown') {
    const rundownExists = slices.rundowns.some((rundown) => rundown.id === home.rundownId);
    return rundownExists ? undefined : refuseUnknownRundown(home.rundownId);
  }
  const panelExists = slices.quickFirePanels.some((panel) => panel.id === home.panelId);
  return panelExists ? undefined : refuseUnknownQuickFirePanel(home.panelId);
}
