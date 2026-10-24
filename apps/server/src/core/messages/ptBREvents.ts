import type { InboxEventKind, InboxEventStatus } from '@bajaovrlay/shared';

/**
 * The server's pt-BR messages about the event inbox (BAJAOVRLAY-44), reached as
 * ptBR.eventErrors. Kept apart from ptBR.ts to keep that file short.
 */
export const ptBREventErrors = {
  /** The quick-fire panel seeded with the two notice items ("Eventos" is the inbox's tab). */
  seededPanelName: 'Avisos',
  seededItemLabels: { fastestLap: 'Volta mais rápida', penalty: 'Penalidade' },
  itemFilledByAnEvent: 'Este item é preenchido por um evento: ele entra no ar pela aba Eventos.',
  /** "Título: o evento não traz "Punição"." */
  eventFieldNotFilled: (fieldTitle: string, pathLabel: string) =>
    `${fieldTitle}: o evento não traz "${pathLabel}".`,
  /** The field's title, then shared's reason: "Título: o campo do evento …". */
  invalidEventField: (fieldTitle: string, reason: string) => `${fieldTitle}: ${reason}`,
  eventNotFound: 'Este evento não está na caixa de eventos.',
  /** A Prévia of an event taken after its rule's maximum wait: never shown late. */
  eventTooOld: 'Este evento não está mais esperando: passou da espera máxima da regra.',
  /** "Regras" naming an item no event fills. */
  itemNotFilledByEvent: (itemLabel: string) =>
    `O item "${itemLabel}" não é preenchido por um evento: escolha um item com campos "Evento".`,
  /** "Este evento não está mais esperando: foi descartado." */
  eventNotWaiting: (status: InboxEventStatus) =>
    `Este evento não está mais esperando: ${ptBREventErrors.whyNotWaiting[status]}.`,
  /** "Este evento não foi descartado: está esperando." (restoreEvent, "Desfazer"). */
  eventNotDismissed: (status: InboxEventStatus) =>
    `Este evento não foi descartado: ${ptBREventErrors.whatItIsInstead[status]}.`,
  /** restoreEvent of a dismissed event past its rule's maximum wait. */
  eventTooOldToRestore:
    'Este evento passou da espera máxima da regra e não pode mais ser restaurado.',
  /**
   * What an event that cannot be restored is instead, by its status. `dismissed` is never
   * read (a dismissed event is restored, not refused); it is here because the type asks
   * for every status, so a new one cannot be forgotten.
   */
  whatItIsInstead: {
    pending: 'está esperando',
    queued: 'está na fila',
    onAir: 'está no ar',
    shown: 'já foi exibido',
    dismissed: 'foi descartado',
    expired: 'expirou',
  } satisfies Record<InboxEventStatus, string>,
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
    newIncident: 'Incidente',
    fastestLap: 'Volta mais rápida',
    leaderChanged: 'Mudança de líder',
    manual: 'Evento digitado',
    superChat: 'Super Chat',
  } satisfies Record<InboxEventKind, string>,
};
