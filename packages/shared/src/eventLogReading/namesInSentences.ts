import type { ItemHome } from '../rundown/itemHome.js';
import type { EventLogNames } from './eventLogNames.js';
import { ptBREventLogReading } from './ptBREventLogReading.js';

// How each thing a command names reads in a history sentence: by its name now, in quotes,
// or, once it is gone, by its id with a word saying so. Shared by every sentencesOf*.ts.

const nameTexts = ptBREventLogReading.names;

/** An item: ""Tarja – Ana Souza"", or "item excluído (<id>)" when it is gone. */
export function nameItem(itemId: string, names: EventLogNames): string {
  const item = names.items.find((candidate) => candidate.id === itemId);
  if (item === undefined) {
    return nameTexts.itemGone(itemId);
  }
  return nameTexts.quoted(item.label);
}

/** The layer an item is on now, or undefined when the item is gone. */
export function findLayerIdOfItem(itemId: string, names: EventLogNames): string | undefined {
  const item = names.items.find((candidate) => candidate.id === itemId);
  return item?.layerId;
}

/**
 * A layer with its output: "Tarja (Programa)". A layer that is gone reads as its id, and
 * an output that is gone as its id, so the row still says where it happened.
 */
export function nameLayerWithItsOutput(layerId: string, names: EventLogNames): string {
  const layer = names.layers.find((candidate) => candidate.id === layerId);
  if (layer === undefined) {
    return layerId;
  }
  return nameTexts.layerOnOutput(layer.name, nameOutput(layer.outputId, names));
}

/** An output by its name ("Programa"), or by its id when it is gone. */
export function nameOutput(outputId: string, names: EventLogNames): string {
  const output = names.outputs.find((candidate) => candidate.outputId === outputId);
  return output?.name ?? outputId;
}

/** A macro: ""Abertura"", or "macro excluída (<id>)". */
export function nameMacro(macroId: string, names: EventLogNames): string {
  const macro = names.macros.find((candidate) => candidate.id === macroId);
  if (macro === undefined) {
    return nameTexts.macroGone(macroId);
  }
  return nameTexts.quoted(macro.label);
}

/** A data source: ""Simulador — Enduro"", or "fonte excluída (<id>)". */
export function nameDataSource(sourceId: string, names: EventLogNames): string {
  const source = names.dataSources.find((candidate) => candidate.id === sourceId);
  if (source === undefined) {
    return nameTexts.sourceGone(sourceId);
  }
  return nameTexts.quoted(source.label);
}

/** A quick-fire panel: ""Atalhos"", or "painel excluído (<id>)". */
export function nameQuickFirePanel(panelId: string, names: EventLogNames): string {
  const panel = names.quickFirePanels.find((candidate) => candidate.id === panelId);
  if (panel === undefined) {
    return nameTexts.panelGone(panelId);
  }
  return nameTexts.quoted(panel.name);
}

/** A rundown: ""Sessão principal"", or "rundown excluído (<id>)". */
export function nameRundown(rundownId: string, names: EventLogNames): string {
  const rundown = names.rundowns.find((candidate) => candidate.id === rundownId);
  if (rundown === undefined) {
    return nameTexts.rundownGone(rundownId);
  }
  return nameTexts.quoted(rundown.name);
}

/** An inbox event: "volta mais rápida do carro 31", or "evento fora da caixa (<id>)". */
export function nameInboxEvent(eventId: string, names: EventLogNames): string {
  const inboxEvent = names.events.find((candidate) => candidate.eventId === eventId);
  if (inboxEvent === undefined) {
    return nameTexts.eventGone(eventId);
  }
  const kindLabel = ptBREventLogReading.eventKindLabels[inboxEvent.kind];
  return nameTexts.eventOfCar(kindLabel, inboxEvent.payload.carNumber);
}

/**
 * What an instance shows and where: ""Tarja – Ana Souza" na camada Tarja (Programa)". An
 * instance with no item names its graphic; one no longer on any layer reads "um gráfico
 * que já saiu do ar (<id>)", since what it showed is not kept anywhere else.
 */
export function nameInstance(instanceId: string, names: EventLogNames): string {
  const instance = names.instances.find((candidate) => candidate.id === instanceId);
  if (instance === undefined) {
    return nameTexts.instanceGone(instanceId);
  }
  const shownName =
    instance.itemId === undefined
      ? nameTexts.quoted(instance.graphicId)
      : nameItem(instance.itemId, names);
  return nameTexts.instanceOnLayer(shownName, nameLayerWithItsOutput(instance.layerId, names));
}

/** Where an item lives, after a preposition: "no rundown "Sessão principal"". */
export function nameItemHomeAsPlace(home: ItemHome, names: EventLogNames): string {
  if (home.kind === 'rundown') {
    return nameTexts.inRundown(nameRundown(home.rundownId, names));
  }
  return nameTexts.inPanel(nameQuickFirePanel(home.panelId, names));
}

/** Where an item goes: "para o painel "Atalhos"". */
export function nameItemHomeAsDestination(home: ItemHome, names: EventLogNames): string {
  if (home.kind === 'rundown') {
    return nameTexts.toRundown(nameRundown(home.rundownId, names));
  }
  return nameTexts.toPanel(nameQuickFirePanel(home.panelId, names));
}
