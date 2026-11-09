import type { InboxEventKind } from '../eventInbox/inboxEvent.js';
import type { ObsConnectionState } from '../obs/obsSlice.js';

/** "1 evento", "2 eventos": the count and the word, singular for exactly one. */
function countWithWord(count: number, singularWord: string, pluralWord: string): string {
  const word = count === 1 ? singularWord : pluralWord;
  return `${String(count)} ${word}`;
}

/**
 * The pt-BR texts of the history page (BAJAOVRLAY-30): who sent a command, the command
 * groups of the filter, and one sentence per command type, in the operator's words and in
 * the past tense. The formatters (sentencesOf*.ts) only pick and fill these; the names they
 * pass in already carry their quotes ("Tarja – Ana Souza") or read "item excluído (…)".
 */
export const ptBREventLogReading = {
  /** Who sent the command, as the "Quem" column and filter read it. */
  actorKindLabels: {
    produtor: 'Produtor',
    dados: 'Dados',
    operador: 'Operador',
    api: 'API',
    gatilho: 'Gatilho',
    macro: 'Macro',
    fonte: 'Fonte',
    sistema: 'Sistema',
  },
  /** "Produtor · Mesa 1": a logged-in operator, by role and station (BAJAOVRLAY-29). */
  roleAtStationLabel: (roleLabel: string, station: string) => `${roleLabel} · ${station}`,
  /** "API · companion": a device of the command API, by its token's name. */
  apiDeviceLabel: (deviceName: string) => `API · ${deviceName}`,
  commandGroupLabels: {
    takesAndClears: 'Tomadas e limpezas',
    previews: 'Prévias',
    itemsAndRundown: 'Itens e rundown',
    sourcesAndData: 'Fontes e dados',
    settings: 'Configurações',
  },

  /** How a thing is named in a sentence, and how it reads once it is gone. */
  names: {
    quoted: (text: string) => `"${text}"`,
    itemGone: (itemId: string) => `item excluído (${itemId})`,
    macroGone: (macroId: string) => `macro excluída (${macroId})`,
    sourceGone: (sourceId: string) => `fonte excluída (${sourceId})`,
    /** A poll so malformed it did not even name its source. */
    unnamedSource: 'sem nome',
    panelGone: (panelId: string) => `painel excluído (${panelId})`,
    rundownGone: (rundownId: string) => `rundown excluído (${rundownId})`,
    eventGone: (eventId: string) => `evento fora da caixa (${eventId})`,
    instanceGone: (instanceId: string) => `um gráfico que já saiu do ar (${instanceId})`,
    triggerGone: (triggerId: string) => `gatilho excluído (${triggerId})`,
    /** "o disparo do gatilho "Entrou no box"": a firing, by the trigger it was then. */
    firingOfTrigger: (triggerName: string) => `o disparo do gatilho ${triggerName}`,
    /** The slice keeps the newest 50 firings, in memory only; an older one is gone. */
    firingGone: (firingId: string) => `um disparo que já saiu da lista (${firingId})`,
    /** "Tarja (Programa)": the layer's name and its output's name. */
    layerOnOutput: (layerName: string, outputName: string) => `${layerName} (${outputName})`,
    /** "volta mais rápida do carro 31". */
    eventOfCar: (kindLabel: string, carNumber: number) =>
      `${kindLabel} do carro ${String(carNumber)}`,
    /** "Super Chat de Torcida Pequi Off-Road (R$ 20,00)": a viewer's paid message. */
    superChatOfViewer: (authorName: string, amountText: string) =>
      `Super Chat de ${authorName} (${amountText})`,
    /** An event with no car and no viewer: only a database edited by hand has one. */
    eventWithoutCar: (kindLabel: string) => kindLabel,
    /** ""Tarja – Ana Souza" na camada Tarja (Programa)": what an instance showed. */
    instanceOnLayer: (itemName: string, layerName: string) => `${itemName} na camada ${layerName}`,
    inRundown: (rundownName: string) => `no rundown ${rundownName}`,
    inPanel: (panelName: string) => `no painel ${panelName}`,
    toRundown: (rundownName: string) => `para o rundown ${rundownName}`,
    toPanel: (panelName: string) => `para o painel ${panelName}`,
  },
  eventKindLabels: {
    newIncident: 'ocorrência',
    fastestLap: 'volta mais rápida',
    leaderChanged: 'troca de líder',
    manual: 'aviso digitado',
    superChat: 'Super Chat',
  } satisfies Record<InboxEventKind, string>,
  obsConnectionStateLabels: {
    desligado: 'desligada',
    conectando: 'conectando',
    conectado: 'conectada',
    erro: 'com erro',
  } satisfies Record<ObsConnectionState, string>,
  obsTargetLabels: { program: 'Programa', preview: 'Prévia' },

  /** Takes, clears and what happens on air. */
  takesAndClears: {
    tookItem: (itemName: string, layerName: string) => `Tomou ${itemName} na camada ${layerName}`,
    tookItemWithoutLayer: (itemName: string) => `Tomou ${itemName}`,
    tookNext: (rundownName: string) => `Tomou o próximo item do rundown ${rundownName}`,
    tookPreview: (layerName: string) => `Tomou a prévia da camada ${layerName}`,
    tookAllPreviews: 'Tomou tudo o que estava em prévia',
    clearedLayer: (layerName: string) => `Limpou a camada ${layerName}`,
    clearedProgramOfLayer: (layerName: string) => `Tirou do ar a camada ${layerName}`,
    clearedAll: 'Limpou tudo',
    movedToNextStep: (stepNumber: number, layerName: string) =>
      `Passou ao passo ${String(stepNumber)} na camada ${layerName}`,
    undidLayer: (layerName: string) => `Desfez a camada ${layerName}`,
    undidLastChange: 'Desfez a última troca no ar',
    changedOnAir: (instanceName: string, fieldKeys: string[]) =>
      fieldKeys.length === 0
        ? `Alterou no ar ${instanceName}`
        : `Alterou no ar ${instanceName}: ${fieldKeys.join(', ')}`,
    refreshedFromTheSource: (instanceName: string) =>
      `Atualizou com os dados da fonte ${instanceName}`,
    rendererShowed: (instanceName: string) => `O renderizador mostrou ${instanceName}`,
    rendererFailed: (instanceName: string) =>
      `O renderizador não conseguiu mostrar ${instanceName}`,
    rendererFailedWithDetail: (instanceName: string, detail: string) =>
      `O renderizador não conseguiu mostrar ${instanceName}: ${detail}`,
    ranMacro: (macroName: string) => `Rodou a macro ${macroName}`,
    stoppedMacro: (macroName: string) => `Parou a macro ${macroName}`,
    macroMovedToStep: (macroName: string, stepNumber: number) =>
      `A macro ${macroName} passou ao passo ${String(stepNumber)}`,
    macroEnded: (macroName: string) => `A macro ${macroName} terminou`,
    macroStoppedAtStep: (macroName: string, stepNumber: number, reason: string) =>
      `A macro ${macroName} parou no passo ${String(stepNumber)}: ${reason}`,
    showedEvent: (eventName: string) => `Pôs no ar o evento ${eventName}`,
    triggerFired: (triggerName: string) => `O gatilho ${triggerName} disparou`,
    /** "carro: 47, motivo: Queima de largada": the firing's data, in the order it came. */
    triggerFiredWithData: (triggerName: string, dataText: string) =>
      `O gatilho ${triggerName} disparou (${dataText})`,
    ranFiring: (firingName: string) => `Rodou ${firingName}`,
    switchedObsScene: (sceneName: string, targetLabel: string) =>
      `Trocou a cena do OBS para "${sceneName}" (${targetLabel})`,
    obsDidTheSwitch: (switchNumber: number) =>
      `O OBS fez a troca de cena nº ${String(switchNumber)}`,
    obsDidNotDoTheSwitch: (switchNumber: number) =>
      `O OBS não fez a troca de cena nº ${String(switchNumber)}`,
    obsRefusedTheSwitch: (switchNumber: number, reason: string) =>
      `O OBS não fez a troca de cena nº ${String(switchNumber)}: ${reason}`,
  },

  /** The preview output. */
  previews: {
    previewedItem: (itemName: string, layerName: string) =>
      `Pôs em prévia ${itemName} na camada ${layerName}`,
    previewedItemWithoutLayer: (itemName: string) => `Pôs em prévia ${itemName}`,
    automaticMark: ' (prévia automática)',
    forEvent: (eventName: string) => ` para o evento ${eventName}`,
    discardedPreviewOfLayer: (layerName: string) => `Descartou a prévia da camada ${layerName}`,
    discardedEveryPreview: 'Descartou todas as prévias',
    markedLayerToClear: (layerName: string) =>
      `Marcou a camada ${layerName} para limpar na próxima tomada`,
    previewedMacro: (macroName: string) => `Pôs em prévia a macro ${macroName}`,
  },

  /** Items, rundowns, quick-fire panels, macros and triggers being prepared. */
  itemsAndRundown: {
    createdItem: (label: string, homeText: string) => `Criou o item "${label}" ${homeText}`,
    editedItem: (itemName: string) => `Editou o item ${itemName}`,
    deletedItem: (itemName: string) => `Excluiu o item ${itemName}`,
    reorderedRundown: (rundownName: string) => `Reordenou o rundown ${rundownName}`,
    movedCursorToItem: (rundownName: string, itemName: string) =>
      `Moveu o cursor do rundown ${rundownName} para ${itemName}`,
    movedCursorToTheEnd: (rundownName: string) =>
      `Moveu o cursor do rundown ${rundownName} para o fim`,
    movedItemToHome: (itemName: string, homeText: string) => `Moveu ${itemName} ${homeText}`,
    savedOnAirChanges: (instanceName: string) =>
      `Salvou no item o que foi alterado no ar em ${instanceName}`,
    createdPanel: (panelName: string) => `Criou o painel de atalhos "${panelName}"`,
    renamedPanel: (panelName: string, newName: string) =>
      `Renomeou o painel de atalhos ${panelName} para "${newName}"`,
    deletedPanel: (panelName: string) => `Excluiu o painel de atalhos ${panelName}`,
    createdMacro: (macroLabel: string) => `Criou a macro "${macroLabel}"`,
    editedMacro: (macroName: string) => `Editou a macro ${macroName}`,
    deletedMacro: (macroName: string) => `Excluiu a macro ${macroName}`,
    createdTrigger: (triggerName: string) => `Criou o gatilho "${triggerName}"`,
    editedTrigger: (triggerName: string) => `Editou o gatilho ${triggerName}`,
    deletedTrigger: (triggerName: string) => `Excluiu o gatilho ${triggerName}`,
    pausedTriggers: 'Pausou os gatilhos',
    resumedTriggers: 'Retomou os gatilhos',
  },

  /** Data sources, recordings, corrections, the library, images and the event inbox. */
  sourcesAndData: {
    createdSource: (sourceLabel: string) => `Criou a fonte "${sourceLabel}"`,
    editedSource: (sourceName: string) => `Editou a fonte ${sourceName}`,
    deletedSource: (sourceName: string) => `Excluiu a fonte ${sourceName}`,
    turnedSourceOn: (sourceName: string) => `Ligou a fonte ${sourceName}`,
    turnedSourceOff: (sourceName: string) => `Desligou a fonte ${sourceName}`,
    askedForAPollNow: (sourceName: string) => `Pediu uma leitura agora da fonte ${sourceName}`,
    restartedSimulatedRace: (sourceName: string) =>
      `Reiniciou a corrida simulada da fonte ${sourceName}`,
    startedRecording: (sourceName: string) => `Começou a gravar a fonte ${sourceName}`,
    stoppedRecording: (sourceName: string) => `Parou de gravar a fonte ${sourceName}`,
    recordingStoppedByItself: (sourceName: string, failureMessage: string) =>
      `A gravação da fonte ${sourceName} parou: ${failureMessage}`,
    sourceAnswered: (sourceName: string) => `A fonte ${sourceName} respondeu com dados`,
    sourceFailed: (sourceName: string, error: string) => `A fonte ${sourceName} falhou: ${error}`,
    sourceSentAnUnreadablePoll: (sourceName: string) =>
      `A fonte ${sourceName} mandou uma leitura que não pôde ser lida`,
    recordingProgress: (recordingId: string, snapshotCount: number) =>
      `A gravação ${recordingId} tem ${countWithWord(snapshotCount, 'leitura', 'leituras')}`,
    /** "campo "sessionName" da sessão", with no article: the sentence puts "o" or "do". */
    sessionField: (fieldKey: string) => `campo "${fieldKey}" da sessão`,
    carField: (fieldKey: string, carNumber: number) =>
      `campo "${fieldKey}" do carro ${String(carNumber)}`,
    setOverride: (fieldText: string, sourceName: string, valueText: string, reason: string) =>
      `Corrigiu o ${fieldText} na fonte ${sourceName} para ${valueText} (motivo: ${reason})`,
    clearedOverride: (fieldText: string, sourceName: string) =>
      `Desfez a correção do ${fieldText} na fonte ${sourceName}`,
    dismissedEvent: (eventName: string) => `Descartou o evento ${eventName}`,
    restoredEvent: (eventName: string) => `Restaurou o evento ${eventName}`,
    approvedEvent: (eventName: string) => `Aprovou o ${eventName}`,
    dismissedFiring: (firingName: string) => `Descartou ${firingName}`,
    restoredFiring: (firingName: string) => `Restaurou ${firingName}`,
    typedPenalty: (carNumber: number, reason: string) =>
      `Digitou uma penalidade para o carro ${String(carNumber)}: ${reason}`,
    typedNotice: (carNumber: number, reason: string) =>
      `Digitou um aviso para o carro ${String(carNumber)}: ${reason}`,
    changedEventRule: (kindLabel: string) => `Mudou a regra dos eventos de ${kindLabel}`,
    detectedEvents: (eventNames: string[]) =>
      `Detectou ${countWithWord(eventNames.length, 'evento', 'eventos')}: ${eventNames.join(', ')}`,
    savedTeam: (carNumber: number, teamName: string) =>
      `Salvou a equipe ${String(carNumber)} "${teamName}"`,
    savedPerson: (personName: string) => `Salvou a pessoa "${personName}"`,
    savedSponsor: (sponsorName: string) => `Salvou o patrocinador "${sponsorName}"`,
    savedScheduleSlot: (sessionName: string) => `Salvou o horário "${sessionName}"`,
    deletedTeam: (carNumber: number) => `Excluiu a equipe ${String(carNumber)}`,
    deletedPerson: (personId: string) => `Excluiu a pessoa "${personId}"`,
    deletedSponsor: (sponsorId: string) => `Excluiu o patrocinador "${sponsorId}"`,
    deletedScheduleSlot: (slotId: string) => `Excluiu o horário "${slotId}"`,
    importedTeams: (count: number) => `Importou ${countWithWord(count, 'equipe', 'equipes')}`,
    importedPeople: (count: number) => `Importou ${countWithWord(count, 'pessoa', 'pessoas')}`,
    importedSponsors: (count: number) =>
      `Importou ${countWithWord(count, 'patrocinador', 'patrocinadores')}`,
    importedScheduleSlots: (count: number) =>
      `Importou ${countWithWord(count, 'horário', 'horários')}`,
    importedRecords: (count: number) => `Importou ${countWithWord(count, 'registro', 'registros')}`,
    uploadedImage: (fileName: string) => `Enviou a imagem "${fileName}"`,
    deletedImage: (mediaId: string) => `Excluiu a imagem ${mediaId}`,
  },

  /** Outputs, layers and the OBS connection. */
  settings: {
    createdOutput: (outputName: string, outputId: string) =>
      `Criou a saída "${outputName}" (${outputId})`,
    renamedOutput: (outputId: string, newName: string) =>
      `Renomeou a saída ${outputId} para "${newName}"`,
    deletedOutput: (outputName: string) => `Excluiu a saída ${outputName}`,
    reorderedOutputs: 'Reordenou as saídas',
    createdLayer: (layerName: string, outputName: string) =>
      `Criou a camada "${layerName}" na saída ${outputName}`,
    editedLayer: (layerName: string) => `Editou a camada ${layerName}`,
    movedLayerToOutput: (layerName: string, outputName: string) =>
      `Moveu a camada ${layerName} para a saída ${outputName}`,
    reorderedLayers: (outputName: string) => `Reordenou as camadas da saída ${outputName}`,
    deletedLayer: (layerName: string) => `Excluiu a camada ${layerName}`,
    obsConnection: (stateLabel: string) => `A conexão com o OBS ficou ${stateLabel}`,
    backedUp: (fileName: string, sizeText: string) =>
      `Baixou a cópia de segurança ${fileName} (${sizeText})`,
    backedUpWithoutRecordings: (fileName: string, sizeText: string) =>
      `Baixou a cópia de segurança ${fileName} (${sizeText}, sem gravações)`,
  },

  /** A row with no sentence: its type, and why. */
  withoutSentence: {
    unknownCommand: (commandName: string) =>
      `Comando "${commandName}" (sem descrição: este servidor não conhece mais esse comando)`,
    unreadablePayload: (commandName: string) =>
      `Comando "${commandName}" (sem descrição: os dados do comando não puderam ser lidos)`,
  },
  /** "Recusado: Tomou … — O item não existe.": a refused command and its reason. */
  refused: (sentence: string, reason: string) => `Recusado: ${sentence} — ${reason}`,
};
