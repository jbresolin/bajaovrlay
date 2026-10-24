/**
 * pt-BR catalog: every word the standings put on air (the default title, the column
 * captions, the page line, the marks for an unknown value and a disqualified team), every
 * message they answer a renderer with and every label of the preview page, never written
 * inline elsewhere. The manifest's field titles are in standings.ograf.json, since JSON
 * cannot import. The styles set the board in caps, and the face has no lowercase.
 */

export const ptBR = {
  /** The title when the item gives none (the manifest's default too). */
  defaultTitle: 'CLASSIFICAÇÃO GERAL',
  /** The organiser's mark in the head. */
  logoAlternativeText: 'Baja SAE Brasil',
  columnCaptions: {
    rank: 'POS',
    car: 'Nº',
    team: 'EQUIPE',
    /** The total of the overall table, after the parts. */
    total: 'TOTAL',
    /** The one number of the board in columns (one event, or a total alone). */
    points: 'PONTOS',
  },
  /** The on-air mark for a value the source does not know, and the rank of a disqualified team. */
  emptyMark: '—',
  /** The total of a disqualified team. */
  disqualifiedTotal: 'DESCL.',
  /** The minus sign of a negative score (SEG., PEN.): the typographic one, not the hyphen. */
  minusSign: '−',
  /** The decimal comma of a fractional score ("903,48"). */
  decimalSeparator: ',',
  /** The head's line with several pages: the page, then the rows it shows ("2/3 · 21º A 40º"). */
  pageLine: (
    pageNumber: number,
    pageCount: number,
    firstRowNumber: number,
    lastRowNumber: number,
  ) => `${pageNumber}/${pageCount} · ${firstRowNumber}º A ${lastRowNumber}º`,
  /** The head's line when the whole field fits on one page ("33 EQUIPES"). */
  teamCount: (teamCount: number) => (teamCount === 1 ? '1 EQUIPE' : `${teamCount} EQUIPES`),

  actionProblems: {
    notLoadedYet: 'A classificação ainda não foi carregada (load).',
    alreadyLoaded: 'A classificação já foi carregada (load); crie outra para novos dados.',
    alreadyDisposed: 'A classificação já foi descartada (dispose).',
    invalidPlayStep: 'Passo inválido para playAction: a classificação tem só o passo 0.',
    unknownCustomAction: (actionId: string) =>
      `Ação personalizada desconhecida: "${actionId}". A classificação não tem ações personalizadas.`,
  },

  validationProblems: {
    notAnObject: 'Dados inválidos: era esperado um objeto com os dados da classificação.',
    missingField: (fieldName: string) => `Falta o campo obrigatório "${fieldName}".`,
    unknownField: (fieldName: string) => `Campo desconhecido nos dados: "${fieldName}".`,
    invalidField: (fieldName: string) => `Valor inválido no campo "${fieldName}".`,
  },

  preview: {
    pageTitle: 'Prévia — classificação',
    controlsLabel: 'Controles da prévia',
    playButton: 'Entrar (play)',
    stopButton: 'Sair (stop)',
    nextPageButton: 'Próxima página',
    withPartsButton: 'Geral com partes',
    totalOnlyButton: 'Geral só total',
    perEventButton: 'Por prova (enduro)',
    disqualifyButton: 'Desclassificar o 3º',
    sampleEventLine: '30ª COMPETIÇÃO BAJA SAE BRASIL',
    enduroTitle: 'CLASSIFICAÇÃO · ENDURO',
    unreadableAddressData: 'O parâmetro ?data= do endereço não é um JSON válido.',
    lastAnswer: (actionName: string, statusCode: number, statusMessage: string | undefined) => {
      const statusText = `${actionName}: ${statusCode}`;
      const hasStatusMessage = statusMessage !== undefined && statusMessage !== '';
      if (!hasStatusMessage) {
        return statusText;
      }
      return `${statusText} — ${statusMessage}`;
    },
  },
} as const;
