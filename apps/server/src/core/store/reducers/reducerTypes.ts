import type {
  CommandError,
  LayerNotTaken,
  Slices,
  TakeRefusedForAnotherConsole,
} from '@bajaovrlay/shared';

import type { SourceHostAllowlist } from '../../../modules/dataSources/index.js';
import type { LastProgramChangeOfEachLayer } from '../consoles/lastProgramChangeOfEachLayer.js';
import type { StepBroughtBack } from './instanceStepsWithinTheirCount.js';

/**
 * The slices a command may change. The event log is not among them: the store appends
 * to it itself, after a command that changed one of these slices or was refused. A
 * command that is accepted and changes nothing leaves no entry, and neither does a
 * routine data-source poll (see isLeftOutOfTheEventLog below).
 */
export type SlicesChangedByCommands = Pick<
  Slices,
  | 'outputs'
  | 'layers'
  | 'graphics'
  | 'instances'
  | 'previewClearedLayerIds'
  | 'instanceBindings'
  | 'programHistory'
  | 'rundowns'
  | 'items'
  | 'quickFirePanels'
  | 'macros'
  | 'macroRuns'
  | 'macroStops'
  | 'obs'
  | 'triggers'
  | 'triggerActivity'
  | 'dataSources'
  | 'dataSnapshots'
  | 'overrides'
  | 'bracketMatchFocuses'
  | 'recordings'
  | 'events'
  | 'eventRules'
  | 'teams'
  | 'people'
  | 'sponsors'
  | 'scheduleSlots'
  | 'media'
>;

/**
 * Everything a reducer needs that is not pure: made by the store before calling it, so
 * a reducer never reads the clock, the environment or generates ids itself.
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
  /**
   * Who sent the command (`operador:<connection id>`, `sistema:…`), for a reducer that
   * signs what it stores with it (setOverride's setBy).
   */
  actor: string;
  /** The id to give an item the command creates (createItem). */
  newItemId: string;
  /** The id to give a quick-fire panel the command creates (createQuickFirePanel). */
  newQuickFirePanelId: string;
  /** The id to give a macro the command creates (createMacro). */
  newMacroId: string;
  /** The id to give a data source the command creates (createDataSource). */
  newDataSourceId: string;
  /** The id to give an event the operator types (createManualEvent). */
  newEventId: string;
  /** The id to give a trigger the command creates (createTrigger, BAJAOVRLAY-48). */
  newTriggerId: string;
  /** The id to give the firing a fireTrigger records. */
  newTriggerFiringId: string;
  /**
   * BAJAOVRLAY_SOURCE_ALLOWED_HOSTS as read at boot: createDataSource and updateDataSource
   * refuse a flex request to a host off it.
   */
  sourceHostAllowlist: SourceHostAllowlist;
  /**
   * The console (control page tab) that sent the command (BAJAOVRLAY-69); left out for
   * anything that is not a console: the command API, a macro's runner, the server itself.
   */
  consoleId?: string;
  /**
   * Each layer's last program change, as the store remembers it (../consoles/): what a take
   * reads to tell whether another console just changed its layer. Left out (most tests),
   * no change is known and no take is refused for one.
   */
  lastProgramChangeOfEachLayer?: LastProgramChangeOfEachLayer;
  /**
   * How many steps the server clock has made at this command (core/time): a layer's change
   * signed with another count is on another clock and counts as old. Left out, none (0).
   */
  serverClockStepCount?: number;
};

/**
 * What a reducer decides: the new slices (a slice it did not change is returned as the
 * very same array, so the store can tell what changed), or a refusal with its reason.
 * `isLeftOutOfTheEventLog` is set by five reducers only: recordDataSourcePoll, for a poll
 * that left its source's health as it was, recordRecordingProgress, the recorder's
 * count of written lines, refreshBoundInstanceData, a source's new values on air, and the
 * OBS connection's recordObsState and recordObsSceneSwitchAnswer (when OBS did it). The store then saves and broadcasts the change but writes no
 * event-log row (decision D11; see createStateStore.ts).
 */
export type ReducerOutcome =
  | {
      status: 'applied';
      slices: SlicesChangedByCommands;
      isLeftOutOfTheEventLog?: true;
      /**
       * Set by recordBackup only (BAJAOVRLAY-33): it changes no slice, and the store
       * writes its event-log row all the same, since the row is the record of the copy.
       */
      isLoggedWithoutAChange?: true;
      /**
       * Set by refreshBoundInstanceData, when a spell of refused refreshes of an instance
       * begins (gate 2 of PR #18), and by recordObsSceneSwitchAnswer, when OBS did not do
       * a switch (BAJAOVRLAY-27): the change is applied, and its event-log row is written
       * as failed with this reason.
       */
      refusalWrittenToTheEventLog?: CommandError;
      /**
       * Set by reduceCommand when the change left an instance past its step count and it
       * was put on its last step (instanceStepsWithinTheirCount.ts, BAJAOVRLAY-25); the
       * store writes a log line for each, so a step that moved by itself leaves a trace.
       */
      stepsBroughtBack?: StepBroughtBack[];
      /**
       * Set by deleteLayer only (BAJAOVRLAY-49): the graphics whose default layer was the
       * one deleted, now defaulting to the fullscreen layer. The store logs a warning, as
       * the boot does for a manifest naming a layer that does not exist.
       */
      graphicsPlacedOnTheFallbackLayer?: string[];
      /**
       * Set by takeAllPreviews only (BAJAOVRLAY-69): the layers it left as they were because
       * another console had just changed them, unseen. The store answers them to the page
       * and writes `takesRefusedForAnotherConsole` in the event-log row.
       */
      layersNotTaken?: LayerNotTaken[];
      takesRefusedForAnotherConsole?: TakeRefusedForAnotherConsole[];
    }
  | {
      status: 'refused';
      error: CommandError;
      /**
       * Set on a take refused because another console had just changed its layer
       * (BAJAOVRLAY-69): what the store writes in the failed row's details, with both roles.
       */
      takesRefusedForAnotherConsole?: TakeRefusedForAnotherConsole[];
    };
