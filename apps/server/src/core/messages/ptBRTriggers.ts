/**
 * The server's pt-BR messages about triggers (BAJAOVRLAY-48), reached as ptBR.triggers.
 * Kept apart from ptBR.ts to keep that file short. Every refusal names the trigger as the
 * operator named it, never by its id, which is a UUID the page made.
 */
export const ptBRTriggers = {
  triggerNotFound: (triggerId: string) =>
    `O gatilho "${triggerId}" não existe; ele pode ter sido excluído.`,
  triggerIsNotHttp: (triggerName: string) => `O gatilho "${triggerName}" não é um gatilho HTTP.`,
  firingNotFound: 'Esse disparo de gatilho não está mais na lista.',
  firingNotWaiting: (triggerName: string) =>
    `O disparo de "${triggerName}" não está mais esperando: ele já rodou ou foi descartado.`,
  firingNotDismissed: (triggerName: string) =>
    `O disparo de "${triggerName}" não foi descartado; não há o que desfazer.`,
  macroUsedByTriggers: (macroLabel: string, triggerNames: string[]) =>
    `A macro "${macroLabel}" não pode ser excluída. Usada por ${countTriggers(triggerNames.length)}: ${triggerNames.map((name) => `"${name}"`).join(', ')}. Mude ou exclua os gatilhos antes.`,
  /** "Nome: o gatilho não trouxe o dado "nome"." */
  triggerDataNotFilled: (fieldTitle: string, key: string) =>
    `${fieldTitle}: o gatilho não trouxe o dado "${key}".`,
  /** Why a trigger did not fire now, for the HTTP route's 409. */
  notFiredReasons: {
    disabled: (triggerName: string) => `O gatilho "${triggerName}" está desligado.`,
    paused: 'Os gatilhos estão pausados.',
    tooSoon: (triggerName: string, minimumIntervalSeconds: number) =>
      `O gatilho "${triggerName}" disparou há menos de ${String(minimumIntervalSeconds)} s; espere o intervalo mínimo.`,
    unknown: 'O gatilho não disparou; veja o log do servidor.',
    causedByAMacro: (triggerName: string) =>
      `O gatilho "${triggerName}" não dispara por uma mudança feita por uma macro.`,
  },
};

/** "1 gatilho" or "3 gatilhos". */
function countTriggers(count: number): string {
  return count === 1 ? '1 gatilho' : `${String(count)} gatilhos`;
}
