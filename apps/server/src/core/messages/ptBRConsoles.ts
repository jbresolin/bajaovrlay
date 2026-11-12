import type { OperatorRole } from '@bajaovrlay/shared';

/**
 * The server's pt-BR sentences about two consoles on one layer (BAJAOVRLAY-69), imported
 * directly by the refusals that use them (core/store/consoles/, previewRefusals.ts), so
 * ptBR.ts stays short (gate 2 of PR #64). A refusal reads:
 * Outra mesa (Produtor) tomou "Tarja — capitã da UFPR" na camada "Tarja" há 0,8 s; sua
 * tomada de "Tarja — chefe da UFSC" não foi feita.
 * The names passed in are bare; the quotes are added here.
 */
export const ptBRConsoleErrors = {
  /** The role of the other console, as the login page names it. */
  roleNames: { produtor: 'Produtor', dados: 'Dados' } satisfies Record<OperatorRole, string>,
  /** "Outra mesa (Produtor)", or "Outra mesa" when that console had no login. */
  otherConsole: (roleName: string | undefined) =>
    roleName === undefined ? 'Outra mesa' : `Outra mesa (${roleName})`,
  /** What the other console did to the layer: put something on it, or emptied it. */
  otherConsoleTook: (whatWasTaken: string, layerName: string) =>
    `tomou "${whatWasTaken}" na camada "${layerName}"`,
  otherConsoleCleared: (layerName: string) => `limpou a camada "${layerName}"`,
  /** How long ago, in seconds with one decimal and a comma: "há 0,8 s". */
  howLongAgo: (secondsWithOneDecimal: string) => `há ${secondsWithOneDecimal} s`,
  /** What of this console was not done: a take of an item, or the clear "Tomar tudo" had marked. */
  yourTakeOf: (itemLabel: string) => `sua tomada de "${itemLabel}" não foi feita`,
  yourClear: 'sua limpeza desta camada não foi feita',
  /** The whole sentence, from its four parts. */
  layerChangedByAnotherConsole: (parts: {
    otherConsole: string;
    whatTheOtherConsoleDid: string;
    howLongAgo: string;
    whatWasNotDone: string;
  }) =>
    `${parts.otherConsole} ${parts.whatTheOtherConsoleDid} ${parts.howLongAgo}; ${parts.whatWasNotDone}.`,
  /** "Tomar tudo" with every layer refused this way: the sentences of each, one after another. */
  takeAllRefusedOnEveryLayer: (sentencesOfEachLayer: string[]) =>
    `Tomar tudo não foi feito: ${sentencesOfEachLayer.join(' ')}`,
};
