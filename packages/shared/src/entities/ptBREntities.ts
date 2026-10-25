/**
 * The pt-BR texts of the entity library that live in shared: the field labels, and the
 * sentences that say why a record was refused. They live here, beside the schemas,
 * because the server, the Cadastros form and the CSV preview all show the same sentence
 * for the same mistake (as ptBRDataShapes.ts does for the shapes). Each sentence starts
 * with the field's label, so a CSV line's reason says which column to fix.
 */
export const ptBREntities = {
  /** Put between the parts of a label: "Equipe › Logo", as the shapes' labels do. */
  labelSeparator: ' › ',

  /** The name of each kind of record, as a tab and a picker name it. */
  entityTypeNames: {
    team: 'Equipe',
    person: 'Pessoa',
    sponsor: 'Patrocinador',
    scheduleSlot: 'Sessão da programação',
  },

  /** The label of every field of a team. */
  teamFieldLabels: {
    carNumber: 'Número do carro',
    teamName: 'Nome da equipe',
    schoolName: 'Escola (sigla)',
    schoolFullName: 'Escola (nome completo)',
    city: 'Cidade',
    state: 'UF',
    logoMediaId: 'Logo',
    carPhotoMediaId: 'Foto do carro',
    logoOnLightPlate: 'Logo sobre placa clara',
  },

  /** The label of every field of a person. */
  personFieldLabels: {
    personId: 'Id',
    name: 'Nome',
    role: 'Função',
    carNumber: 'Carro da equipe',
    photoMediaId: 'Foto',
  },

  /** The label of every field of a sponsor. */
  sponsorFieldLabels: {
    sponsorId: 'Id',
    name: 'Nome',
    tier: 'Cota',
    logoMediaId: 'Logo',
    rollWeight: 'Peso no rodízio',
    logoOnLightPlate: 'Logo sobre placa clara',
  },

  /** The label of every field of a schedule slot. */
  scheduleSlotFieldLabels: {
    slotId: 'Id',
    sessionName: 'Sessão',
    sessionKind: 'Prova',
    startsAtMs: 'Início',
    endsAtMs: 'Fim',
    place: 'Local',
  },

  /** The five sponsor tiers, as the organisers sell them. */
  tierLabels: {
    master: 'Master',
    ouro: 'Ouro',
    prata: 'Prata',
    bronze: 'Bronze',
    apoio: 'Apoio',
  },

  /** What the schedule says about a slot now (never stored; scheduleSlotStatus.ts). */
  scheduleSlotStatusLabels: {
    finished: 'concluída',
    inProgress: 'em andamento',
    upcoming: 'a seguir',
  },

  /** Why a record was refused; each sentence names its field first. */
  recordProblems: {
    required: (fieldLabel: string) => `${fieldLabel}: obrigatório.`,
    tooLong: (fieldLabel: string, maximumLength: number) =>
      `${fieldLabel}: no máximo ${String(maximumLength)} caracteres.`,
    wholeNumberFromOne: (fieldLabel: string) => `${fieldLabel}: um número inteiro a partir de 1.`,
    momentInMilliseconds: (fieldLabel: string) => `${fieldLabel}: um momento válido.`,
    notAMediaId: (fieldLabel: string) => `${fieldLabel}: não é uma imagem enviada ao servidor.`,
    yesOrNo: (fieldLabel: string) => `${fieldLabel}: sim ou não.`,
    unknownState: 'UF: use a sigla de um estado brasileiro (por exemplo PR, SP ou DF).',
    unknownTier: 'Cota: use master, ouro, prata, bronze ou apoio.',
    rollWeightOutOfRange: 'Peso no rodízio: um número inteiro de 1 a 10.',
    unknownSessionKind:
      'Prova: use enduro, acceleration, speed, traction, suspension, maneuverability ou other.',
    endBeforeStart: 'Fim: deve ser depois do início.',
  },

  /**
   * How a record no longer in the library is named, in words and never by its id (gate 2
   * of PR #23): an id is a UUID the page made, which tells the operator nothing.
   */
  missingRecordNames: {
    team: (carNumber: number) => `a equipe do carro ${String(carNumber)}, excluída dos cadastros`,
    person: 'uma pessoa excluída dos cadastros',
    sponsor: 'um patrocinador excluído dos cadastros',
    scheduleSlot: 'uma sessão excluída da programação',
  },

  /** How a refusal or a list of uses names one record. */
  recordDescriptions: {
    team: (carNumber: number, teamName: string) => `Equipe ${String(carNumber)} (${teamName})`,
    person: (name: string, role: string) => `${name} (${role})`,
    sponsor: (name: string) => `Patrocinador ${name}`,
    scheduleSlot: (sessionName: string) => `Programação: ${sessionName}`,
    // Not records, but places an image is used in (gate 2 of PR #23).
    item: (itemLabel: string) => `Item "${itemLabel}"`,
    instanceOnAir: (layerId: string) => `No ar, camada ${layerId}`,
    instanceInPreview: (layerId: string) => `Em prévia, camada ${layerId}`,
  },

  /**
   * Why an entity reference cannot be read or stored. The ones that start in lower case
   * get the field's title put before them by the server: "Título: a equipe do carro 7 …".
   */
  referenceProblems: {
    teamNotFound: (carNumber: number) =>
      `a equipe do carro ${String(carNumber)} não está nos cadastros.`,
    // In words, never by the id: "Nome: lê uma pessoa excluída dos cadastros." (gate 2 of PR #23).
    personNotFound: 'lê uma pessoa excluída dos cadastros.',
    sponsorNotFound: 'lê um patrocinador excluído dos cadastros.',
    scheduleSlotNotFound: 'lê uma sessão excluída da programação.',
    unknownAttribute: (entityTypeName: string, attributeKey: string) =>
      `o cadastro de ${entityTypeName} não tem o campo "${attributeKey}".`,
    attributeAbsent: (recordDescription: string, attributeLabel: string) =>
      `${recordDescription} não tem ${attributeLabel}.`,
    attributeDoesNotFitField: (attributeLabel: string) =>
      `${attributeLabel} não serve para este campo.`,
  },

  /** Why a slice or an import was refused: a key that appears twice. */
  sliceProblems: {
    carListedTwice: (carNumber: number) => `O carro ${String(carNumber)} aparece duas vezes.`,
    idListedTwice: (recordId: string) => `O id "${recordId}" aparece duas vezes.`,
  },
};
