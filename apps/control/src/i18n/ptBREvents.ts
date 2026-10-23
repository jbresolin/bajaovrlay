import type {
  EventNoticeKind,
  EventRuleMode,
  InboxEventKind,
  InboxEventStatus,
} from '@bajaovrlay/shared';

/** What an event is, in a word, by what its notice says it is. */
const noticeKindWords: Record<EventNoticeKind, string> = {
  penalty: 'Penalidade',
  warning: 'Advertência',
  incident: 'Incidente',
  notice: 'Aviso',
};

/**
 * The control page's words for the event inbox (BAJAOVRLAY-44), reached as `ptBR.events`:
 * the "Eventos" tab, its "+ Evento" form and "Regras", the Camadas mark, and the item
 * editor's "Evento" kind of field.
 */
export const ptBREvents = {
  tabName: 'Eventos',
  /** Read with the badge's number: "3 eventos esperando". */
  pendingBadgeLabel: (count: number) =>
    count === 1 ? '1 evento esperando' : `${String(count)} eventos esperando`,
  waitingListLabel: 'Eventos esperando',
  finishedListLabel: 'Eventos encerrados',
  nothingWaiting: 'Nenhum evento esperando.',
  addEventButton: '+ Evento',
  rulesButton: 'Regras',
  soundSwitchLabel: 'Som de eventos',
  previewButton: 'Prévia',
  showButton: 'No ar',
  dismissButton: 'Descartar',

  noticeKindWords,
  /** What an event is, in a word, for the kinds whose notice does not say it. */
  kindWords: {
    fastestLap: 'Volta mais rápida',
    leaderChanged: 'Mudança de líder',
    superChat: 'Super Chat',
  },
  /** An event's status as its row says it (a pending one says nothing). */
  statusWords: {
    pending: 'esperando',
    queued: 'na fila',
    onAir: 'no ar',
    shown: 'exibido',
    dismissed: 'descartado',
    expired: 'expirado',
  } satisfies Record<InboxEventStatus, string>,

  /** Camadas' mark on an instance an event put on air: "evento: penalidade · carro 47". */
  layerMarker: (kindWord: string, carNumber: number) =>
    `evento: ${kindWord.toLowerCase()} · carro ${String(carNumber)}`,
  layerMarkerOfAnEventGone: 'evento',

  /** "+ Evento": an event typed by the operator. */
  manualForm: {
    title: 'Novo evento',
    description:
      'Uma penalidade ou um aviso sobre um carro. Equipe e escola em branco vêm das fontes.',
    kindLabel: 'Tipo',
    kindOptions: { penalty: 'Penalidade', notice: 'Aviso' },
    carLabel: 'Carro',
    teamLabel: 'Equipe',
    schoolLabel: 'Escola',
    reasonLabel: 'Motivo',
    penaltyLabel: 'Punição',
    penaltyPlaceholder: '+30 segundos',
    createButton: 'Criar evento',
    cancelButton: 'Cancelar',
    closeButton: 'Fechar',
    problems: {
      carNumber: 'Informe o número do carro, um número inteiro.',
      reason: 'Informe o motivo.',
    },
  },

  /** "Regras": one rule per kind of event. */
  rules: {
    title: 'Regras de eventos',
    description:
      'Para cada tipo de evento: perguntar ao operador, entrar no ar sozinho ou ignorar, com qual item e por quanto tempo.',
    kindNames: {
      newIncident: 'Incidente',
      fastestLap: 'Volta mais rápida',
      leaderChanged: 'Mudança de líder',
      manual: 'Evento digitado',
      superChat: 'Super Chat',
    } satisfies Record<InboxEventKind, string>,
    modeLabel: (kindName: string) => `Modo de ${kindName}`,
    modes: {
      ask: 'Perguntar',
      auto: 'Automático',
      ignore: 'Ignorar',
    } satisfies Record<EventRuleMode, string>,
    itemLabel: (kindName: string) => `Item de ${kindName}`,
    noItem: 'Nenhum',
    durationLabel: (kindName: string) => `Segundos no ar de ${kindName}`,
    maxAgeLabel: (kindName: string) => `Espera máxima (s) de ${kindName}`,
    noMaxAgePlaceholder: 'sem limite',
    saveButton: 'Salvar',
    closeButton: 'Fechar',
    superChatExplanation:
      'Super Chat nunca entra no ar sozinho: o conteúdo de um espectador sempre espera aprovação.',
    problems: {
      duration: 'Informe os segundos no ar, de 1 a 3600.',
      maxAge: 'Informe a espera máxima em segundos, de 1 a 3600, ou deixe em branco.',
    },
  },

  /** The item editor's "Evento": a field filled by the event the item shows. */
  editor: {
    pathLabel: (fieldLabel: string) => `O que ${fieldLabel} lê do evento`,
    pathPlaceholder: 'Escolha o campo do evento',
    pathMissing: (fieldLabel: string) => `Escolha o que "${fieldLabel}" lê do evento.`,
    filledByTheEventNote:
      'Preenchido pelo evento que este item exibe. Um item assim só entra no ar pela aba Eventos.',
  },
};
