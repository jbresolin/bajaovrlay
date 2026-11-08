/**
 * pt-BR messages of the operator login (BAJAOVRLAY-29), part of the server's catalog
 * (ptBR.ts). The refusal of a command the Dados role may not send is shared with the
 * control page's tooltips, so it lives in @bajaovrlay/shared (describeWhyTheRoleCannotSend).
 */
export const ptBROperatorLoginErrors = {
  // POST /api/v1/session with a PIN that is not the chosen role's.
  wrongPin: 'PIN errado. Confira o papel escolhido e o PIN.',
  // The fifth wrong PIN in a row from one address, and every try during the wait after it.
  loginLocked: (secondsToWait: number) =>
    `Muitos PINs errados deste computador. Espere ${String(secondsToWait)} s e tente de novo.`,
  // POST /api/v1/session on a server with no PINs set: there is nothing to check.
  loginTurnedOff:
    'Este servidor não pede login: BAJAOVRLAY_PIN_PRODUCER e BAJAOVRLAY_PIN_DATA não estão definidos.',
  // A login body the shared schema refused without a sentence of its own.
  invalidLogin: 'Escolha o papel, digite o PIN e o nome da estação.',
  // A page's read, or the WebSocket, with no session while the login is on.
  sessionRequired: 'Entre com o seu papel e PIN para usar esta página.',
};
