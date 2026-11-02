/**
 * pt-BR catalog, Baja app part (BAJAOVRLAY-54): "Adicionar fonte do app Baja" on Fontes
 * (features/dataSources/bajaAppSource, `ptBR.dataSources.bajaApp`) and "Importar equipes do
 * app Baja" in Cadastros (features/entityLibrary, `ptBR.entityLibrary.bajaApp`). The names
 * of races, tables and tournaments are the API's own, never written here.
 */
export const ptBRBajaAppSource = {
  // The button beside the kinds on "+ Fonte".
  addButton: 'Adicionar fonte do app Baja',
  pickerTitle: 'Nova fonte do app Baja',
  apiAddressLabel: 'Endereço da API',
  apiAddressHint: 'O do app Baja; troque só para uma cópia local da API.',
  eventIdLabel: 'Código do evento',
  eventIdHint: 'Como no app Baja: 26BR, 26SE…',
  readEventButton: 'Ler evento',
  readingEvent: 'Lendo o evento…',
  noEventId: 'Digite o código do evento.',
  eventIdNotAsTheApiWritesIt:
    'O código do evento tem 4 letras maiúsculas ou algarismos, como no app Baja: 26BR.',
  apiAddressNotHttp: 'O endereço da API começa com http:// ou https://.',
  // The three lists of what an event has, each a group of choices.
  racesTitle: 'Corridas com contagem de voltas',
  racesHint: 'Viram sessão e posições (a torre).',
  noRaces: 'Nenhuma corrida com contagem de voltas neste evento.',
  tablesTitle: 'Tabelas de resultado',
  tablesHint: 'Viram classificação.',
  noTables: 'Nenhuma tabela de resultado neste evento.',
  tournamentsTitle: 'Chaveamentos',
  tournamentsHint: 'Viram chaveamento.',
  noTournaments: 'Nenhum chaveamento neste evento.',
  // A result the event's menu leaves out (26BR's Super Prime), read by its id.
  otherResultTitle: 'Fora do menu do evento',
  otherResultChoice: 'Outro resultado (digite o id)',
  otherResultHint:
    'Para um resultado que responde mas não está no menu do evento. A página descobre se é tabela ou chaveamento.',
  resultadoIdLabel: 'Id do resultado',
  resultadoIdHint: (eventId: string) => `${eventId}_SPR`,
  readResultButton: 'Ler resultado',
  readingResult: 'Lendo o resultado…',
  noResultadoId: 'Digite o id do resultado.',
  resultadoIdNotOfTheEvent: (eventId: string) =>
    `O id é o código do evento, "_" e até 3 letras maiúsculas ou algarismos: ${eventId}_SPR.`,
  otherResultIsATable: (name: string) => `Tabela: ${name}`,
  otherResultIsATournament: (name: string) => `Chaveamento: ${name}`,
  // A race chosen.
  acceptSimulatedRace: 'Aceitar corrida simulada',
  acceptSimulatedRaceHint:
    'Para testes e ensaios: sem isto, uma corrida que o app marca como simulação é recusada.',
  // A table chosen: its columns are read before "Continuar".
  readingTable: 'Lendo as colunas da tabela…',
  pointsColumn: (header: string) => `Pontos: coluna "${header}"`,
  partsTitle: 'Partes da pontuação',
  partsHint: 'As colunas mostradas como partes; a proposta é a da tabela geral.',
  continueButton: 'Continuar',
  cancelButton: 'Cancelar',
  // The new source's name: "App Baja — 26BR — Enduro".
  sourceLabel: (eventId: string, name: string) => `App Baja — ${eventId} — ${name}`,
  // The readers' refusals (bajaAppAnswerReading.ts).
  notAnEvent: 'A resposta não é um evento do app Baja.',
  notATable: 'A resposta não é uma tabela de resultado do app Baja.',
  tableWithoutRanking: 'A tabela não diz por qual coluna classifica.',
  tableWithoutPointsColumn:
    'A tabela não tem coluna de pontos: nenhuma coluna é a da classificação.',
  notATournament: 'A resposta não é um chaveamento do app Baja.',
};

/** The Cadastros part: "Importar equipes do app Baja" on the Equipes tab. */
export const ptBRBajaAppTeams = {
  importButton: 'Importar equipes do app Baja',
  eventIdLabel: 'Código do evento no app Baja',
  readTeamsButton: 'Buscar equipes',
  readingTeams: 'Buscando as equipes…',
  // The API's address and the event id are checked as on Fontes (ptBRBajaAppSource).
  apiAddressLabel: 'Endereço da API',
  apiAddressHint: 'O do app Baja; troque só para uma cópia local da API.',
  notATeamsList: 'A resposta não é uma lista de equipes do app Baja.',
  noTeams: 'O app Baja não lista equipes neste evento.',
  // Shown above the preview, which is the CSV import's own.
  teamsRead: (teamCount: number, eventId: string) =>
    `${String(teamCount)} equipes de ${eventId} lidas. Confira a prévia e importe.`,
};
