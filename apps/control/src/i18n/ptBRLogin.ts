/**
 * pt-BR catalog, login part (features/login, BAJAOVRLAY-29): the page "#/entrar", the
 * header's badge of who operates this page, and "Sair". Kept in a file of its own so
 * ptBR.ts stays readable; ptBR.ts makes it `ptBR.login`. The server's refusals of a login
 * arrive worded already (apps/server/src/core/messages/ptBROperatorLogin.ts).
 */
export const ptBRLogin = {
  pageTitle: 'Entrar',
  pageIntro: 'Escolha o seu papel, digite o PIN dele e o nome desta estação.',
  roleLegend: 'Papel',
  roleNames: { produtor: 'Produtor', dados: 'Dados' },
  roleDescriptions: {
    produtor: 'Comanda o show: toma, limpa, prévia e tudo o mais.',
    dados: 'Prepara: cadastros, fontes, itens e rundown. Não muda o que está no ar.',
  },
  pinLabel: 'PIN',
  stationLabel: 'Estação',
  stationPlaceholder: 'Mesa 1',
  logInButton: 'Entrar',
  loggingIn: 'Entrando…',
  problems: {
    emptyPin: 'Digite o PIN do papel escolhido.',
    // Said when the server cannot be reached at all (it is down, or the network is).
    serverUnreachable: 'Sem resposta do servidor. Confira a rede e tente de novo.',
  },
  // The header: who operates this page, or that nobody has to log in.
  roleAtStation: (roleName: string, station: string) => `${roleName} · ${station}`,
  noLoginBadge: 'Sem login',
  noLoginHint:
    'Qualquer computador da rede pode operar: defina BAJAOVRLAY_PIN_PRODUCER e BAJAOVRLAY_PIN_DATA no servidor.',
  logOutButton: 'Sair',
};
