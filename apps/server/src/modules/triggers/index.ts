// Public surface of the triggers module (BAJAOVRLAY-48). Core and the API routes import
// from here, never from the files inside.

// Sends each trigger command (create, update, delete, pause, fire, run, dismiss, restore)
// to its reducer; core's reduceCommand calls it.
export { reduceTriggerCommand, type TriggerCommand } from './reducers/reduceTriggerCommand.js';
// Handles a call to an HTTP trigger's address, after the route checked the caller's access.
export { fireTriggerFromAnHttpCall, type HttpTriggerCallOutcome } from './httpTriggerCalls.js';
// Starts the service that watches OBS, the inbox and the schedule; stop() when it closes.
export { startTriggerService, type TriggerService, type TriggerServiceOptions } from './service.js';
// Saves and reads back "Pausar gatilhos", the one part of the activity a restart keeps.
export { buildRowOfTheTriggerPause, readTriggerActivityAtBoot } from './triggerPauseRow.js';
