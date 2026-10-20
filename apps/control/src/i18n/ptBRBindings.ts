/**
 * The pt-BR texts of fields read from a data source (BAJAOVRLAY-20), reached as
 * `ptBR.bindings`: the item editor's "Fonte" and "Relógio da fonte" controls, the bound
 * fields of "Edição rápida", the corrections ("Corrigir valor…") and the chips and markers
 * that say a source is late, failing or gone.
 */
export const ptBRBindings = {
  // The controls of a field set to "Fonte" in the item editor.
  editor: {
    // Under the item editor's fields while the item is on air and a source choice changed:
    // "Atualizar no ar" sends typed values only (gate 2 of PR #18).
    sourceChangeAtTheNextTake: 'A mudança de fonte entra no ar na próxima entrada.',
    sourceLabel: (fieldLabel: string) => `Fonte de ${fieldLabel}`,
    pathLabel: (fieldLabel: string) => `O que ${fieldLabel} lê da fonte`,
    carNumberLabel: (fieldLabel: string) => `Número do carro de ${fieldLabel}`,
    whenLabel: (fieldLabel: string) => `Quando ${fieldLabel} lê a fonte`,
    whenOptions: { live: 'Ao vivo', frozen: 'Congelado na entrada' },
    transformLabel: (fieldLabel: string) => `Transformação de ${fieldLabel}`,
    noTransform: 'Nenhuma',
    transformParameterLabel: (fieldLabel: string) => `Parâmetro da transformação de ${fieldLabel}`,
    // The one parameter of each binding transform that takes one.
    transformParameterNames: {
      topN: 'Quantas entradas (1 a 60)',
      shortenSchoolName: 'Tamanho máximo (4 a 60 letras)',
      formatGapAsText: 'Unidade',
    } as Record<string, string>,
    gapUnitOptions: { ms: 'Tempo (ms)', laps: 'Voltas' } as Record<string, string>,
    noSourceYet: 'Nenhuma fonte de dados cadastrada. Crie uma em "Fontes".',
    // The live line under a binding: what the field would get if taken now.
    valueNowLabel: (valueText: string) => `Valor agora: ${valueText}`,
    valueAbsentNow: (problem: string) => `Sem valor agora: ${problem}`,
    cannotReadNow: (problem: string) => `Não dá para ler agora: ${problem}`,
    chooseToSeeTheValue: 'Escolha a fonte e o que ler para ver o valor de agora.',
    listOfEntries: (count: number) =>
      count === 1 ? 'lista com 1 entrada' : `lista com ${count} entradas`,
    clockReading: (timeText: string, isRunning: boolean) =>
      `relógio em ${timeText}, ${isRunning ? 'correndo' : 'parado'}`,
    yes: 'sim',
    no: 'não',
    correctedMark: '(corrigido)',
    // Under the other three clock fields while the time is "Relógio da fonte".
    filledByTheWholeClockNote: 'Preenchido pelo Relógio da fonte.',
  },
  // Why a binding chosen in the form cannot be saved.
  formErrors: {
    sourceMissing: (fieldLabel: string) => `Escolha a fonte de dados de "${fieldLabel}".`,
    pathMissing: (fieldLabel: string) => `Escolha o que "${fieldLabel}" lê da fonte.`,
    carNumberInvalid: (fieldLabel: string) =>
      `Informe em "${fieldLabel}" o número do carro, um inteiro de 1 para cima.`,
    aboutField: (fieldLabel: string, problem: string) => `${fieldLabel}: ${problem}`,
  },
  // The correction dialog ("Corrigir valor…", "Corrigir valor da fonte…").
  overrides: {
    title: 'Corrigir valor da fonte',
    whatIsCorrected: (sourceLabel: string, fieldLabel: string) => `${sourceLabel} › ${fieldLabel}`,
    ofCar: (fieldLabel: string, carNumber: number) => `${fieldLabel} do carro ${carNumber}`,
    valueNow: (valueText: string) => `Na fonte agora: ${valueText}`,
    valueLabel: 'Valor corrigido',
    reasonLabel: 'Motivo (obrigatório)',
    saveButton: 'Salvar correção',
    clearButton: 'Remover correção',
    cancelButton: 'Cancelar',
    closeDialogButton: 'Fechar',
    reasonMissing: 'Escreva o motivo da correção.',
    // The scheduled duration is typed as every clock field is: minutes and seconds.
    durationPlaceholder: 'mm:ss',
    sessionKinds: {
      enduro: 'Enduro',
      acceleration: 'Aceleração',
      speed: 'Velocidade',
      traction: 'Tração',
      suspension: 'Suspensão',
      maneuverability: 'Manobrabilidade',
      other: 'Outra',
    } as Record<string, string>,
    // The badge on a value a correction changed; its tooltip is the reason.
    correctedBadge: 'corrigido',
    // The menu of a value on the "Fontes" page.
    correctMenuItem: 'Corrigir valor…',
    valueButtonLabel: (fieldDescription: string, valueText: string) =>
      `${fieldDescription}: ${valueText}`,
    carFieldDescription: (fieldLabel: string, carNumber: number) =>
      `${fieldLabel} do carro ${carNumber}`,
    // How the session card names its correctable values.
    sessionFieldLabels: {
      eventName: 'Evento',
      sessionName: 'Nome da sessão',
      state: 'Bandeira',
      lapsCompletedByLeader: 'Voltas do líder',
    },
  },
  // Bound fields of what is on air (Edição rápida, Camadas, rundown and shortcuts).
  onAir: {
    whereItReads: (sourceLabel: string, pathLabel: string, isLive: boolean) =>
      `Vinculado: ${sourceLabel} › ${pathLabel} (${isLive ? 'ao vivo' : 'congelado na entrada'})`,
    pathOfCar: (pathLabel: string, carNumber: number) => `${pathLabel}, carro ${carNumber}`,
    deletedSourceName: 'fonte excluída',
    correctButton: 'Corrigir valor da fonte…',
    correctButtonLabel: (fieldLabel: string) => `Corrigir valor da fonte: ${fieldLabel}`,
  },
  // The chips of a Camadas row about the sources its instance reads.
  chips: {
    sourceLate: 'fonte atrasada',
    sourceFailing: 'fonte com erro',
    sourceDeleted: 'fonte excluída',
    valueCorrected: 'valor corrigido',
  },
  // The marker of an item that reads a source, on its rundown row and shortcut button.
  marker: {
    readsASource: 'fonte',
    readsASourceHint: 'Lê dados de uma fonte.',
    cannotTakeNow: 'fonte · não entra agora',
    cannotTakeNowLabel: (reason: string) => `Não entra no ar agora: ${reason}`,
  },
};
