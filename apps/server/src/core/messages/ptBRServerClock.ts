/**
 * pt-BR answers of "Acertar relógio agora" (BAJAOVRLAY-62), part of the server's catalog
 * (ptBR.ts); the control page shows them under the menu.
 */
export const ptBRServerClock = {
  // POST /api/v1/server-clock/set-now on a server started with BAJAOVRLAY_NTP_SERVERS=off.
  ntpOff:
    'O NTP está desligado neste servidor (BAJAOVRLAY_NTP_SERVERS=off): não há hora certa para acertar o relógio.',
  // No NTP server answered: the clock was left as it was.
  noNtpAnswer: 'Nenhum servidor NTP respondeu; o relógio do servidor ficou como estava.',
};
