// Everything about quick-fire panels that @bajaovrlay/shared exports. The package's own
// index.ts re-exports this file with one line; other packages import from
// '@bajaovrlay/shared', never from here.

// The `quickFirePanels` slice: named grids of buttons, in tab order.
export { type QuickFirePanel, QuickFirePanelSchema } from './quickFirePanel.js';
// createQuickFirePanel: add an empty panel after the last one.
export {
  type CreateQuickFirePanelCommand,
  CreateQuickFirePanelCommandSchema,
} from './createQuickFirePanel.js';
// renameQuickFirePanel: give a panel a new name.
export {
  type RenameQuickFirePanelCommand,
  RenameQuickFirePanelCommandSchema,
} from './renameQuickFirePanel.js';
// deleteQuickFirePanel: remove an empty panel that is not the last one.
export {
  type DeleteQuickFirePanelCommand,
  DeleteQuickFirePanelCommandSchema,
} from './deleteQuickFirePanel.js';
