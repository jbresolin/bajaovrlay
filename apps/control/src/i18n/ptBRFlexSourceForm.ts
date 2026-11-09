/**
 * pt-BR catalog, flex source form part: the "HTTP/JSON (flexível)" form of the "Fontes de
 * dados" page (features/dataSources/flexSource), with its requests, its mappings, the
 * "Testar" panel and "Importar / Exportar configuração". ptBRDataSources.ts makes it
 * `ptBR.dataSources.flexForm`. The shapes' names, the canonical fields' labels and the
 * transforms' labels come from the shared catalogs, which the server shows too.
 */
import { ptBRFlexMappingOptions } from './ptBRFlexMappingOptions';

export const ptBRFlexSourceForm = {
  // The requests: one block per GET the source makes at every poll.
  requestsTitle: 'Requisições',
  requestRegionLabel: (requestNumber: number) => `Requisição ${requestNumber}`,
  addRequestButton: '+ Requisição',
  removeRequestButton: 'Remover requisição',
  requestFields: {
    requestId: 'Nome da requisição',
    url: 'Endereço (URL)',
  },
  // Examples shown in the empty fields: a short name, and an address on the event LAN.
  requestIdPlaceholder: 'classificacao',
  urlPlaceholder: 'http://192.168.0.20:8080/classificacao',
  headersTitle: 'Cabeçalhos',
  queryParametersTitle: 'Parâmetros da URL',
  // A request fetched less often than the source is polled (BAJAOVRLAY-53).
  refreshEverySeconds: 'Atualizar a cada (s)',
  refreshEverySecondsHint:
    'Vazio: a cada leitura. Para uma lista que muda pouco, como as equipes: de 60 a 3600 s.',
  addHeaderButton: '+ Cabeçalho',
  addQueryParameterButton: '+ Parâmetro',
  // One header or query parameter row: its name, then a value typed here or the name of
  // an environment variable the server reads (for a token, which never enters the page).
  nameAndValue: {
    name: (rowNumber: number) => `Nome ${rowNumber}`,
    valueKind: (rowNumber: number) => `Tipo do valor ${rowNumber}`,
    valueKinds: {
      value: 'Valor',
      environment: 'Variável de ambiente',
    },
    value: (rowNumber: number) => `Valor ${rowNumber}`,
    environmentVariable: (rowNumber: number) => `Variável ${rowNumber}`,
    removeButton: (rowNumber: number) => `Remover ${rowNumber}`,
  },
  // The server sends a variable's value only to hosts on its BAJAOVRLAY_SOURCE_ALLOWED_HOSTS
  // (gate 2 on PR #17), so the hint says so before the first poll does.
  environmentVariableHint:
    'Para um token: só variáveis BAJAOVRLAY_SOURCE_…, definidas no servidor, e só para endereços em BAJAOVRLAY_SOURCE_ALLOWED_HOSTS. O valor nunca aparece nesta página.',

  // The mappings: one block per canonical shape the source produces. The names are the
  // shared catalog's (ptBRDataShapes), which the server's problem lines use too.
  mappingsTitle: 'Mapeamentos',
  shapeNames: {
    session: 'Sessão',
    positions: 'Posições',
    standings: 'Pontuação',
    incidents: 'Incidentes',
    brackets: 'Chaves',
    // Never offered (mappableShapeKeys leaves it out, the shared schema refuses it): only
    // the YouTube source reads Super Chats (BAJAOVRLAY-35). Named so every key has a name.
    superChats: 'Super Chats',
  },
  noMappings: 'Nenhum formato mapeado ainda. Escolha abaixo o que esta fonte produz.',
  addMappingButton: (shapeName: string) => `+ ${shapeName}`,
  mappingRegionLabel: (shapeName: string) => `Mapeamento: ${shapeName}`,
  removeMappingButton: 'Remover mapeamento',
  mappingRequest: 'Requisição lida',
  entriesPath: 'Caminho da lista',
  // An example shown in the empty field: where the list sits in the response.
  entriesPathPlaceholder: 'dados.carros',
  topLevelFieldsTitle: 'Campos do formato',
  entryFieldsTitle: 'Campos de cada item da lista',
  requiredMark: 'obrigatório',
  emptyRowHint: 'Um campo "Não mapeado" fica de fora.',
  mappingOptions: ptBRFlexMappingOptions,
  // One row per canonical field. Each control's name carries the field's label, so a
  // screen reader (and a test) tells "Caminho de Equipe" from "Caminho de Escola".
  fieldRule: {
    sourceKind: (fieldLabel: string) => `Origem de ${fieldLabel}`,
    sourceKinds: {
      none: 'Não mapeado',
      path: 'Caminho',
      constant: 'Valor fixo',
      listOrder: 'Ordem na lista',
      pollMoment: 'Momento da leitura',
      parent: 'Item de fora',
      lookup: 'Consulta',
      column: 'Coluna',
      alternatives: 'Alternativas',
    },
    path: (fieldLabel: string) => `Caminho de ${fieldLabel}`,
    constant: (fieldLabel: string) => `Valor fixo de ${fieldLabel}`,
    parentPath: (fieldLabel: string) => `Caminho no item de fora de ${fieldLabel}`,
    lookupName: (fieldLabel: string) => `Consulta de ${fieldLabel}`,
    lookupPath: (fieldLabel: string) => `Caminho na consulta de ${fieldLabel}`,
    columnHeader: (fieldLabel: string) => `Coluna de ${fieldLabel}`,
    columnPath: (fieldLabel: string) => `Caminho na célula de ${fieldLabel}`,
    transform: (fieldLabel: string) => `Transformação de ${fieldLabel}`,
    noTransform: 'Sem transformação',
  },
  // "Alternativas": the first value present, not empty, wins (BAJAOVRLAY-53).
  alternatives: {
    label: (fieldLabel: string) => `Alternativas de ${fieldLabel}`,
    hint: 'Vale a primeira que tiver um valor (não vazio); um valor fixo só no fim.',
    // "Alternativa 2 de Equipe": each control's name says which alternative and field.
    ofField: (alternativeNumber: number, fieldLabel: string) =>
      `Alternativa ${alternativeNumber} de ${fieldLabel}`,
    sourceKind: (alternativeName: string) => `Origem da ${alternativeName}`,
    path: (alternativeName: string) => `Caminho da ${alternativeName}`,
    constant: (alternativeName: string) => `Valor fixo da ${alternativeName}`,
    lookupName: (alternativeName: string) => `Consulta da ${alternativeName}`,
    columnHeader: (alternativeName: string) => `Coluna da ${alternativeName}`,
    addButton: '+ Alternativa',
    removeButton: (alternativeName: string) => `Remover ${alternativeName}`,
  },
  // The table of mapValues, the one transform with parameters.
  valueTable: {
    label: (fieldLabel: string) => `Tabela de valores de ${fieldLabel}`,
    sourceValue: (rowNumber: number) => `Valor da fonte ${rowNumber}`,
    canonicalValue: (rowNumber: number) => `Vira ${rowNumber}`,
    addRowButton: '+ Linha',
    removeRowButton: (rowNumber: number) => `Remover linha ${rowNumber}`,
    // What a value the table does not list becomes; empty refuses it, as before.
    otherwiseValue: (fieldLabel: string) => `Senão, ${fieldLabel} vira`,
    otherwiseValueHint: 'Vazio: um valor que não está na tabela é recusado.',
  },
  typedValueHint:
    'true, false e números são lidos como tais e o resto como texto; para um texto como 42, escreva "42" com aspas.',

  // The "Testar" panel: nothing in it is saved or sent as a command.
  test: {
    title: 'Testar',
    nothingIsSaved: 'Nada aqui é salvo: só "Salvar fonte" envia a fonte ao servidor.',
    sampleRegionLabel: (requestName: string) => `Exemplo de ${requestName}`,
    unnamedRequest: (requestNumber: number) => `requisição ${requestNumber}`,
    sampleLabel: (requestName: string) => `Resposta de exemplo de ${requestName} (JSON)`,
    fetchButton: 'Buscar da fonte',
    fetchingButton: 'Buscando…',
    fetchedStatus: (status: number) => `A fonte respondeu ${status}.`,
    testButton: 'Testar',
    // Shown in place of a result once the requests, mappings or a sample change after it.
    resultOutdated: 'O mapeamento mudou; teste de novo.',
    problemsTitle: 'Problemas',
    resultTitle: 'Resultado',
    configHasProblems: 'Corrija os campos marcados na configuração antes de testar.',
    sampleMissing: (requestId: string) =>
      `Falta a resposta de exemplo de ${requestId}: busque da fonte ou cole um exemplo.`,
    sampleNotJson: (requestId: string) =>
      `A resposta de exemplo de ${requestId} não é JSON válido.`,
    // The page could not reach our own server (not the source): the server is down or
    // the network dropped.
    serverUnreachable: 'Não consegui falar com o servidor para buscar o exemplo.',
    shapesPassed: 'O mapeamento passou: é isto que a fonte vai produzir.',
    // The answer refused by a mapping's "Recusar a resposta quando": its own sentence.
    refusedByAFlagLabel: 'Resposta recusada',
    // The brackets, which the source detail has no table for: each round and its matches.
    bracketsTitle: 'Chaves',
    bracketsRound: (roundName: string, matchCount: number) =>
      matchCount === 1 ? `${roundName}: 1 disputa` : `${roundName}: ${matchCount} disputas`,
  },

  // "Exportar configuração" and "Importar configuração": how a tested config travels.
  importExport: {
    exportButton: 'Exportar configuração',
    importButton: 'Importar configuração',
    exportedLabel: 'Configuração (JSON para copiar)',
    exportNeedsAValidForm: 'Corrija os campos marcados antes de exportar.',
    importLabel: 'Configuração para importar (JSON)',
    importConfirmButton: 'Importar',
    closeButton: 'Fechar',
    importNotJson: 'O texto colado não é JSON válido.',
    importRefusedTitle: 'A configuração não foi importada:',
    // `path` is where the problem is, written as the JSON's keys: "requests.0.url".
    importProblem: (path: string, message: string) =>
      path === '' ? message : `${path}: ${message}`,
    importedNote: 'Configuração importada. Confira e salve a fonte.',
  },

  // The problems the form's own fields can have, besides the shared schema's sentences.
  fieldErrors: {
    constantNotTextNumberOrBoolean: 'Um valor fixo precisa ser um texto, um número, true ou false.',
    generalProblemsTitle: 'A configuração tem problemas:',
  },
} as const;
