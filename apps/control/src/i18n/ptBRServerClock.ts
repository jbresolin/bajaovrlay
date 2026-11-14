/**
 * pt-BR texts of the server clock (features/serverClock, BAJAOVRLAY-62): the header's
 * warning and "sem sincronização" chip, "Acertar relógio agora" and its confirm, and what
 * "Verificar servidor" and the menu say the clock follows (BAJAOVRLAY-76). Part of the control page's catalog (ptBR.ts).
 */

/** A difference written as the operator reads it: +12 ms, −1.250 ms. */
function writeDifference(differenceMs: number): string {
  return `${differenceMs > 0 ? '+' : ''}${differenceMs.toLocaleString('pt-BR')} ms`;
}

/** Seconds written as the operator reads them: 2 s, 28.800 s. */
function writeSeconds(seconds: number): string {
  return `${Math.abs(seconds).toLocaleString('pt-BR')} s`;
}

export const ptBRServerClock = {
  // The header, while NTP finds the server clock 2 s or more off real time and something
  // on air counts time, so the server does not step it by itself.
  offRealTimeWarning: (seconds: number) =>
    `Relógio do servidor ${writeSeconds(seconds)} fora da hora certa`,
  // The menu's entry, and why Dados sees it greyed out.
  setNowMenuEntry: 'Acertar relógio agora',
  producerOnlyReason: 'Só o Produtor acerta o relógio: o que conta tempo no ar pula.',
  // The confirm: what would jump on air, and by about how much when the header knows.
  confirmTitle: 'Acertar o relógio do servidor agora?',
  confirmWhatJumps:
    'O relógio de prova e as contagens regressivas no Programa e na Prévia pulam de uma vez para a hora certa.',
  confirmHowFar: (seconds: number) =>
    `O relógio do servidor está ${writeSeconds(seconds)} ${seconds > 0 ? 'atrasado' : 'adiantado'}.`,
  confirmButton: 'Acertar agora',
  cancelButton: 'Cancelar',
  closeButton: 'Fechar',
  closeDialogButton: 'Fechar',
  // What happened, shown in the dialog.
  setting: 'Perguntando a hora certa (NTP, depois HTTPS)…',
  setBy: (steppedByMs: number) =>
    steppedByMs === 0
      ? 'O relógio do servidor já estava na hora certa.'
      : `Relógio acertado: ${(Math.abs(steppedByMs) / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} s ${steppedByMs > 0 ? 'para a frente' : 'para trás'}.`,
  unreachable: 'Não foi possível falar com o servidor; o relógio ficou como estava.',
  // "Verificar servidor", after the version.
  ntpOff: 'NTP desligado: o relógio do servidor segue o da máquina.',
  ntpNotAnsweredYet: 'O NTP ainda não respondeu.',
  // What the server clock follows (BAJAOVRLAY-76), in "Verificar servidor" and at the top
  // of the header's menu: the source, then its last answer's time and difference.
  followingNtp: (serverName: string) => `NTP (${serverName})`,
  followingHttps: (serverName: string) => `HTTPS (${serverName})`,
  followingNothing: 'sem sincronização — hora do computador',
  sourceWithItsLastAnswer: (followed: string, timeOfDay: string, differenceMs: number) =>
    `Relógio: ${followed}, última resposta às ${timeOfDay}, diferença de ${writeDifference(differenceMs)}.`,
  nothingFollowedSinceAnAnswer: (timeOfDay: string, answeredBy: string, differenceMs: number) =>
    `Relógio: sem sincronização — hora do computador; última resposta às ${timeOfDay}, de ${answeredBy}, diferença de ${writeDifference(differenceMs)}.`,
  nothingFollowedNoAnswerEver: 'Relógio: sem sincronização — hora do computador.',
  // The header's chip while neither NTP nor HTTPS has answered for a full poll interval,
  // and its tooltip.
  withoutSyncChip: 'Relógio sem sincronização',
  withoutSyncTooltip: 'Nem NTP nem HTTPS responderam; os relógios usam a hora do computador.',
  lastNtpAnswer: (timeOfDay: string, serverName: string, differenceMs: number) =>
    `Última resposta do NTP às ${timeOfDay} (${serverName}), diferença de ${differenceMs > 0 ? '+' : ''}${differenceMs.toLocaleString('pt-BR')} ms.`,
};
