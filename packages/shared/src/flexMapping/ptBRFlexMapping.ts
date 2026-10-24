/**
 * The pt-BR texts of the flex mapping: the labels of the fields a mapping can fill, the
 * reasons a path or a mapping config is refused, and the problem lines the operator reads
 * when a response does not map. They live in shared, like ptBRTransforms.ts, because the
 * server's poll error and the control page's "Testar" panel show the same lines as they are.
 */
export const ptBRFlexMapping = {
  /** The labels of the fields the shapes' own catalog does not name (it lists what a binding shows). */
  extraFieldLabels: {
    sessionId: 'Identificador da sessão',
    updatedAtMs: 'Momento da atualização',
    position: 'Posição',
    rank: 'Classificação',
    /** A team's parts of the score, sent as a list of `{ label, value }` (BAJAOVRLAY-24). */
    pointsByPart: 'Partes da pontuação (lista de rótulo e valor)',
    isDisqualified: 'Desclassificada',
  },

  /** Why a team's list of score parts could not be read (standingsScorePartLists.ts). */
  scorePartReasons: {
    partsNotAList: 'era esperada uma lista de partes, cada uma com rótulo (label) e valor (value)',
    partNotReadable: (placeInList: number) =>
      `a parte ${placeInList} da lista precisa de um rótulo (label) em texto e de um valor (value) em número`,
  },

  /** Why a path was refused. Each one quotes the whole path the operator wrote. */
  pathReasons: {
    emptyPath: 'O caminho está vazio.',
    emptySegment: (path: string) =>
      `O caminho "${path}" tem um trecho vazio: um ponto no começo, no fim, ou dois pontos seguidos.`,
    indexWithoutKey: (path: string) =>
      `O caminho "${path}" tem um índice sem nome antes dele: escreva como carros[3].`,
    strayClosingBracket: (path: string) => `O caminho "${path}" fecha um colchete que não abriu.`,
    unclosedBracket: (path: string) => `O caminho "${path}" abre um colchete e não fecha.`,
    textAfterIndex: (path: string) =>
      `O caminho "${path}" tem texto logo depois de um índice: separe com um ponto, como carros[3].equipe.`,
    emptyIndex: (path: string) => `O caminho "${path}" tem um índice vazio, [].`,
    negativeIndex: (path: string) =>
      `O caminho "${path}" tem um índice negativo; os índices começam em [0].`,
    indexNotWholeNumber: (path: string) =>
      `O caminho "${path}" tem um índice que não é um número inteiro; curingas e filtros não existem, só índices como [3].`,
    indexTooLarge: (path: string) => `O caminho "${path}" tem um índice grande demais.`,
  },

  /** Why a mapping config was refused. */
  configReasons: {
    mappingListIsEmpty: 'Mapeie pelo menos um formato: Sessão, Posições ou Pontuação.',
    // "mappings" missing, misspelt, or holding something other than a list.
    mappingsNotAList: 'Os mapeamentos ("mappings") precisam ser uma lista, um por formato.',
    unknownKeysInRule: (keys: string[]) => `A regra tem ${describeUnknownKeys(keys)}.`,
    unknownKeysInMapping: (keys: string[]) => `O mapeamento tem ${describeUnknownKeys(keys)}.`,
    shapeMappedTwice: (shapeName: string) =>
      `${shapeName} está mapeada mais de uma vez; cada formato vem de um só mapeamento.`,
    bracketsNotBuilt:
      'Mapear as Chaves ainda não foi construído: o formato das chaves ainda é um rascunho.',
    sessionHasNoList:
      'A Sessão não é uma lista: ela não tem "Caminho da lista" nem campos de cada item.',
    listShapeNeedsEntriesPath: (shapeName: string) =>
      `${shapeName} precisa do "Caminho da lista", o caminho até a lista na resposta.`,
    listShapeNeedsEntryFields: (shapeName: string) =>
      `${shapeName} precisa dos campos de cada item da lista.`,
    unknownTargetField: (shapeName: string, targetField: string) =>
      `"${targetField}" não é um campo que se possa preencher em ${shapeName}.`,
    entryFieldAtTopLevel: (fieldLabel: string) =>
      `"${fieldLabel}" é um campo de cada item da lista, não do formato inteiro.`,
    topLevelFieldInEntry: (fieldLabel: string) =>
      `"${fieldLabel}" é um campo do formato inteiro, não de cada item da lista.`,
    targetFieldTwice: (fieldLabel: string) =>
      `"${fieldLabel}" aparece em mais de uma regra; cada campo tem uma regra só.`,
    ruleNeedsExactlyOneSource: (targetField: string) =>
      `A regra de "${targetField}" precisa de exatamente uma origem: caminho, valor fixo, ordem na lista ou momento da leitura.`,
    transformWithoutPath: (targetField: string) =>
      `A transformação da regra de "${targetField}" só vale para um campo lido por caminho.`,
    parametersWithoutTransform: (targetField: string) =>
      `A regra de "${targetField}" tem parâmetros mas nenhuma transformação.`,
    listOrderOnlyForEntries: (fieldLabel: string) =>
      `"Ordem na lista" só vale para os campos de cada item da lista, não para "${fieldLabel}".`,
  },

  /** The parts of a problem line, which reads "Posições › carro 7 (linha 3) › Última volta: …". */
  problemLines: {
    atShape: (shapeName: string, detail: string) => `${shapeName}: ${detail}`,
    atTopLevelField: (shapeName: string, fieldLabel: string, detail: string) =>
      `${shapeName} › ${fieldLabel}: ${detail}`,
    atEntryField: (shapeName: string, entryLabel: string, fieldLabel: string, detail: string) =>
      `${shapeName} › ${entryLabel} › ${fieldLabel}: ${detail}`,
    entryWithCar: (carNumber: number, lineNumber: number) =>
      `carro ${carNumber} (linha ${lineNumber})`,
    entryWithoutCar: (lineNumber: number) => `linha ${lineNumber}`,
    couldNotReadAtPath: (path: string, reason: string) => `não consegui ler "${path}": ${reason}`,
    noResponseForRequest: (shapeName: string, requestId: string) =>
      `${shapeName}: não há resposta da requisição "${requestId}"`,
    noListAtPath: (shapeName: string, entriesPath: string, requestId: string) =>
      `${shapeName}: não há uma lista em "${entriesPath}" na resposta de ${requestId}`,
    bracketsNotBuilt: (shapeName: string) => `${shapeName}: mapear este formato ainda não existe`,
  },

  /** The poll error: the first problem, then how many more there are. */
  summaryWithMoreProblems: (firstProblem: string, moreProblemCount: number) => {
    const moreProblemsText =
      moreProblemCount === 1 ? 'e mais 1 problema' : `e mais ${moreProblemCount} problemas`;
    return `${firstProblem} (${moreProblemsText})`;
  },
};

/**
 * 'uma chave que não existe: "fromPth"', or the plural for several keys. A function
 * declaration, so the catalog above can call it although it is written below.
 */
function describeUnknownKeys(keys: string[]): string {
  const quotedKeys = keys.map((key) => `"${key}"`).join(', ');
  if (keys.length === 1) {
    return `uma chave que não existe: ${quotedKeys}`;
  }
  return `chaves que não existem: ${quotedKeys}`;
}
