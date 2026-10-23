import type { EntityType } from '@bajaovrlay/shared';

/**
 * The words of the "Cadastros" page (features/entityLibrary, BAJAOVRLAY-19), reached as
 * ptBR.entityLibrary. Kept apart from ptBR.ts to keep that file readable. The labels of a
 * record's fields and the reasons a record is refused come from shared (ptBREntities),
 * because the server and the CSV preview say the same.
 */
export const ptBREntityLibrary = {
  pageTitle: 'Cadastros',
  tabListLabel: 'Tipos de cadastro',
  tabs: {
    team: 'Equipes',
    person: 'Pessoas',
    sponsor: 'Patrocinadores',
    scheduleSlot: 'Programação',
  } satisfies Record<EntityType, string>,
  addButtons: {
    team: '+ Equipe',
    person: '+ Pessoa',
    sponsor: '+ Patrocinador',
    scheduleSlot: '+ Sessão',
  } satisfies Record<EntityType, string>,
  emptyTabs: {
    team: 'Nenhuma equipe cadastrada.',
    person: 'Nenhuma pessoa cadastrada.',
    sponsor: 'Nenhum patrocinador cadastrado.',
    scheduleSlot: 'Nenhuma sessão na programação.',
  } satisfies Record<EntityType, string>,
  tableLabels: {
    team: 'Equipes cadastradas',
    person: 'Pessoas cadastradas',
    sponsor: 'Patrocinadores cadastrados',
    scheduleSlot: 'Sessões da programação',
  } satisfies Record<EntityType, string>,

  // The columns of the four tables.
  columns: {
    carNumber: 'Carro',
    teamName: 'Equipe',
    school: 'Escola',
    place: 'Cidade',
    logo: 'Logo',
    carPhoto: 'Foto do carro',
    name: 'Nome',
    role: 'Função',
    teamOfPerson: 'Carro da equipe',
    photo: 'Foto',
    tier: 'Cota',
    rollWeight: 'Peso',
    startsAt: 'Início',
    endsAt: 'Fim',
    sessionName: 'Sessão',
    sessionKind: 'Prova',
    placeOfSlot: 'Local',
    status: 'Situação',
    actions: 'Ações',
  },
  cityAndState: (city: string, state: string) => `${city} – ${state}`,
  noValue: '—',
  editButton: 'Editar',
  deleteButton: 'Excluir',
  deleteConfirmButton: 'Confirmar: excluir',

  // The form in the side panel.
  form: {
    newTitles: {
      team: 'Nova equipe',
      person: 'Nova pessoa',
      sponsor: 'Novo patrocinador',
      scheduleSlot: 'Nova sessão',
    } satisfies Record<EntityType, string>,
    editTitle: (recordDescription: string) => `Editar: ${recordDescription}`,
    saveButton: 'Salvar',
    savingButton: 'Salvando…',
    cancelButton: 'Cancelar',
    optionalHint: '(opcional)',
    noChoice: 'Escolha…',
    // The first item of an optional dropdown (a team's UF), which empties it.
    leaveEmpty: '— nenhuma —',
    carNumberIsTheKey:
      'O número do carro identifica a equipe. Para outro número, cadastre outra equipe.',
    dateTimeHint: 'No horário deste computador.',
  },

  // An image field of the form.
  image: {
    chooseButton: 'Escolher imagem',
    dropHint: 'ou solte o arquivo aqui',
    replaceButton: 'Trocar',
    removeButton: 'Remover',
    uploading: 'Enviando…',
    acceptedFiles: 'PNG, JPEG, WebP ou SVG, até 5 MB.',
    thumbnailAlt: (fieldLabel: string) => `${fieldLabel} atual`,
    serverUnreachable: 'Não foi possível enviar a imagem: o servidor não respondeu.',
  },

  // CSV import and export of a tab.
  csv: {
    importButton: 'Importar CSV',
    exportButton: 'Exportar CSV',
    exampleButton: 'Baixar exemplo',
    panelTitle: (tabName: string) => `Importar ${tabName.toLowerCase()} de um CSV`,
    pasteLabel: 'Cole o CSV aqui',
    chooseFileLabel: 'ou escolha um arquivo .csv',
    columnsTitle: 'Colunas (separadas por ; ou ,), na primeira linha:',
    requiredMark: '(obrigatória)',
    keyColumnHint: {
      team: 'O carro identifica a equipe: um carro já cadastrado é atualizado.',
      other: 'O id identifica o cadastro: um id já cadastrado é atualizado; sem id, é criado.',
    },
    imagesNotInTheCsv:
      'Imagens não vão no CSV: envie-as no formulário de cada cadastro. Atualizar um cadastro pelo CSV mantém as imagens dele.',
    dateTimeColumnsHint: 'Datas como 14/11/2026 10:00, no horário deste computador.',
    previewTableLabel: 'Prévia da importação',
    lineColumn: 'Linha',
    statusColumn: 'Situação',
    recordColumn: 'Cadastro',
    reasonColumn: 'Motivo',
    statuses: { new: 'novo', update: 'atualiza', error: 'erro' },
    importValidRowsButton: (validRowCount: number) =>
      validRowCount === 1 ? 'Importar 1 linha válida' : `Importar ${validRowCount} linhas válidas`,
    importingButton: 'Importando…',
    // Beside the import button of a tab keyed by id (gate 2 of PR #23).
    linesWithoutIdsCreateNewRecords:
      'Linhas sem id criam cadastros novos a cada importação: o mesmo arquivo importado duas vezes repete cada um. Para atualizar, importe o CSV exportado, que traz os ids.',
    imported: (recordCount: number) =>
      recordCount === 1 ? '1 cadastro importado.' : `${recordCount} cadastros importados.`,
    closeButton: 'Fechar',
    missingColumn: (columnName: string) => `Falta a coluna "${columnName}" na primeira linha.`,
    noRowsAfterTheHeader: 'O CSV não tem linhas depois da primeira (a dos nomes das colunas).',
    tooManyLines: (lineCount: number, mostLines: number) =>
      `O CSV tem ${String(lineCount)} linhas; uma importação leva no máximo ${String(mostLines)}. Divida o arquivo em partes.`,
    fileNames: {
      team: 'equipes',
      person: 'pessoas',
      sponsor: 'patrocinadores',
      scheduleSlot: 'programacao',
    } satisfies Record<EntityType, string>,
    exampleFileSuffix: '-exemplo',
  },

  // "Importar equipes do simulador".
  simulator: {
    importButton: 'Importar equipes do simulador',
    fictionalHint: 'Equipes fictícias, para ensaios.',
    confirmQuestion: (teamCount: number) =>
      `Já há ${String(teamCount)} equipes cadastradas. As do simulador substituem as de mesmo número de carro. Importar mesmo assim?`,
    confirmButton: 'Importar mesmo assim',
    cancelButton: 'Cancelar',
    loading: 'Buscando as equipes do simulador…',
    imported: (teamCount: number) => `${String(teamCount)} equipes fictícias importadas.`,
    serverUnreachable: 'Não foi possível buscar as equipes do simulador: o servidor não respondeu.',
  },

  // The item editor's "Cadastro" kind (features/schemaForm/EntityReferenceControls.tsx).
  editor: {
    entityTypeSelectorLabel: (fieldLabel: string) => `Tipo de cadastro de ${fieldLabel}`,
    searchLabel: (fieldLabel: string) => `Buscar cadastro de ${fieldLabel}`,
    searchPlaceholder: 'Número do carro, equipe ou nome',
    recordSelectorLabel: (fieldLabel: string) => `Cadastro de ${fieldLabel}`,
    attributeSelectorLabel: (fieldLabel: string) => `Campo do cadastro de ${fieldLabel}`,
    noRecordFound: 'Nenhum cadastro encontrado.',
    valueNow: (valueText: string) => `Valor agora: ${valueText}`,
    noValueNow: (reason: string) => `Sem valor agora: ${reason}`,
    imageNowAlt: (fieldLabel: string) => `${fieldLabel} agora`,
    // Each goes after the field's label: "Título: escolha o cadastro."
    formErrors: {
      entityTypeMissing: 'escolha o tipo de cadastro.',
      recordMissing: 'escolha o cadastro.',
      attributeMissing: 'escolha o campo do cadastro.',
    },
  },

  // A field of an instance that reads the library, in "Edição rápida" (gate 2 of PR #23).
  onAir: {
    whereItReads: (recordName: string, attributeLabel: string) =>
      `Cadastro › ${recordName} › ${attributeLabel}`,
    editInTheLibraryButton: 'Editar no cadastro',
    editInTheLibraryButtonLabel: (fieldLabel: string) => `Editar no cadastro: ${fieldLabel}`,
    editInTheLibraryHint: 'Abre o cadastro numa nova aba; o ar acompanha quando você salvar.',
  },

  // The marker of an item that reads the library, on its rundown row and its button.
  marker: {
    readsTheLibrary: 'cadastro',
    readsTheLibraryHint: 'Lê dados dos cadastros.',
    cannotTakeNow: 'cadastro · não entra agora',
    cannotTakeNowLabel: (reason: string) => `Não entra no ar agora: ${reason}`,
  },

  // The images of the media store, above the tabs.
  media: {
    summary: (imageCount: number, sizeText: string) =>
      imageCount === 1 ? `1 imagem · ${sizeText}` : `${String(imageCount)} imagens · ${sizeText}`,
    sizeHint: 'Tamanho da pasta de imagens, que o backup copia.',
    cleanButton: (unusedCount: number) => `Limpar imagens sem uso (${String(unusedCount)})`,
    sizeInMegabytes: (megabytesText: string) => `${megabytesText} MB`,
  },
};
