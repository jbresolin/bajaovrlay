// Everything about the canonical data shapes that @bajaovrlay/shared exports. The
// package's own index.ts re-exports this file with one line; other packages import from
// '@bajaovrlay/shared', never from here.

// The six shape names (session, positions, standings, brackets, incidents, superChats) and the kinds
// of session.
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
// The standings shape: teams by rank and points, overall or for one kind of session, with
// the parts of the score as the source names them and disqualified teams at the end.
export {
  type StandingsEntry,
  StandingsEntrySchema,
  type StandingsScope,
  StandingsScopeSchema,
  type StandingsScorePart,
  StandingsScorePartSchema,
  type StandingsShape,
  StandingsShapeSchema,
} from './standingsShape.js';
// The brackets shape (BAJAOVRLAY-25): rounds of head-to-head matches, best of N, W.O. and byes.
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
// The incidents shape (BAJAOVRLAY-44): penalties, warnings and incidents of one session.
export {
  type IncidentEntry,
  IncidentEntrySchema,
  type IncidentKind,
  IncidentKindSchema,
  type IncidentsShape,
  IncidentsShapeSchema,
} from './incidentsShape.js';
// The superChats shape (BAJAOVRLAY-35): a live chat's newest paid messages, read by YouTube.
export {
  type SuperChatEntry,
  SuperChatEntrySchema,
  type SuperChatsShape,
  SuperChatsShapeSchema,
} from './superChatsShape.js';
// Validates a payload for one shape; on failure, a pt-BR sentence naming the path.
export {
  type DataShape,
  type DataShapeValidation,
  validateDataShape,
} from './validateDataShape.js';
// The paths a binding may point at in each shape, with their pt-BR labels and value types,
// one path read back, the prefix of the paths that follow a car chosen by number, and the
// path of the whole clock and the clock role of each session clock path.
export {
  type BindablePath,
  type BindableValueType,
  BindableValueTypeSchema,
  type ClockFieldRole,
  entryOfCarPathPrefix,
  findBindablePath,
  findClockRoleOfSessionPath,
  listBindablePathsOfShape,
  wholeClockBindingPath,
} from './bindablePaths.js';
// The first word of the brackets' paths that read the match "agora" (`matchNow.`) and the
// match "a seguir" (`matchUpNext.`) of the match focus (BAJAOVRLAY-65).
export { bracketMatchSlotPathPrefixes } from './bracketsBindablePaths.js';
