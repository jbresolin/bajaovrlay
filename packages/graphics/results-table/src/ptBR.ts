/**
 * pt-BR catalog: every word the results table puts on air (the default title, the fixed
 * column captions, the page line, the mark for a rank the site does not give), the words
 * an item may type to mean "the site's order" or a fixed column, every message the graphic
 * answers a renderer with and every label of the preview page, never written inline
 * elsewhere. The manifest's field titles are in results-table.ograf.json, since JSON cannot
 * import. The styles set the board in caps, and the face has no lowercase.
 */

export const ptBR = {
  /** The title when the item gives none and the source names no table. */
  defaultTitle: 'RESULTADO',
  /** The organiser's mark in the head. */
  logoAlternativeText: 'Baja SAE Brasil',
  /** The three columns every row carries, before the page's own. */
  columnCaptions: {
    rank: 'POS',
    car: 'Nº',
    team: 'EQUIPE',
  },
  /**
   * The names an item may type for those three columns in "Ordenar por", compared without
   * case: the site's own heads ("Pos", "#", "Equipe") and the captions above.
   */
  fixedColumnNames: {
    rank: ['pos', 'posição'],
    car: ['#', 'nº', 'carro'],
    team: ['equipe', 'equipe/escola'],
  },
  /** "Ordenar por" with this (or nothing) keeps the rows in the site's order. */
  siteOrderName: 'Ordem do site',
  /** The rank cell when the site gives no position (spoilers, a page that ranks nobody). */
  emptyRankMark: '–',
  /** Between the two values of one cell ("55.6 / 54.9"); the board shows the first. */
  twoValuesSeparator: ' / ',
  /** The head's line with several pages: the page, then the rows it shows ("2/3 · 21º A 40º"). */
  pageLine: (
    pageNumber: number,
    pageCount: number,
    firstRowNumber: number,
    lastRowNumber: number,
  ) => `${pageNumber}/${pageCount} · ${firstRowNumber}º A ${lastRowNumber}º`,
  /** The head's line when every team fits on one page ("16 EQUIPES"). */
  teamCount: (teamCount: number) => (teamCount === 1 ? '1 EQUIPE' : `${teamCount} EQUIPES`),

  actionProblems: {
    notLoadedYet: 'A tabela de resultado ainda não foi carregada (load).',
    alreadyLoaded: 'A tabela de resultado já foi carregada (load); crie outra para novos dados.',
    alreadyDisposed: 'A tabela de resultado já foi descartada (dispose).',
    invalidPlayStep: 'Passo inválido para playAction: a tabela de resultado tem só o passo 0.',
    unknownCustomAction: (actionId: string) =>
      `Ação personalizada desconhecida: "${actionId}". A tabela de resultado não tem ações personalizadas.`,
  },

  validationProblems: {
    notAnObject: 'Dados inválidos: era esperado um objeto com os dados da tabela de resultado.',
    missingField: (fieldName: string) => `Falta o campo obrigatório "${fieldName}".`,
    unknownField: (fieldName: string) => `Campo desconhecido nos dados: "${fieldName}".`,
    invalidField: (fieldName: string) => `Valor inválido no campo "${fieldName}".`,
  },

  preview: {
    pageTitle: 'Prévia — tabela de resultado',
    controlsLabel: 'Controles da prévia',
    playButton: 'Entrar (play)',
    stopButton: 'Sair (stop)',
    nextPageButton: 'Próxima página',
    spoilersButton: 'Geral com spoilers',
    qualifyingButton: 'Classificatória',
    enduroButton: 'Enduro (2 páginas)',
    sortByBestLapButton: 'Ordenar por melhor volta',
    sampleEventLine: 'ETAPA SUL 2025',
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
