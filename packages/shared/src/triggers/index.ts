// Everything about triggers (BAJAOVRLAY-48) that @bajaovrlay/shared exports. The package's
// own index.ts re-exports this file with one line; other packages import from
// '@bajaovrlay/shared', never from here.

// One trigger: what it waits for (kind and filter), its macro, mode and minimum interval;
// a schedule every N minutes within its limits, and the part of the day it may fire in.
export {
  defaultTriggerMinimumIntervalMs,
  type Trigger,
  type TriggerDataEventKind,
  TriggerDataEventKindSchema,
  type TriggerDayWindow,
  TriggerDayWindowSchema,
  triggerEveryMinutesLimits,
  triggerMinimumIntervalLimitsMs,
  TriggerMinimumIntervalMsSchema,
  type TriggerMode,
  TriggerModeSchema,
  TriggerNameSchema,
  type TriggerScheduleMoment,
  TriggerScheduleMomentSchema,
  TriggerSchema,
  TriggersSchema,
  type TriggerWhen,
  TriggerWhenSchema,
} from './trigger.js';
// The data a firing carries, and the check of an HTTP trigger's body (flat, 8 KB at most).
export {
  largestTriggerHttpBodyBytes,
  readTriggerDataFromHttpBody,
  type TriggerData,
  TriggerDataSchema,
  type TriggerHttpBodyReading,
} from './triggerData.js';
// The triggerActivity slice: the pause, each trigger's last firing, the newest firings.
export {
  type TriggerActivity,
  triggerActivityAtBoot,
  TriggerActivitySchema,
  type TriggerFiring,
  TriggerFiringSchema,
  triggerFiringsKept,
  type TriggerFiringStatus,
  TriggerFiringStatusSchema,
} from './triggerActivity.js';
// A take step's field filled from the trigger ("Dado do gatilho"), and what takeItem gets.
export {
  type TriggerDataFieldValue,
  TriggerDataFieldValueSchema,
  type TriggerFieldsOfTake,
  TriggerFieldsOfTakeSchema,
  type TriggerFillOfTake,
  TriggerFillOfTakeSchema,
} from './triggerDataField.js';
// The eight trigger commands: create, update, delete, pause; fire (server only); run,
// dismiss and restore a firing that asks.
export {
  type CreateTriggerCommand,
  CreateTriggerCommandSchema,
  type DeleteTriggerCommand,
  DeleteTriggerCommandSchema,
  type DismissTriggerFiringCommand,
  DismissTriggerFiringCommandSchema,
  type FireTriggerCommand,
  FireTriggerCommandSchema,
  type RestoreTriggerFiringCommand,
  RestoreTriggerFiringCommandSchema,
  type RunTriggerFiringCommand,
  RunTriggerFiringCommandSchema,
  type SetTriggersPausedCommand,
  SetTriggersPausedCommandSchema,
  type UpdateTriggerCommand,
  UpdateTriggerCommandSchema,
} from './triggerCommands.js';
// The pt-BR texts above: body refusals, data event kinds, session kinds.
export { ptBRTriggers } from './ptBRTriggers.js';
