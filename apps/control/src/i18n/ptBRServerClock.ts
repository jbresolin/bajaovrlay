/**
 * pt-BR texts of the server clock (features/serverClock, BAJAOVRLAY-62): the header's
 * warning, "Acertar relógio agora" and its confirm, and what "Verificar servidor" says
 * of NTP. Part of the control page's catalog (ptBR.ts).
 */

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
  setting: 'Perguntando a hora certa ao NTP…',
  setBy: (steppedByMs: number) =>
    steppedByMs === 0
      ? 'O relógio do servidor já estava na hora certa.'
      : `Relógio acertado: ${(Math.abs(steppedByMs) / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} s ${steppedByMs > 0 ? 'para a frente' : 'para trás'}.`,
  unreachable: 'Não foi possível falar com o servidor; o relógio ficou como estava.',
  // "Verificar servidor", after the version.
  ntpOff: 'NTP desligado: o relógio do servidor segue o da máquina.',
  ntpNotAnsweredYet: 'O NTP ainda não respondeu.',
  lastNtpAnswer: (timeOfDay: string, serverName: string, differenceMs: number) =>
    `Última resposta do NTP às ${timeOfDay} (${serverName}), diferença de ${differenceMs > 0 ? '+' : ''}${differenceMs.toLocaleString('pt-BR')} ms.`,
};
