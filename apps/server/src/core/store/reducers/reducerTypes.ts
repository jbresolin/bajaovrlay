import type { CommandError, Slices } from '@bajaovrlay/shared';

/**
 * The slices a command may change. The event log is not among them: the store appends
 * to it itself, after a command that changed one of these slices or was refused. A
 * command that is accepted and changes nothing leaves no entry, and neither does a
 * routine data-source poll (see isLeftOutOfTheEventLog below).
 */
export type SlicesChangedByCommands = Pick<
  Slices,
  | 'layers'
  | 'graphics'
  | 'instances'
  | 'previewClearedLayerIds'
  | 'rundowns'
  | 'items'
  | 'quickFirePanels'
  | 'macros'
  | 'macroRuns'
  | 'dataSources'
  | 'dataSnapshots'
  | 'recordings'
>;

/**
 * Everything a reducer needs that is not pure: made by the store before calling it, so
 * a reducer never reads the clock or generates ids itself.
 */
export type ReducerContext = {
  /**
   * The id to give an instance the command creates. A command that creates one on each
   * of several layers (takeAllPreviews, previewMacro) derives one id per layer from it;
   * see instanceIdForEachLayer.ts.
   */
  newInstanceId: string;
  /** The current time, as an ISO 8601 timestamp. */
  now: string;
  /** The id to give an item the command creates (createItem). */
  newItemId: string;
  /** The id to give a quick-fire panel the command creates (createQuickFirePanel). */
  newQuickFirePanelId: string;
  /** The id to give a macro the command creates (createMacro). */
  newMacroId: string;
  /** The id to give a data source the command creates (createDataSource). */
  newDataSourceId: string;
};

/**
 * What a reducer decides: the new slices (a slice it did not change is returned as the
 * very same array, so the store can tell what changed), or a refusal with its reason.
 * `isLeftOutOfTheEventLog` is set by two reducers only: recordDataSourcePoll, for a poll
 * that left its source's health as it was, and recordRecordingProgress, the recorder's
 * count of written lines. The store then saves and broadcasts the change but writes no
 * event-log row (decision D11; see createStateStore.ts).
 */
export type ReducerOutcome =
  | { status: 'applied'; slices: SlicesChangedByCommands; isLeftOutOfTheEventLog?: true }
  | { status: 'refused'; error: CommandError };
