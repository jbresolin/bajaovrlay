import type { ItemColor } from '@bajaovrlay/shared';

/**
 * The classes that paint a whole button in an item's colour, with text that reads on it:
 * the quick-fire buttons (features/quickFire) and the macro buttons (features/macros).
 * They come from the item colour tokens in src/index.css (`--color-item-*` and
 * `--color-item-*-foreground`), the same colours as the chips of the rundown rows.
 * Written out in full, one per name, for the reason given in itemColorChip.ts: Tailwind
 * only generates a class it finds as whole text in the source.
 */
export const buttonClassForEachItemColor: Record<ItemColor, string> = {
  neutral: 'bg-item-neutral text-item-neutral-foreground',
  info: 'bg-item-info text-item-info-foreground',
  success: 'bg-item-success text-item-success-foreground',
  warning: 'bg-item-warning text-item-warning-foreground',
  danger: 'bg-item-danger text-item-danger-foreground',
  highlight: 'bg-item-highlight text-item-highlight-foreground',
};
