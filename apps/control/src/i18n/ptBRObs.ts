/**
 * The control page's pt-BR texts about OBS (BAJAOVRLAY-27), reached as ptBR.obs: the tally
 * in the header (features/obs/ObsTally.tsx). The macro editor's scene step has its texts
 * with the editor's, in ptBRQuickFire.ts.
 */
export const ptBRObs = {
  tally: {
    label: 'OBS',
    programScene: (sceneName: string) => `Programa: ${sceneName}`,
    previewScene: (sceneName: string) => `Prévia: ${sceneName}`,
    // Connected but OBS named no scene: never expected, said plainly rather than hidden.
    noScene: '—',
    // What the tally says instead of a scene while the server is not connected to OBS.
    stateWords: {
      desligado: 'não configurado',
      conectando: 'Conectando…',
      conectado: 'Conectado',
      erro: 'Sem conexão',
    },
    // The hover.
    notConfiguredHint: 'Defina BAJAOVRLAY_OBS_URL no servidor para ligar o controle do OBS.',
    addressLine: (address: string) => `Endereço: ${address}`,
    lastErrorLine: (lastError: string) => `Último erro: ${lastError}`,
  },
} as const;
