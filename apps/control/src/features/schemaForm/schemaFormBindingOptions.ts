import type { BindingFieldValue, BindingResolution, InboxEventPayload } from '@bajaovrlay/shared';

/**
 * What a panel hands the generated form so its fields can read a data source: the
 * sources to offer, how to read a binding against the page's slices now (the shared
 * resolveBindingAgainstSources, for the "Valor agora" line), and how to be told when
 * what it reads may have changed. Only the item editor hands it; without it no field
 * offers "Fonte".
 */
export type SchemaFormBindingOptions = {
  /** The sources the "Fonte de …" dropdown lists. */
  dataSources: Array<{ id: string; label: string }>;
  /** Reads a binding against the page's slices as they are at the moment of the call. */
  readValueNow: (binding: BindingFieldValue) => BindingResolution;
  /**
   * Calls `onValuesChanged` after every change that may change what readValueNow reads (a
   * poll, a correction, a team), and returns the way to stop. Only "Valor agora" listens
   * (BindingValueNowLine.tsx), so a poll redraws that line and nothing else.
   */
  subscribeToValuesNow: (onValuesChanged: () => void) => () => void;
  /**
   * Set by the item editor on an event template only (BAJAOVRLAY-67): the sample event of
   * the kind it shows, whose values each "Evento" field shows as an example ("Do evento ›
   * Carro · exemplo: 47"). Its presence also offers a car group's fourth way, "Do evento".
   */
  sampleEventPayload?: InboxEventPayload | undefined;
};
