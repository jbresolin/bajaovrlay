import type { Slices } from '../slices/slices.js';

/**
 * The slices a history sentence reads names from: an item's label and layer, a layer's
 * and output's names, a macro's, a panel's, a rundown's, a source's, an event's car, and
 * what an instance showed. Names are read as they are now, so a row about an item deleted
 * since reads "item excluído (…)".
 */
export type EventLogNames = Pick<
  Slices,
  | 'outputs'
  | 'layers'
  | 'items'
  | 'macros'
  | 'quickFirePanels'
  | 'rundowns'
  | 'dataSources'
  | 'events'
  | 'instances'
>;

/** The names a sentence reads, out of every slice (the control page's or the server's). */
export function buildEventLogNamesFromSlices(slices: Slices): EventLogNames {
  return {
    outputs: slices.outputs,
    layers: slices.layers,
    items: slices.items,
    macros: slices.macros,
    quickFirePanels: slices.quickFirePanels,
    rundowns: slices.rundowns,
    dataSources: slices.dataSources,
    events: slices.events,
    instances: slices.instances,
  };
}
