/**
 * pt-BR catalog, the list of texts of the generated form (features/schemaForm,
 * TextListField.tsx, BAJAOVRLAY-23): one text input per line, with add, remove and drag to
 * reorder, first used by the message ticker's messages. A line is named with the
 * manifest's `items.title` ("Mensagem"), passed in as `itemLabel`; only the words around it
 * are here. Kept in a file of its own so ptBR.ts stays readable; ptBR.ts makes it
 * `ptBR.textList`.
 */

/** "Mensagem" as it reads inside a sentence: "Adicionar mensagem", "Remover mensagem 2". */
function writeInsideASentence(itemLabel: string): string {
  return itemLabel.toLocaleLowerCase('pt-BR');
}

export const ptBRTextList = {
  // What a line is called when the manifest's items give no title.
  defaultItemLabel: 'Linha',
  addLineButton: (itemLabel: string) => `Adicionar ${writeInsideASentence(itemLabel)}`,
  // The accessible names of one line's controls, numbered from 1 as the operator counts.
  lineInputLabel: (itemLabel: string, lineNumber: number) => `${itemLabel} ${lineNumber}`,
  removeLineButton: (itemLabel: string, lineNumber: number) =>
    `Remover ${writeInsideASentence(itemLabel)} ${lineNumber}`,
  removeLineSymbol: '×',
  moveLineHandle: (itemLabel: string, lineNumber: number) =>
    `Mover ${writeInsideASentence(itemLabel)} ${lineNumber}`,
  // Shown in place of the lines when the list has none. "Ainda não há" agrees with an
  // item title of either gender ("mensagem", "título"), which "Nenhuma" would not.
  noLines: (itemLabel: string) => `Ainda não há ${writeInsideASentence(itemLabel)}.`,
  // The count under a line with a limit, so the operator sees the room left while typing.
  charactersUsed: (used: number, limit: number) => `${used}/${limit}`,

  // The messages of the form's check, under the list; each names the field or the line.
  errors: {
    tooFewLines: (fieldLabel: string, minimumLines: number) =>
      minimumLines === 1
        ? `O campo "${fieldLabel}" precisa de pelo menos 1 linha.`
        : `O campo "${fieldLabel}" precisa de pelo menos ${minimumLines} linhas.`,
    tooManyLines: (fieldLabel: string, maximumLines: number) =>
      maximumLines === 1
        ? `O campo "${fieldLabel}" pode ter no máximo 1 linha.`
        : `O campo "${fieldLabel}" pode ter no máximo ${maximumLines} linhas.`,
    // A line of spaces, or left empty after "Adicionar": never a text a graphic can show.
    lineBlank: (itemLabel: string, lineNumber: number) =>
      `${itemLabel} ${lineNumber}: está em branco; escreva o texto ou remova a linha.`,
    lineTooShort: (itemLabel: string, lineNumber: number, minimumLength: number) =>
      minimumLength === 1
        ? `${itemLabel} ${lineNumber}: escreva pelo menos 1 caractere.`
        : `${itemLabel} ${lineNumber}: escreva pelo menos ${minimumLength} caracteres.`,
    lineTooLong: (itemLabel: string, lineNumber: number, maximumLength: number, length: number) =>
      `${itemLabel} ${lineNumber}: no máximo ${maximumLength} caracteres (tem ${length}).`,
  },

  // What a screen reader hears while a line is dragged (dnd-kit's own words are English).
  // A line is named by the item title ("Mensagem 2"); the sentences carry no adjective
  // that would have to agree with its gender.
  dragAndDrop: {
    handleRoleDescription: 'linha que pode mudar de posição',
    keyboardInstructions:
      'Para mudar uma linha de posição, pressione Espaço ou Enter, mova com as setas para cima e para baixo e pressione Espaço ou Enter de novo para soltar. Esc cancela.',
    pickedUp: (itemLabel: string, lineNumber: number) => `${itemLabel} ${lineNumber} em movimento.`,
    movedOver: (itemLabel: string, lineNumber: number, otherLineNumber: number) =>
      `${itemLabel} ${lineNumber} sobre a posição ${otherLineNumber}.`,
    overItsOwnPlace: (itemLabel: string, lineNumber: number) =>
      `${itemLabel} ${lineNumber} no lugar de onde saiu.`,
    movedOutsideTheList: (itemLabel: string, lineNumber: number) =>
      `${itemLabel} ${lineNumber} fora da lista.`,
    dropped: (itemLabel: string, lineNumber: number) =>
      `${itemLabel} ${lineNumber} na posição nova.`,
    leftWhereItWas: (itemLabel: string, lineNumber: number) =>
      `${itemLabel} ${lineNumber} continua onde estava.`,
  },
} as const;
