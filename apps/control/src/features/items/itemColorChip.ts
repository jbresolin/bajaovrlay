import type { ItemColor } from '@bajaovrlay/shared';

/**
 * The background class of the small colour chip for each of the six item colours. The
 * classes come from the item colour tokens in src/index.css (`--color-item-*`), so the
 * editor shows the same colours as the rundown rows and follows a theme change.
 * They are written out in full, one per name, because Tailwind only generates a class
 * it can find as whole text in the source; a class glued together at run time
 * (`bg-item-` + name) would silently have no colour.
 * What could go wrong: a seventh name in ItemColorSchema fails the typecheck here until
 * it gets a class, and needs a token in index.css as well.
 */
export const chipClassForEachItemColor: Record<ItemColor, string> = {
  neutral: 'bg-item-neutral',
  info: 'bg-item-info',
  success: 'bg-item-success',
  warning: 'bg-item-warning',
  danger: 'bg-item-danger',
  highlight: 'bg-item-highlight',
};
