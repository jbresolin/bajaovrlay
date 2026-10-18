import { ItemColorChip } from '@/features/items/ItemColorChip';
import { ptBR } from '@/i18n/ptBR';
import { useServerState } from '@/state/ControlPageStateProvider';

/**
 * The item a graphic on air came from, named on the layer's row so every row says which
 * prepared item it is ("Largada do enduro"), with the item's colour chip before the label,
 * as on its rundown row and its quick-fire button. `itemId` is what the server stamped on
 * the instance. Since BAJAOVRLAY-37 every instance has one, with two exceptions the row
 * names in words instead: "sem item" for an instance put on air by hand before that, and
 * "item excluído" for one whose item was deleted while it stayed on air.
 * The label is read from the `items` slice as it is now, so a renamed item shows its new
 * name, even though the graphic on air still carries the data of the old take.
 */
export function ItemLabelOnAir(props: { itemId: string | undefined }) {
  const items = useServerState((state) => state.items);

  if (props.itemId === undefined) {
    return <span className="text-muted-foreground">{ptBR.layers.withoutItem}</span>;
  }
  const itemOnAir = items.find((item) => item.id === props.itemId);
  if (itemOnAir === undefined) {
    return <span className="text-muted-foreground">{ptBR.layers.itemDeleted}</span>;
  }
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <ItemColorChip color={itemOnAir.color} />
      <span className="truncate font-medium">{itemOnAir.label}</span>
    </span>
  );
}
