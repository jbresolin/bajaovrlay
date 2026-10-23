/**
 * The control page's words for the event inbox (BAJAOVRLAY-44), reached as `ptBR.events`:
 * the item editor's "Evento" kind of field.
 */
export const ptBREvents = {
  /** The item editor's "Evento": a field filled by the event the item shows. */
  editor: {
    pathLabel: (fieldLabel: string) => `O que ${fieldLabel} lê do evento`,
    pathPlaceholder: 'Escolha o campo do evento',
    pathMissing: (fieldLabel: string) => `Escolha o que "${fieldLabel}" lê do evento.`,
    filledByTheEventNote:
      'Preenchido pelo evento que este item exibe. Um item assim só entra no ar pela aba Eventos.',
  },
};
