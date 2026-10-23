// Public surface of the entity module. Core and other modules import from here, never
// from the files inside.

// Sends each entity command (upsertEntity, deleteEntity, importEntities) to its reducer;
// core's reduceCommand calls it.
export { type EntityCommand, reduceEntityCommand } from './reducers/reduceEntityCommand.js';
// Loads the teams, people, sponsors and schedule from their rows at boot.
export { type EntitySlicesAtBoot, loadEntitySlices } from './loadEntitySlices.js';
// The REST route GET /api/v1/entities/simulator-teams, and the teams it answers.
export { getSimulatorTeamsRoute } from './api.js';
export { buildSimulatorTeamsAsEntities, simulatorTeamsNotice } from './simulatorTeams.js';
// The payload of an import's event-log row: the type, the count and the keys.
export { type ImportEventLogPayload, trimImportForTheEventLog } from './importEventLogPayload.js';
