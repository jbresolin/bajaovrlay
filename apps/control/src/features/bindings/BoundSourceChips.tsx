import type { Graphic, Instance } from '@bajaovrlay/shared';

import { Badge } from '@/components/ui/badge';
import { useServerAlignedTimeMs } from '@/features/dataSources/useServerAlignedTimeMs';
import { nameFieldsByTheirTitles } from '@/features/layers/fieldsOfInstanceOnAir';
import { ptBR } from '@/i18n/ptBR';
import { useServerState } from '@/state/ControlPageStateProvider';

import { summarizeSourcesOfInstance } from './sourceStateOfInstance';

// The health rule turns amber into red after a minute; reading the clock every second
// lets the chip change by itself, as the "Fontes" chips do.
const healthRefreshIntervalMs = 1_000;

/**
 * The chips of a Camadas row about the sources its instance reads live: "fonte
 * atrasada" (amber), "fonte com erro" (red), "fonte excluída" or "fonte desligada";
 * "valor corrigido" while a correction changed a bound value; and "atualização recusada"
 * (red, the refused fields in its tooltip) while the graphic refused part of the last
 * refresh. Nothing for an instance with no live binding.
 */
export function BoundSourceChips(props: { instance: Instance; graphic: Graphic | undefined }) {
  const instanceBindings = useServerState((state) => state.instanceBindings);
  const dataSources = useServerState((state) => state.dataSources);
  const dataSnapshots = useServerState((state) => state.dataSnapshots);
  const overrides = useServerState((state) => state.overrides);
  const nowMs = useServerAlignedTimeMs(healthRefreshIntervalMs);
  const summary = summarizeSourcesOfInstance(
    props.instance.id,
    props.graphic,
    { instanceBindings, dataSources, dataSnapshots, overrides },
    nowMs,
  );
  const texts = ptBR.bindings.chips;

  return (
    <>
      {summary.sourceState === 'late' && <Badge variant="warning">{texts.sourceLate}</Badge>}
      {summary.sourceState === 'failing' && (
        <Badge variant="destructive">{texts.sourceFailing}</Badge>
      )}
      {summary.sourceState === 'deleted' && <Badge variant="outline">{texts.sourceDeleted}</Badge>}
      {summary.sourceState === 'off' && <Badge variant="outline">{texts.sourceOff}</Badge>}
      {summary.isAnyBoundValueCorrected && <Badge variant="outline">{texts.valueCorrected}</Badge>}
      {summary.refusedFieldKeys.length > 0 && (
        <Badge
          variant="destructive"
          title={texts.refreshRefusedTooltip(
            nameFieldsByTheirTitles(props.graphic, summary.refusedFieldKeys).join(', '),
          )}
        >
          {texts.refreshRefused}
        </Badge>
      )}
    </>
  );
}
