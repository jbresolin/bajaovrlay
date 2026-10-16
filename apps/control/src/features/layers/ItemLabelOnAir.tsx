import { ItemColorChip } from '@/features/items/ItemColorChip';
import { useServerState } from '@/state/ControlPageStateProvider';

/**
 * The label of the rundown item that put a graphic on air ("Largada do enduro"), shown
 * on the layer's row so the operator can tell one use of a graphic from another.
 * `itemId` is what the server stamped on the instance; it is undefined for a graphic
 * taken by hand, and then nothing is drawn. Nothing is drawn either when the item has
 * since been deleted: the row still names the graphic, and an id would help nobody.
 * The label is read from the `items` slice as it is now, so a renamed item shows its
 * new name, even though the graphic on air still carries the data of the old take.
 * The item's colour chip goes before the label, as on its rundown row and its quick-fire
 * button, so the operator finds on the layer panel the colour they gave the item.
 */
export function ItemLabelOnAir(props: { itemId: string | undefined }) {
  const items = useServerState((state) => state.items);

  if (props.itemId === undefined) {
    return null;
  }
  const itemOnAir = items.find((item) => item.id === props.itemId);
  if (itemOnAir === undefined) {
    return null;
  }
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <ItemColorChip color={itemOnAir.color} />
      <span className="truncate font-medium">{itemOnAir.label}</span>
    </span>
  );
}
