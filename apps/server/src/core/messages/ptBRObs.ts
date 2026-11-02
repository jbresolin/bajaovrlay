/**
 * The server's pt-BR messages about OBS control (BAJAOVRLAY-27), reached as ptBR.obs. Kept
 * apart from ptBR.ts to keep that file short. Each connection error says what to check,
 * and each refusal of a switch names the scene, so the operator knows what to do without
 * asking anyone. OBS 32's own menus are named as its pt-BR interface names them.
 */
export const ptBRObs = {
  // Why the connection is not up, kept as the slice's lastError and shown on hover.
  notAnswering: (address: string) =>
    `O OBS não respondeu em ${address}. Confira se o OBS está aberto e se o servidor WebSocket está ligado (Ferramentas → Configurações do servidor WebSocket).`,
  passwordRefused:
    'O OBS recusou a senha. Confira BAJAOVRLAY_OBS_PASSWORD e a senha em Ferramentas → Configurações do servidor WebSocket, no OBS.',
  passwordMissing: 'O OBS pede senha, e BAJAOVRLAY_OBS_PASSWORD não está definida no servidor.',
  unsupportedVersion:
    'Este OBS não fala o obs-websocket 5. Use o OBS 28 ou mais novo (o OBS 32 já traz o servidor WebSocket).',
  connectionDropped: 'A conexão com o OBS caiu. O servidor tenta de novo a cada 5 s.',
  // Refusals of switchObsScene, each with its stable code.
  notConfigured: 'O OBS não está configurado: defina BAJAOVRLAY_OBS_URL no servidor.',
  notConnected: 'O OBS não está conectado. Veja o motivo passando o mouse sobre "OBS" no topo.',
  sceneNotFound: (sceneName: string) =>
    `O OBS não tem a cena "${sceneName}". Confira o nome no OBS.`,
  studioModeOff:
    'A Prévia do OBS só existe com o Modo Estúdio ligado. Ligue o Modo Estúdio no OBS ou troque a cena do Programa.',
  switchPending: (sceneName: string) =>
    `O OBS ainda não respondeu à troca para a cena "${sceneName}". Tente de novo em instantes.`,
  // OBS's own answer when a switch the server sent did not go through.
  obsRefusedTheSwitch: (sceneName: string, whyInWords: string) =>
    `O OBS recusou a troca para a cena "${sceneName}": ${whyInWords}`,
  obsReasons: {
    sceneGone: 'a cena não existe mais no OBS.',
    studioModeOff: 'o Modo Estúdio foi desligado.',
    other: (obsComment: string) => `"${obsComment}".`,
  },
  noAnswerInTime: (sceneName: string) =>
    `O OBS não respondeu a tempo à troca para a cena "${sceneName}".`,
  droppedBeforeTheAnswer: (sceneName: string) =>
    `A conexão com o OBS caiu antes da resposta à troca para a cena "${sceneName}".`,
};
