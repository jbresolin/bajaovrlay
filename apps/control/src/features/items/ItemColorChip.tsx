import type { ItemColor } from '@bajaovrlay/shared';
import { cn } from 'cn';

import { chipClassForEachItemColor } from './itemColorChip';

/**
 * The small coloured dot of an item: at the start of a rundown row, and beside the item's
 * label on the layer panel row where it is on air. Its colour comes from the same list of
 * classes the item editor's colour picker uses, so it always shows the colour the
 * operator picked. It is decoration for the eye (hidden from screen readers): the
 * colour is the operator's own mark to find a row fast, and what the item IS is always
 * said in words by its label. It moved here from features/rundown when the layer panel
 * started using it too.
 */
export function ItemColorChip(props: { color: ItemColor }) {
  return (
    <span
      aria-hidden="true"
      data-item-color={props.color}
      className={cn('size-3 shrink-0 rounded-full', chipClassForEachItemColor[props.color])}
    />
  );
}
