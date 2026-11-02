// Public surface of the OBS module (BAJAOVRLAY-27). Core and other modules import from
// here, never from the files inside.

// Sends each of the three OBS commands to its reducer (core's reduceCommand calls it).
export { type ObsCommand, reduceObsCommand } from './reducers/reduceObsCommand.js';
// Starts the one connection to OBS with the server; stop() when it closes.
export {
  type ObsConnection,
  type ObsConnectionSettings,
  startObsConnection,
} from './obsConnection.js';
