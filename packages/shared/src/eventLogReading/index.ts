// Everything about reading the event log back (BAJAOVRLAY-30, the history page) that
// @bajaovrlay/shared exports. The package's own index.ts re-exports this file with one
// line; other packages import from '@bajaovrlay/shared', never from here.

// Who sent a row: the six kinds of the "Quem" filter, their labels, and the reading.
export {
  type EventLogActorKind,
  eventLogActorKindLabels,
  EventLogActorKindSchema,
  readWhoSentEventLogRow,
} from './eventLogActors.js';
// The five command groups of the filter, their labels, and every command type's group.
export {
  commandGroupOfEachCommandType,
  type EventLogCommandGroup,
  eventLogCommandGroupLabels,
  EventLogCommandGroupSchema,
} from './eventLogCommandGroups.js';
// The slices a sentence reads names from, and how to pick them out of every slice.
export { buildEventLogNamesFromSlices, type EventLogNames } from './eventLogNames.js';
// The registry of sentences, one named formatter per command type, and one command's sentence.
export {
  describeCommand,
  type SentenceOfEachCommandType,
  sentenceOfEachCommandType,
} from './sentenceOfEachCommandType.js';
// One row as the page shows it (when, who, sentence, refused, group, layers).
export {
  type DescribedEventLogEntry,
  describeEventLogEntry,
  listLayersCommandTouches,
} from './describeEventLogEntry.js';
// The filters, the page's and GET /api/v1/event-log's, and whether a row passes them.
export {
  doesEventLogEntryMatchFilters,
  type EventLogFilters,
  EventLogFiltersSchema,
  hasAnyEventLogFilter,
} from './eventLogFilters.js';
// The pt-BR texts of the history page.
export { ptBREventLogReading } from './ptBREventLogReading.js';
// GET /api/v1/event-log: its query, its answer, and the sizes of a page and of the live slice.
export {
  type EventLogPage,
  eventLogPageDefaultLimit,
  eventLogPageLargestLimit,
  type EventLogPageQuery,
  EventLogPageQuerySchema,
  EventLogPageSchema,
  eventLogRowsSentLive,
} from './eventLogPage.js';
