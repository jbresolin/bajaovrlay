/**
 * "Escolher carros" (BAJAOVRLAY-82): the public surface. The quick-fire strip and the
 * rundown import from here only.
 */

// What "Escolher carros" offers for an item (its car groups, the battle), or undefined.
export { type CarGroupsToPickQuickly, findCarGroupsToPickQuickly } from './carGroupsToPickQuickly';
// The box around a button or a row, and the chevron on a quick-fire button that opens it.
export { QuickCarPickOpenButton, QuickCarPickPopover } from './QuickCarPickPopover';
