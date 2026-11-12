/**
 * The server's pt-BR refusals of the rundown and item commands, reached as
 * ptBR.rundownCommandErrors; each goes with a stable code, like ptBR.commandErrors. Kept apart
 * from ptBR.ts to keep that file short. A rundown and an item are named by what the operator
 * reads on screen (name, label) whenever the server has it, and by id when the id is all
 * there is because the thing was not found.
 */
export const ptBRRundownCommandErrors = {
  itemNotFound: (itemId: string) => `O item "${itemId}" não existe; ele pode ter sido excluído.`,
  rundownNotFound: (rundownId: string) => `O rundown "${rundownId}" não existe.`,
  itemNotInRundown: (itemLabel: string, rundownName: string) =>
    `O item "${itemLabel}" pertence a outro rundown, não a "${rundownName}".`,
  // moveCursor named a quick-fire panel button: it can never be the rundown's "next".
  itemIsAQuickFireButton: (itemLabel: string, rundownName: string) =>
    `O item "${itemLabel}" é um botão do painel de atalhos, não um item do rundown "${rundownName}".`,
  itemsNotAPermutation: (rundownName: string) =>
    `A nova ordem do rundown "${rundownName}" não confere com os itens dele: ela precisa trazer todos os itens do rundown, cada um uma única vez.`,
  rundownCursorEmpty: (rundownName: string) =>
    `O rundown "${rundownName}" não tem próximo item: o cursor não está em nenhum item. Escolha o próximo item antes de colocar no ar.`,
  // Space pressed on a cursor item that is no longer the server's: another press moved the
  // cursor meanwhile (gate 2 of PR #64). The operator sees the cursor jump and presses again.
  rundownCursorMoved: (rundownName: string, cursorItemLabelNow: string) =>
    `O cursor de "${rundownName}" mudou para "${cursorItemLabelNow}" antes deste Espaço; nada foi tomado. Confira e aperte de novo.`,
  unsupportedFieldKind: (fieldKey: string, fieldKind: string) =>
    `O campo "${fieldKey}" usa um valor do tipo "${fieldKind}", que este servidor não sabe resolver. Preencha o campo com um valor digitado, de uma fonte de dados ou dos cadastros.`,
};
