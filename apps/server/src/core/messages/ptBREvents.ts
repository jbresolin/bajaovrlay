import type { InboxEventKind, InboxEventStatus } from '@bajaovrlay/shared';

/**
 * The server's pt-BR messages about the event inbox (BAJAOVRLAY-44), reached as
 * ptBR.eventErrors. Kept apart from ptBR.ts to keep that file short.
 */
export const ptBREventErrors = {
  eventNotFound: 'Este evento não está na caixa de eventos.',
  /** "Este evento não está mais esperando: foi descartado." */
  eventNotWaiting: (status: InboxEventStatus) =>
    `Este evento não está mais esperando: ${ptBREventErrors.whyNotWaiting[status]}.`,
  /** Why an event is not waiting any more, by its status. */
  whyNotWaiting: {
    pending: 'ainda espera',
    queued: 'está na fila',
    onAir: 'já está no ar',
    shown: 'já foi exibido',
    dismissed: 'foi descartado',
    expired: 'expirou',
  } satisfies Record<InboxEventStatus, string>,
  ruleWithoutItem: (kind: InboxEventKind) =>
    `A regra "${ptBREventErrors.kindNames[kind]}" não tem item para exibir o evento. Escolha um item em Regras.`,
  /** The name of each kind of event, as "Regras" shows it. */
  kindNames: {
    newIncident: 'Ocorrência',
    fastestLap: 'Volta mais rápida',
    leaderChanged: 'Mudança de líder',
    manual: 'Evento digitado',
    superChat: 'Super Chat',
  } satisfies Record<InboxEventKind, string>,
};
