import type { Item } from '@bajaovrlay/shared';

import { Badge } from '@/components/ui/badge';
import { ptBR } from '@/i18n/ptBR';
import { useServerState } from '@/state/ControlPageStateProvider';

import {
  doesItemReadTheLibrary,
  findWhyItemCannotBeTakenNowFromTheLibrary,
} from './itemEntityReadiness';
import { useEntityLibrary } from './useEntityLibrary';

/**
 * The small marker of an item that reads the entity library, on its rundown row and its
 * shortcut button, beside the source marker: "cadastro", or "cadastro · não entra agora"
 * when a take would be refused right now (a team deleted in Cadastros), the reason in its
 * tooltip and read out with it. Nothing for an item that reads nothing of the library.
 */
export function ItemEntityMarker(props: { item: Item }) {
  const graphics = useServerState((state) => state.graphics);
  const library = useEntityLibrary();
  if (!doesItemReadTheLibrary(props.item)) {
    return null;
  }
  const texts = ptBR.entityLibrary.marker;
  const graphic = graphics.find((candidate) => candidate.id === props.item.graphicId);
  const reason = findWhyItemCannotBeTakenNowFromTheLibrary(props.item, graphic, library);
  if (reason === undefined) {
    return (
      <Badge variant="outline" title={texts.readsTheLibraryHint}>
        {texts.readsTheLibrary}
      </Badge>
    );
  }
  return (
    <Badge variant="warning" title={reason} aria-label={texts.cannotTakeNowLabel(reason)}>
      {texts.cannotTakeNow}
    </Badge>
  );
}
