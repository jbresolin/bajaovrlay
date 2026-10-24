/**
 * Where and when a change was detected: the source whose snapshot changed, and the
 * moment its new snapshot was accepted. Every detector stamps its events with these.
 */
export type EventDetectionMoment = {
  sourceId: string;
  /** In ms since 1970 on the server's clock. */
  detectedAtMs: number;
};
