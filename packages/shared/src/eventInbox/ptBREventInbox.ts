/**
 * The pt-BR texts of the event inbox's shared schemas: why a rule or a command was
 * refused. The server and the control page show them as they are.
 */
export const ptBREventInbox = {
  /** The payload's fields as the item editor's "Evento" offers them. */
  payloadPathLabels: {
    carNumber: 'Carro',
    teamName: 'Equipe',
    schoolName: 'Escola',
    noticeKind: 'Tipo de aviso',
    reason: 'Motivo',
    penaltyText: 'Punição',
    lapNumber: 'Volta',
    lapTimeMs: 'Tempo da volta (ms)',
    lapTimeText: 'Tempo da volta (texto)',
  },
  fieldReasons: {
    pathDoesNotFit: (pathLabel: string) =>
      `o campo do evento "${pathLabel}" não cabe neste campo do gráfico.`,
  },
  ruleReasons: {
    superChatNeverAuto:
      'Super Chat nunca entra no ar sozinho: o conteúdo de um espectador sempre espera aprovação.',
    manualNeverIgnored: 'Um evento digitado pelo operador não pode ser ignorado.',
  },
};
