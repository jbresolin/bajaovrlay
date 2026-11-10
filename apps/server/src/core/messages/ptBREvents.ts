import type { InboxEventKind, InboxEventStatus } from '@bajaovrlay/shared';

/**
 * The server's pt-BR messages about the event inbox (BAJAOVRLAY-44), reached as
 * ptBR.eventErrors. Kept apart from ptBR.ts to keep that file short.
 */
export const ptBREventErrors = {
  seededItemLabels: {
    fastestLap: 'Volta mais rápida',
    penalty: 'Penalidade',
    superChat: 'Super Chat',
  },
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
  /**
   * "Este evento não pode ser trazido de volta: está esperando." (restoreEvent of an event
   * still waiting or on air; "Desfazer", "Restaurar", "Mostrar de novo").
   */
  eventCannotComeBack: (status: InboxEventStatus) =>
    `Este evento não pode ser trazido de volta: ${ptBREventErrors.whatItIsInstead[status]}.`,
  /** createManualEvent of a penalty with no car (BAJAOVRLAY-67). */
  penaltyWithoutCar: 'Uma penalidade é sempre dada a um carro: informe o número do carro.',
  /** createManualEvent of a notice with no car but a team or a school (gate 2 of PR #58). */
  generalNoticeWithTeam:
    'Um aviso geral não tem carro, então não leva equipe nem escola: informe o número do carro ou deixe equipe e escola em branco.',
  /** An event template put on a quick-fire panel (BAJAOVRLAY-67). */
  templateNotOnQuickFire: (itemLabel: string) =>
    `"${itemLabel}" é um modelo de evento e não fica num painel de atalhos: ele entra no ar pela aba Eventos, e sua aparência se escolhe em Regras.`,
  /**
   * The boot's warning for a button the template move shifted (BAJAOVRLAY-67): a pad finds
   * a button by its place, so the same key may now fire another item.
   */
  quickFireButtonShiftedByTheTemplateMove: (button: {
    panelName: string;
    itemLabel: string;
    placeBefore: number;
    placeAfter: number;
  }) =>
    `Botão de atalho mudou de lugar: no painel "${button.panelName}", "${button.itemLabel}" era o botão ${button.placeBefore} e agora é o ${button.placeAfter}. Confira as páginas do Companion e do D200 que disparam este painel.`,
  /** restoreEvent of a dismissed event past its rule's maximum wait. */
  /** showEvent, or "Tomar" on a Prévia, of a Super Chat no person approved (BAJAOVRLAY-35). */
  superChatNotApproved: 'Super Chat ainda não aprovado',
  /** approveEvent of an event that is not a Super Chat. */
  onlyASuperChatIsApproved: 'Só um Super Chat é aprovado; os outros eventos vão direto para o ar.',
  /** approveEvent of a Super Chat that is not pending: "Este Super Chat não espera aprovação: já foi aprovado." */
  superChatNotPending: (status: InboxEventStatus) =>
    `Este Super Chat não espera aprovação: ${ptBREventErrors.whatItIsInstead[status]}.`,
  /** dismissEvent or restoreEvent sent by Dados for a race event. */
  dataRoleTriagesOnlySuperChats:
    'O papel Dados só descarta e restaura Super Chats; os eventos da prova são do Produtor.',
  /** Dados's "Mostrar de novo" on a Super Chat already shown or expired (BAJAOVRLAY-67). */
  dataRoleRestoresOnlyDiscardedSuperChats:
    'O papel Dados só traz de volta um Super Chat descartado; mostrar de novo é do Produtor.',
  eventTooOldToRestore:
    'Este evento passou da espera máxima da regra e não pode mais ser restaurado.',
  /**
   * What an event that cannot be restored is instead, by its status. `dismissed`, `shown`
   * and `expired` are never read (those are restored, not refused); they are here because
   * the type asks for every status, so a new one cannot be forgotten.
   */
  whatItIsInstead: {
    pending: 'está esperando',
    approved: 'já foi aprovado',
    queued: 'está na fila',
    onAir: 'está no ar',
    shown: 'já foi exibido',
    dismissed: 'foi descartado',
    expired: 'expirou',
  } satisfies Record<InboxEventStatus, string>,
  /** Why an event is not waiting any more, by its status. */
  whyNotWaiting: {
    pending: 'ainda espera',
    approved: 'foi aprovado',
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
