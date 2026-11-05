/**
 * pt-BR catalog, history part (features/history, BAJAOVRLAY-30): the "Histórico" page,
 * `#/historico`, which reads back every change of the show in plain pt-BR. The sentences
 * of the rows themselves come from @bajaovrlay/shared (eventLogReading), which the server
 * also uses to filter older pages. Kept in a file of its own; ptBR.ts makes it
 * `ptBR.history`.
 */
export const ptBRHistory = {
  title: 'Histórico',
  intro:
    'Tudo o que mudou no show, do mais novo ao mais antigo. As linhas novas aparecem sozinhas no topo.',
  tableLabel: 'Histórico de comandos',
  columns: { time: 'Hora', who: 'Quem', whatHappened: 'O que aconteceu' },
  // The filters above the table; "Todos"/"Todas" is a filter left open.
  filters: {
    whoLabel: 'Quem',
    groupLabel: 'Tipo de comando',
    layerLabel: 'Camada',
    onlyRefusalsLabel: 'Só recusas',
    textLabel: 'Buscar no texto',
    textPlaceholder: 'por exemplo: Tarja, Limpou, Ana Souza',
    everyone: 'Todos',
    everyGroup: 'Todos',
    everyLayer: 'Todas',
    // A layer of an output other than program, as the layer list names it.
    layerOfOutput: (layerName: string, outputName: string) => `${layerName} (${outputName})`,
  },
  loadMoreButton: 'Carregar mais',
  loadingOlder: 'Carregando…',
  olderPageFailed: 'Não foi possível carregar as linhas mais antigas. Tente de novo.',
  nothingYet: 'Nenhum comando ainda.',
  nothingFound: 'Nenhuma linha com esses filtros.',
  exportCsvButton: 'Exportar CSV',
  // The file "Exportar CSV" hands over: its name and its header, as Cadastros' CSVs.
  csvFileName: 'historico.csv',
  csvHeader: ['Linha', 'Data e hora', 'Quem', 'O que aconteceu', 'Recusado'],
  csvRefusedYes: 'sim',
  csvRefusedNo: 'não',
};
