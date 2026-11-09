import type { SourceHostAllowlist } from '../../modules/dataSources/index.js';
import type { IsCommandAllowed } from './authorizeCommand.js';
import type { LoadInitialSlicesOptions } from './loadInitialSlices.js';

/** What a store needs. The last eight have production defaults; tests replace them. */
export type StateStoreOptions = Omit<LoadInitialSlicesOptions, 'readCurrentTime'> & {
  /** The authorisation step; defaults to allowCommandForActorRole (roles included). */
  isCommandAllowed?: IsCommandAllowed | undefined;
  /** The clock for every timestamp, at boot and per command; the server clock by default. */
  readCurrentTime?: (() => Date) | undefined;
  /** Makes the id of each new instance; defaults to a random UUID. */
  createInstanceId?: (() => string) | undefined;
  /** Makes the id of each new item (createItem); defaults to a random UUID. */
  createItemId?: (() => string) | undefined;
  /** Makes the id of each new quick-fire panel; defaults to a random UUID. */
  createQuickFirePanelId?: (() => string) | undefined;
  /** Makes the id of each new macro (createMacro); defaults to a random UUID. */
  createMacroId?: (() => string) | undefined;
  /** Makes the id of each new data source (createDataSource); defaults to a random UUID. */
  createDataSourceId?: (() => string) | undefined;
  /** Makes the id of each event the operator types (createManualEvent); a random UUID. */
  createEventId?: (() => string) | undefined;
  /** Makes the id of each new trigger (createTrigger); defaults to a random UUID. */
  createTriggerId?: (() => string) | undefined;
  /** Makes the id of each firing of a trigger (fireTrigger); defaults to a random UUID. */
  createTriggerFiringId?: (() => string) | undefined;
  /** BAJAOVRLAY_SOURCE_ALLOWED_HOSTS as read at boot, for the reducers; no list by default. */
  sourceHostAllowlist?: SourceHostAllowlist | undefined;
};
