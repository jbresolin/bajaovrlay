import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ptBR } from '@/i18n/ptBR';

/**
 * The chip "alterado no ar" on a Camadas row whose instance no longer shows what its
 * item gives (`fieldsChangedOnAir`), with a tooltip naming those fields by their titles:
 * "Alterado no ar: …" for the instance on program, "Alterado na prévia: …" for the
 * layer's preview. It can be reached with the Tab key, so the tooltip opens from the
 * keyboard too.
 */
export function ChangedOnAirChip(props: {
  changedFieldTitles: string[];
  output: 'program' | 'preview';
}) {
  const fieldTitles = props.changedFieldTitles.join(', ');
  const tooltipText =
    props.output === 'program'
      ? ptBR.layers.changedOnAirTooltip(fieldTitles)
      : ptBR.layers.changedInPreviewTooltip(fieldTitles);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="secondary" tabIndex={0}>
          {ptBR.layers.changedOnAirChip}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{tooltipText}</TooltipContent>
    </Tooltip>
  );
}
