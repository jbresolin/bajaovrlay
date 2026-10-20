// Public surface of the bindings module. Core and other modules import from here, never
// from the files inside.

// Sends each binding command (refreshBoundInstanceData) to its reducer; core's reduceCommand calls it.
export { type BindingCommand, reduceBindingCommand } from './reducers/reduceBindingCommand.js';
// Starts the refresher of bound fields with the server; stop() when it closes.
export { type BindingService, type BindingServiceOptions, startBindingService } from './service.js';
