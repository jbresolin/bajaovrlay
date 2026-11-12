// Everything about consoles that @bajaovrlay/shared exports (BAJAOVRLAY-69). The package's
// own index.ts re-exports this file with one line; other packages import from
// '@bajaovrlay/shared', never from here.

// The id of one console (one tab of the control page), handed out in its first hello.
export { type ConsoleId, ConsoleIdSchema } from './consoleId.js';
// What a console showed on air on the layer it takes on, one layer or layer by layer.
export {
  type InstanceIdSeenOnAir,
  InstanceIdSeenOnAirSchema,
  type InstanceIdsSeenOnAirByLayer,
  InstanceIdsSeenOnAirByLayerSchema,
} from './whatTheConsoleSawOnAir.js';
