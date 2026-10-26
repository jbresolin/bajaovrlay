import type { CommandInput, Layer } from '@bajaovrlay/shared';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from 'cn';
import { useId } from 'react';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { DeleteItemButton } from '@/features/rundown/DeleteItemButton';
import { DragHandleIcon } from '@/features/rundown/DragHandleIcon';
import { ptBR } from '@/i18n/ptBR';
import { useIsConnectedToServer } from '@/state/ControlPageStateProvider';

import { NameEditor } from './NameEditor';

const texts = ptBR.outputs;
const replacePolicies: Layer['replacePolicy'][] = ['out-then-in', 'cut', 'crossfade'];

/** What one layer row needs. */
export type OutputLayerRowProps = {
  layer: Layer;
  /** How many graphics default to this layer: the armed "Excluir" warns about them. */
  numberOfGraphicsDefaultingToIt: number;
  /** Sends a command from this card; answers whether the server accepted it. */
  sendFromTheCard: (command: CommandInput) => Promise<boolean>;
};

/**
 * One layer of an output: the "Mover" handle (the only part that starts a drag), its
 * height, its name with "Salvar nome", how it swaps one graphic for the next, whether it
 * stays on air across items, and "Excluir" (two presses). Each control sends updateLayer
 * with only what it changes; the row shows the server's values, never its own guess.
 */
export function OutputLayerRow(props: OutputLayerRowProps) {
  const { layer } = props;
  const isConnected = useIsConnectedToServer();
  const persistentSwitchId = useId();

  // dnd-kit's hook for one row of the sortable list; the shift is only visual, the order
  // stays the server's until its next layers slice.
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: layer.id,
    disabled: !isConnected,
    attributes: { roleDescription: texts.layerHandleRoleDescription },
  });

  const warningWhileArmed =
    props.numberOfGraphicsDefaultingToIt > 0
      ? texts.graphicsDefaultingToLayer(props.numberOfGraphicsDefaultingToIt)
      : undefined;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      aria-label={layer.name}
      className={cn(
        'flex flex-wrap items-center gap-2 rounded-md border bg-card p-2',
        isDragging && 'relative z-10 opacity-70 shadow-md',
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        disabled={!isConnected}
        aria-label={texts.moveLayerHandle}
        className="cursor-grab touch-none rounded-sm p-1 text-muted-foreground outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <DragHandleIcon />
      </button>
      <span className="text-muted-foreground w-20 text-xs">{texts.layerHeight(layer.zIndex)}</span>
      <NameEditor
        key={layer.name}
        currentName={layer.name}
        fieldLabel={texts.layerNameLabel(layer.name)}
        saveButtonText={texts.saveLayerNameButton}
        onSave={(newName) =>
          void props.sendFromTheCard({ type: 'updateLayer', layerId: layer.id, name: newName })
        }
      />
      <Select
        value={layer.replacePolicy}
        disabled={!isConnected}
        onValueChange={(chosen) =>
          void props.sendFromTheCard({
            type: 'updateLayer',
            layerId: layer.id,
            replacePolicy: chosen as Layer['replacePolicy'],
          })
        }
      >
        <SelectTrigger size="sm" className="w-44" aria-label={texts.replacePolicyLabel(layer.name)}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {replacePolicies.map((replacePolicy) => (
            <SelectItem key={replacePolicy} value={replacePolicy}>
              {texts.replacePolicyNames[replacePolicy]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex items-center gap-2">
        <Switch
          id={persistentSwitchId}
          checked={layer.persistent}
          disabled={!isConnected}
          onCheckedChange={(isPersistent) =>
            void props.sendFromTheCard({
              type: 'updateLayer',
              layerId: layer.id,
              persistent: isPersistent,
            })
          }
        />
        <Label htmlFor={persistentSwitchId} className="text-xs">
          {texts.persistentLabel}
        </Label>
      </div>
      <DeleteItemButton
        texts={{
          deleteButton: texts.deleteLayerButton,
          confirmButton: texts.deleteLayerConfirmButton,
        }}
        warningWhileArmed={warningWhileArmed}
        onDeleteConfirmed={() =>
          void props.sendFromTheCard({ type: 'deleteLayer', layerId: layer.id })
        }
      />
    </li>
  );
}
