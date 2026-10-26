// Everything about outputs (and editing layers) that @bajaovrlay/shared exports. The
// package's own index.ts re-exports this file with one line; other packages import from
// '@bajaovrlay/shared', never from here.

// The `outputs` slice: renderer addresses OBS loads, `program` always among them.
export {
  type Output,
  OutputIdSchema,
  type Outputs,
  OutputSchema,
  OutputsSchema,
  programOutputId,
} from './output.js';
