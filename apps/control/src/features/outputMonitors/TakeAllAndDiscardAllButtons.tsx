import { ActionButton } from '@/features/connection/ActionButton';
import { ptBR } from '@/i18n/ptBR';
import { useSendCommand } from '@/state/ControlPageStateProvider';

/**
 * "Tomar tudo" and "Descartar tudo", for a prepared set: drawn by PreviewedLayersList
 * only while two or more layers have a preview or a "vai limpar" mark.
 *
 * "Tomar tudo" sends `takeAllPreviews`, which the server applies as ONE state change
 * (every preview promoted, every marked layer cleared, lowest layer first), so OBS can
 * never show half of the set. Deliberate: it is sent straight, not through
 * features/autoPreview like "Tomar" and Space, so no automatic preview of the next
 * rundown item follows it; the operator who took a set chooses what to prepare next.
 * "Descartar tudo" sends `stopPreview` with `layerId: null`, which throws away every
 * preview and every mark and leaves the air alone.
 */
export function TakeAllAndDiscardAllButtons() {
  const sendCommand = useSendCommand();

  return (
    <div className="flex items-center gap-2">
      <ActionButton size="xs" onClick={() => void sendCommand({ type: 'takeAllPreviews' })}>
        {ptBR.outputMonitors.takeAllPreviewsButton}
      </ActionButton>
      <ActionButton
        size="xs"
        variant="outline"
        onClick={() => void sendCommand({ type: 'stopPreview', layerId: null })}
      >
        {ptBR.outputMonitors.discardAllPreviewsButton}
      </ActionButton>
    </div>
  );
}
