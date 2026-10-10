import type { InstanceStatus } from '@bajaovrlay/shared';
import { useId } from 'react';

import { Badge } from '@/components/ui/badge';
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
 * reason in a tooltip that never uses a key. Only semantic colour tokens are used (see
 * index.css).
 */
export function InstanceStatusBadge(props: InstanceStatusBadgeProps) {
  const { status, statusDetail } = props;
  const statusWord = ptBR.layers.instanceStatus[status];
  // Ties the failure tooltip to the badge for screen readers; unused for other statuses.
  const failureDetailId = useId();

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
    // what the mouse and the Tab key reach.
    //
    // Deliberately not the shadcn/Radix tooltip used elsewhere: while that one is open
    // it uses up the Esc key to close itself, and Esc is the panic key (clear all). A
    // graphic that has just failed is exactly when the operator rests on this badge and
    // then reaches for Esc. This tooltip is shown and hidden by CSS alone (mouse over the
    // area, or keyboard focus on it), so it never touches a key. What could go wrong: it
    // cannot be closed with Esc, only by moving away, and it is placed under the badge
    // without checking the edge of the window.
    return (
      <span
        tabIndex={0}
        aria-describedby={failureDetailId}
        className="group relative inline-flex rounded-full"
      >
        <Badge variant="destructive">{statusWord}</Badge>
        <span
          id={failureDetailId}
          role="tooltip"
          className="absolute top-full left-0 z-50 mt-1 hidden w-max max-w-xs rounded-md bg-primary px-3 py-1.5 text-xs text-balance text-primary-foreground group-hover:block group-focus-visible:block"
        >
          {statusDetail ?? ptBR.layers.failedWithoutDetail}
        </span>
      </span>
    );
  }
  // "ready" and "stopping": no command or report sets them yet, so they stay neutral.
  return <Badge variant="outline">{statusWord}</Badge>;
}
