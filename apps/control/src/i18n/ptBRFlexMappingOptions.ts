/**
 * pt-BR catalog, flex source form part: the options of a mapping block beside its rows
 * (BAJAOVRLAY-53): the list inside each item, the lookups, the table's layout, standings'
 * parts by column, the refusal flag, the gaps switch and the incomplete-match conditions.
 * ptBRFlexSourceForm.ts makes it `ptBR.dataSources.flexForm.mappingOptions`.
 */
export const ptBRFlexMappingOptions = {
  regionLabel: 'Opções do mapeamento',
  nestedEntriesPath: 'Lista dentro de cada item',
  nestedEntriesPathHint:
    'Para uma lista de listas, como fases que têm disputas: cada item da lista de dentro vira um item; "Item de fora" lê a lista de fora.',
  // An example shown in the empty field: the matches inside each round.
  nestedEntriesPathPlaceholder: 'matches',

  lookupsTitle: 'Consultas (listas de outra requisição, por chave)',
  lookupRegionLabel: (lookupNumber: number) => `Consulta ${lookupNumber}`,
  addLookupButton: '+ Consulta',
  removeLookupButton: (lookupNumber: number) => `Remover consulta ${lookupNumber}`,
  lookupFields: {
    lookupName: 'Nome da consulta',
    requestId: 'Requisição da lista',
    listPath: 'Caminho da lista',
    keyPath: 'Chave em cada item da lista',
    entryKeyPath: 'Chave em cada item deste formato',
  },

  tableTitle: 'Tabela de colunas (ler células pelo cabeçalho)',
  tableHint: 'Deixe vazio se a resposta não é uma tabela de colunas e células.',
  tableFields: {
    columnsPath: 'Caminho das colunas',
    headerPath: 'Cabeçalho em cada coluna',
    cellsPath: 'Células em cada item',
  },

  scorePartsTitle: 'Partes da pontuação por coluna',
  scorePartHeaders: 'Cabeçalhos das partes (um por linha)',
  scorePartValuePath: 'Caminho do valor em cada célula',

  refusalTitle: 'Recusar a resposta quando',
  refusalHint:
    'Se o valor no caminho for igual ao valor dado, a leitura falha com a mensagem e o último dado bom fica no ar.',
  refusalFields: {
    path: 'Caminho da recusa',
    equalsText: 'Valor que recusa',
    message: 'Mensagem da recusa',
  },

  workOutGapsFromLaps: 'Calcular as diferenças pelas voltas',
  workOutGapsFromLapsHint:
    'Usa "Última passagem" de cada carro; as diferenças valem a partir da última passagem pela linha.',

  incompleteTitle: 'Disputa incompleta quando',
  incompleteHint:
    'Uma fase com uma disputa incompleta fica de fora, com as fases depois dela; o 3º lugar incompleto sai sozinho.',
  incompleteRegionLabel: (conditionNumber: number) => `Condição ${conditionNumber}`,
  incompleteFields: {
    path: (conditionNumber: number) => `Caminho da condição ${conditionNumber}`,
    valuesText: (conditionNumber: number) =>
      `Valores da condição ${conditionNumber} (separados por vírgula)`,
  },
  addIncompleteConditionButton: '+ Condição',
  removeIncompleteConditionButton: (conditionNumber: number) =>
    `Remover condição ${conditionNumber}`,
} as const;
