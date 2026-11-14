import type {
  EventNoticeKind,
  EventRuleMode,
  HeldByThePause,
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
 * the console's "Eventos" tab, the "Eventos" page with its "+ Evento" form, "Regras" and
 * history, the Camadas mark, and the item editor's "Evento" kind of field.
 */
export const ptBREvents = {
  tabName: 'Eventos',
  /** Read with the badge's number: "3 eventos esperando". */
  pendingBadgeLabel: (count: number) =>
    count === 1 ? '1 evento esperando' : `${String(count)} eventos esperando`,
  waitingListLabel: 'Eventos esperando',
  nothingWaiting: 'Nenhum evento esperando.',
  /**
   * A waiting row's age after "Restaurar" or "Mostrar de novo" (gate 2 of PR #58), read
   * with the relative time from the latest restore: "trazido de volta há 3 min".
   */
  broughtBackAgo: (relativeTime: string) => `trazido de volta ${relativeTime}`,
  /**
   * Why an event whose rule says auto waits for the operator: "Pausar gatilhos" held it
   * (BAJAOVRLAY-73), on its waiting row. Short on purpose: it sits in a narrow badge.
   */
  heldByThePause: {
    arrivedWhilePaused: 'chegou durante a pausa',
    queuedWhenPaused: 'na fila ao pausar',
  } satisfies Record<HeldByThePause, string>,
  /** The console tab's way to the review page, which opens in a new tab. */
  openReviewPageLink: 'Abrir a página de eventos',
  addEventButton: '+ Evento',
  rulesButton: 'Regras',
  soundSwitchLabel: 'Som de eventos',
  /** Why a take of an item filled by an event is off, everywhere on the page. */
  takeOfTemplateItemOff: 'Este item é preenchido por um evento: ele entra no ar pela aba Eventos.',
  /** Why "Prévia" and "No ar" are off for an event whose rule has no item. */
  ruleWithoutItemReason: 'A regra deste tipo de evento não tem item. Escolha um em Regras.',
  previewButton: 'Prévia',
  showButton: 'No ar',
  dismissButton: 'Descartar',
  /** A Super Chat's moderation (BAJAOVRLAY-35): Dados, or the Produtor, approves it. */
  approveButton: 'Aprovar',
  /** The hint and the button that opens the Super Chats waiting: "3 aguardando aprovação". */
  superChatsAwaitingApproval: (count: number) => `${String(count)} aguardando aprovação`,
  superChatsAwaitingApprovalListLabel: 'Super Chats aguardando aprovação',
  /** A Super Chat paid without a message: the row says so instead of an empty line. */
  superChatWithoutMessage: 'Sem mensagem',
  /** Why Dados's "Descartar" is off on any event but a Super Chat. */
  dataRoleTriagesOnlySuperChats: 'O papel Dados só pode descartar e restaurar Super Chats.',
  /** Dados's "Mostrar de novo" on a Super Chat shown or expired (BAJAOVRLAY-67). */
  dataRoleRestoresOnlyDiscardedSuperChats:
    'O papel Dados só traz de volta um Super Chat descartado; mostrar de novo é do Produtor.',
  /** Under the console's waiting events: what was dismissed in the last 30 s. */
  recentlyDismissedListLabel: 'Descartados agora há pouco',
  /** "Penalidade · carro 47" on a recently dismissed event's row. */
  recentlyDismissedText: (kindWord: string, subject: string) => `${kindWord} · ${subject}`,
  /** Who an event is about: "carro 47", or a Super Chat's viewer and amount. */
  carSubject: (carNumber: number) => `carro ${String(carNumber)}`,
  /** A notice typed about no car, "Sem equipe (aviso geral)" (BAJAOVRLAY-67). */
  generalNoticeSubject: 'Aviso geral',
  superChatSubject: (authorName: string, amountText: string) => `${authorName} · ${amountText}`,
  undoDismissButton: 'Desfazer',

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
    approved: 'aprovado',
    queued: 'na fila',
    onAir: 'no ar',
    shown: 'exibido',
    dismissed: 'descartado',
    expired: 'expirado',
  } satisfies Record<InboxEventStatus, string>,

  /** Camadas' mark on an instance an event put on air: "evento: penalidade · carro 47". */
  layerMarker: (kindWord: string, subject: string) =>
    subject === ''
      ? `evento: ${kindWord.toLowerCase()}`
      : `evento: ${kindWord.toLowerCase()} · ${subject}`,
  layerMarkerOfAnEventGone: 'evento',

  /** The "Eventos" page (#/eventos): the waiting events, the forms and the history. */
  reviewPage: {
    title: 'Eventos',
    waitingHeading: 'Esperando',
    historyHeading: 'Histórico',
    historyTableLabel: 'Histórico de eventos',
    noEventsYet: 'Nenhum evento ainda.',
    searchLabel: 'Buscar no histórico',
    searchPlaceholder: 'Carro, equipe, motivo, origem…',
    nothingFound: 'Nenhum evento encontrado.',
    columns: {
      time: 'Hora',
      kind: 'Tipo',
      car: 'Carro',
      team: 'Equipe',
      lap: 'Volta',
      details: 'Detalhes',
      origin: 'Origem',
      status: 'Situação',
      actions: 'Ações',
    },
    /** On a dismissed event's row of the history: undo the dismissal. */
    restoreButton: 'Restaurar',
    /** On a shown or expired event's row (BAJAOVRLAY-67): bring it back for "No ar". */
    showAgainButton: 'Mostrar de novo',
    /** The origin of an event typed with "+ Evento", which no source produced. */
    typedOrigin: 'Digitado',
    /** Between the reason, the penalty and the lap time in one cell. */
    detailsSeparator: ' · ',
  },

  /** "+ Evento": an event typed by the operator. */
  manualForm: {
    title: 'Novo evento',
    description:
      'Uma penalidade ou um aviso sobre um carro, ou um aviso geral. Equipe e escola em branco vêm das fontes ou dos cadastros.',
    // The team list (BAJAOVRLAY-67): a search over Cadastros and the teams it finds.
    teamListLabel: 'Equipe dos cadastros',
    teamListPlaceholder: 'Escolha uma equipe',
    teamSearchLabel: 'Buscar equipe',
    teamSearchPlaceholder: 'Número, equipe ou escola',
    teamOption: (carNumber: number, teamName: string, schoolName: string) =>
      `${String(carNumber)} · ${teamName} · ${schoolName}`,
    generalNoticeOption: 'Sem equipe (aviso geral)',
    noTeamsInCadastros: 'Nenhuma equipe nos cadastros; digite os dados',
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
      penaltyWithoutCar:
        'Uma penalidade é sempre dada a um carro: escolha a equipe ou mude o tipo para Aviso.',
    },
  },

  /** "Regras": one rule per kind of event. */
  rules: {
    title: 'Regras de eventos',
    description:
      'Para cada tipo de evento: perguntar ao operador, entrar no ar sozinho ou ignorar, com qual modelo e por quanto tempo.',
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
    // "Trocar" (BAJAOVRLAY-67): the template the rule shows its events with.
    itemLabel: (kindName: string) => `Trocar o modelo de ${kindName}`,
    noItem: 'Nenhum',
    appearsAs: (templateLabel: string) => `Aparece como: ${templateLabel}`,
    noTemplate: 'nenhum modelo',
    editLookButton: 'Editar aparência',
    previewButton: 'Prévia',
    newTemplateGraphicLabel: (kindName: string) => `Gráfico do novo modelo de ${kindName}`,
    newTemplateGraphicPlaceholder: 'Gráfico do novo modelo',
    newTemplateButton: '+ Novo modelo',
    durationLabel: (kindName: string) => `Segundos no ar de ${kindName}`,
    maxAgeLabel: (kindName: string) => `Espera máxima (s) de ${kindName}`,
    noMaxAgePlaceholder: 'sem limite',
    saveButton: 'Salvar',
    savedConfirmation: 'Salvo.',
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
    // BAJAOVRLAY-67: where a template's field comes from, with the kind's sample value.
    fromTheEventWithExample: (pathLabel: string, exampleText: string) =>
      `Do evento › ${pathLabel} · exemplo: ${exampleText}`,
    noExample: '—',
    // The banner of a template: what fills it, worded per kind and joined for several.
    templateBannerName: 'Modelo de evento',
    templateFilledBy: (whatFillsItEach: string[]) =>
      `Modelo de evento: preenchido a ${whatFillsItEach.join(' e a ')}.`,
    templateUsedByNoRule:
      'Modelo de evento: nenhuma regra o usa ainda; escolha-o em "Trocar", nas regras dos eventos.',
    whatFillsATemplateOfKind: {
      newIncident: 'cada ocorrência dos incidentes da fonte (penalidade, advertência ou incidente)',
      fastestLap: 'cada nova volta mais rápida, vinda da fonte',
      leaderChanged: 'cada troca de líder, vinda da fonte',
      manual: 'cada evento digitado em "+ Evento" (penalidade ou aviso)',
      superChat: 'cada Super Chat aprovado',
    } satisfies Record<InboxEventKind, string>,
  },
};
