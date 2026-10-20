/**
 * The server's pt-BR messages about bindings (item fields read from a data source),
 * reached as ptBR.bindingErrors. Kept apart from ptBR.ts to keep that file short. Each
 * message starts with the field's title as the item editor shows it ("Bandeira: …"),
 * because an item has many fields and the operator must know which one to fix.
 */
export const ptBRBindingErrors = {
  /** Puts the field's title before a sentence about it: "Bandeira: …". */
  aboutField: (fieldTitle: string, sentence: string) => `${fieldTitle}: ${sentence}`,
  sourceNotFound: (sourceId: string) => `a fonte de dados "${sourceId}" não existe.`,
  // The whole clock fills the other three clock fields; a value stored on one of them
  // would be written over it (a takeTime would stamp the take's moment and the clock jump).
  wholeClockBesideAClockField: (otherFieldTitle: string) =>
    `o Relógio completo preenche também "${otherFieldTitle}", que deve ficar sem valor.`,
  // A guard: the save refuses the whole clock on a graphic without the four clock roles.
  wholeClockWithoutClockFields:
    'o Relógio completo só preenche um gráfico que marca os quatro campos do relógio.',
};
