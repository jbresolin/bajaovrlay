import type { InstanceStatus } from '@bajaovrlay/shared';

import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ptBR } from '@/i18n/ptBR';

/** What the badge needs: the instance's status and, for a failure, the renderer's detail. */
export type InstanceStatusBadgeProps = {
  status: InstanceStatus;
  /** Why the graphic failed, as the renderer reported it; undefined when it gave none. */
  statusDetail: string | undefined;
};

/**
 * The coloured status word at the end of a layer row. Green "No ar" once the renderer
 * has acknowledged the graphic, grey "Carregando" until then, and red "Falhou" with the
 * reason in a tooltip. Only semantic colour tokens are used (see index.css).
 */
export function InstanceStatusBadge(props: InstanceStatusBadgeProps) {
  const { status, statusDetail } = props;
  const statusWord = ptBR.layers.instanceStatus[status];

  if (status === 'on-air') {
    return <Badge variant="success">{statusWord}</Badge>;
  }
  if (status === 'loading') {
    return <Badge variant="secondary">{statusWord}</Badge>;
  }
  if (status === 'failed') {
    // The detail is the renderer's own error text (often English, from the browser) and
    // is shown as received: translating it here would mean guessing. A badge is not a
    // control and gets no keyboard focus by itself, so the focusable <span> around it is
    // what the mouse and the Tab key reach, as around a disabled ActionButton.
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className="inline-flex rounded-full">
            <Badge variant="destructive">{statusWord}</Badge>
          </span>
        </TooltipTrigger>
        <TooltipContent>{statusDetail ?? ptBR.layers.failedWithoutDetail}</TooltipContent>
      </Tooltip>
    );
  }
  // "ready" and "stopping": no command or report sets them yet, so they stay neutral.
  return <Badge variant="outline">{statusWord}</Badge>;
}
