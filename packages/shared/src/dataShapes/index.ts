// Everything about the canonical data shapes that @bajaovrlay/shared exports. The
// package's own index.ts re-exports this file with one line; other packages import from
// '@bajaovrlay/shared', never from here.

// The four shape names (session, positions, standings, brackets) and the kinds of session.
export {
  type DataShapeKey,
  DataShapeKeySchema,
  type SessionKind,
  SessionKindSchema,
} from './dataShapeKey.js';
// The session shape: event, session, flag (the race clock's values) and clock reading.
export {
  type SessionClock,
  SessionClockSchema,
  type SessionShape,
  SessionShapeSchema,
  type SessionState,
  SessionStateSchema,
} from './sessionShape.js';
// The positions shape: every car of a session in order, with laps, times, gaps and status.
export {
  type PositionEntry,
  PositionEntrySchema,
  type PositionsShape,
  PositionsShapeSchema,
  type PositionStatus,
  PositionStatusSchema,
} from './positionsShape.js';
// The standings shape: teams by rank and points, overall or for one kind of session.
export {
  type StandingsEntry,
  StandingsEntrySchema,
  type StandingsScope,
  StandingsScopeSchema,
  type StandingsShape,
  StandingsShapeSchema,
} from './standingsShape.js';
// The brackets shape (draft until BAJAOVRLAY-25): rounds of head-to-head matches.
export {
  type BracketCar,
  BracketCarSchema,
  type BracketMatch,
  BracketMatchSchema,
  type BracketRound,
  BracketRoundSchema,
  type BracketsShape,
  BracketsShapeSchema,
} from './bracketsShape.js';
// Validates a payload for one shape; on failure, a pt-BR sentence naming the path.
export {
  type DataShape,
  type DataShapeValidation,
  validateDataShape,
} from './validateDataShape.js';
// The paths a binding may point at in each shape, with their pt-BR labels and value types,
// one path read back, the prefix of the paths that follow a car chosen by number, and the
// path of the whole clock.
export {
  type BindablePath,
  type BindableValueType,
  BindableValueTypeSchema,
  entryOfCarPathPrefix,
  findBindablePath,
  listBindablePathsOfShape,
  wholeClockBindingPath,
} from './bindablePaths.js';
