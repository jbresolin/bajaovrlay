import type { Item } from '@bajaovrlay/shared';

import { Badge } from '@/components/ui/badge';
import { ptBR } from '@/i18n/ptBR';
import { useServerState } from '@/state/ControlPageStateProvider';

import { doesItemReadASource, findWhyItemCannotBeTakenNow } from './itemTakeReadiness';

/**
 * The small marker of an item that reads a source, on its rundown row and its shortcut
 * button: "fonte", or "fonte · não entra agora" when a take would be refused right now
 * (no data yet, a source deleted…), the reason in its tooltip and read out with it, so
 * the operator knows before pressing and not only from the refusal. Nothing for an item
 * that reads no source.
 */
export function ItemSourceMarker(props: { item: Item }) {
  const graphics = useServerState((state) => state.graphics);
  const dataSources = useServerState((state) => state.dataSources);
  const dataSnapshots = useServerState((state) => state.dataSnapshots);
  const overrides = useServerState((state) => state.overrides);
  const teams = useServerState((state) => state.teams);
  if (!doesItemReadASource(props.item)) {
    return null;
  }
  const texts = ptBR.bindings.marker;
  const graphic = graphics.find((candidate) => candidate.id === props.item.graphicId);
  const reason = findWhyItemCannotBeTakenNow(
    props.item,
    graphic,
    { dataSources, dataSnapshots, overrides },
    { teams },
  );
  if (reason === undefined) {
    return (
      <Badge variant="outline" title={texts.readsASourceHint}>
        {texts.readsASource}
      </Badge>
    );
  }
  return (
    <Badge variant="warning" title={reason} aria-label={texts.cannotTakeNowLabel(reason)}>
      {texts.cannotTakeNow}
    </Badge>
  );
}
