// The history sentences of the commands about the data the show reads (BAJAOVRLAY-30):
// sources and recordings, corrections, the event inbox, the library and the images. One
// named formatter per command type, gathered in sentenceOfEachCommandType.ts.
import type { EventLogDetails } from '../slices/eventLogEntry.js';
import type { CommandOfType } from './commandOfType.js';
import type { EventLogNames } from './eventLogNames.js';
import {
  nameDataSource,
  nameDetectedEvent,
  nameInboxEvent,
  nameTriggerFiring,
} from './namesInSentences.js';
import { ptBREventLogReading } from './ptBREventLogReading.js';
import type { ImportAsTheLogKeepsIt, PollAsTheLogKeepsIt } from './trimmedPayloads.js';

const sentences = ptBREventLogReading.sourcesAndData;

/** createDataSource ("+ Fonte"). */
export function describeCreateDataSource(command: CommandOfType<'createDataSource'>): string {
  return sentences.createdSource(command.label);
}

/** updateDataSource (the source's "Salvar"). */
export function describeUpdateDataSource(
  command: CommandOfType<'updateDataSource'>,
  names: EventLogNames,
): string {
  return sentences.editedSource(nameDataSource(command.sourceId, names));
}

/** deleteDataSource. */
export function describeDeleteDataSource(
  command: CommandOfType<'deleteDataSource'>,
  names: EventLogNames,
): string {
  return sentences.deletedSource(nameDataSource(command.sourceId, names));
}

/** setDataSourceEnabled: the source's switch, on or off. */
export function describeSetDataSourceEnabled(
  command: CommandOfType<'setDataSourceEnabled'>,
  names: EventLogNames,
): string {
  const sourceName = nameDataSource(command.sourceId, names);
  if (command.isEnabled) {
    return sentences.turnedSourceOn(sourceName);
  }
  return sentences.turnedSourceOff(sourceName);
}

/** pollDataSourceNow ("Ler agora"). */
export function describePollDataSourceNow(
  command: CommandOfType<'pollDataSourceNow'>,
  names: EventLogNames,
): string {
  return sentences.askedForAPollNow(nameDataSource(command.sourceId, names));
}

/** restartSimulatedRace ("Reiniciar corrida" on the simulator). */
export function describeRestartSimulatedRace(
  command: CommandOfType<'restartSimulatedRace'>,
  names: EventLogNames,
): string {
  return sentences.restartedSimulatedRace(nameDataSource(command.sourceId, names));
}

/** startRecording ("Gravar"). */
export function describeStartRecording(
  command: CommandOfType<'startRecording'>,
  names: EventLogNames,
): string {
  return sentences.startedRecording(nameDataSource(command.sourceId, names));
}

/** stopRecording: "Parar gravação", or the recorder stopping on a failure or its cap. */
export function describeStopRecording(
  command: CommandOfType<'stopRecording'>,
  names: EventLogNames,
): string {
  const sourceName = nameDataSource(command.sourceId, names);
  if (command.failureMessage === undefined) {
    return sentences.stoppedRecording(sourceName);
  }
  return sentences.recordingStoppedByItself(sourceName, command.failureMessage);
}

/**
 * A poll as its row keeps it (trimmedPayloads.ts): the source answered, failed with its
 * error, or sent something that could not be read. A poll is logged only when the
 * source's health changes, so these rows are the source going stale and coming back.
 */
export function describePollAsTheLogKeepsIt(
  poll: PollAsTheLogKeepsIt,
  names: EventLogNames,
): string {
  if ('isResultLeftOut' in poll) {
    const sourceName =
      poll.sourceId === null
        ? ptBREventLogReading.names.unnamedSource
        : nameDataSource(poll.sourceId, names);
    return sentences.sourceSentAnUnreadablePoll(sourceName);
  }
  const sourceName = nameDataSource(poll.sourceId, names);
  if (poll.result.ok) {
    return sentences.sourceAnswered(sourceName);
  }
  return sentences.sourceFailed(sourceName, poll.result.error);
}

/** recordDataSourcePoll, whole (never so in the log, but a command all the same). */
export function describeRecordDataSourcePoll(
  command: CommandOfType<'recordDataSourcePoll'>,
  names: EventLogNames,
): string {
  const result = command.result.ok
    ? { ok: true as const }
    : { ok: false as const, error: command.result.error };
  return describePollAsTheLogKeepsIt(
    { type: 'recordDataSourcePoll', sourceId: command.sourceId, result },
    names,
  );
}

/** recordRecordingProgress: how many lines a recording's file holds now. */
export function describeRecordRecordingProgress(
  command: CommandOfType<'recordRecordingProgress'>,
): string {
  return sentences.recordingProgress(command.recordingId, command.snapshotCount);
}

/** The corrected field: a session's, or one car's. */
function nameCorrectedField(key: {
  scope: 'session' | 'car';
  field: string;
  carNumber?: number | undefined;
}): string {
  if (key.scope === 'car' && key.carNumber !== undefined) {
    return sentences.carField(key.field, key.carNumber);
  }
  return sentences.sessionField(key.field);
}

/** A corrected value as the operator typed it: a text in quotes, anything else as JSON. */
function writeCorrectedValue(value: unknown): string {
  if (typeof value === 'string') {
    return ptBREventLogReading.names.quoted(value);
  }
  return JSON.stringify(value);
}

/** setOverride ("Corrigir"), with the value and the reason given. */
export function describeSetOverride(
  command: CommandOfType<'setOverride'>,
  names: EventLogNames,
): string {
  return sentences.setOverride(
    nameCorrectedField(command),
    nameDataSource(command.sourceId, names),
    writeCorrectedValue(command.value),
    command.reason,
  );
}

/** clearOverride: the source's own value counts again. */
export function describeClearOverride(
  command: CommandOfType<'clearOverride'>,
  names: EventLogNames,
): string {
  return sentences.clearedOverride(
    nameCorrectedField(command),
    nameDataSource(command.sourceId, names),
  );
}

/** dismissEvent ("Descartar" in the "Eventos" tab). */
export function describeDismissEvent(
  command: CommandOfType<'dismissEvent'>,
  names: EventLogNames,
): string {
  return sentences.dismissedEvent(nameInboxEvent(command.eventId, names));
}

/** approveEvent ("Aprovar", a Super Chat; BAJAOVRLAY-35). */
export function describeApproveEvent(
  command: CommandOfType<'approveEvent'>,
  names: EventLogNames,
): string {
  return sentences.approvedEvent(nameInboxEvent(command.eventId, names));
}

/**
 * restoreEvent: "Desfazer" or "Restaurar" on a dismissed event, or "Mostrar de novo" on a
 * shown or expired one (BAJAOVRLAY-67), told apart by the status the row's details say it
 * came back from. A row written before those details reads as a restore.
 */
export function describeRestoreEvent(
  command: CommandOfType<'restoreEvent'>,
  names: EventLogNames,
  details?: EventLogDetails,
): string {
  const eventName = nameInboxEvent(command.eventId, names);
  const restoredFrom = details?.restoredFrom;
  if (restoredFrom === 'shown' || restoredFrom === 'expired') {
    return sentences.restoredEventToShowAgain(
      eventName,
      sentences.whatARestoredEventWas[restoredFrom],
    );
  }
  return sentences.restoredEvent(eventName);
}

/** dismissTriggerFiring: "Descartar" on a firing that waits, as on an event. */
export function describeDismissTriggerFiring(
  command: CommandOfType<'dismissTriggerFiring'>,
  names: EventLogNames,
): string {
  return sentences.dismissedFiring(nameTriggerFiring(command.firingId, names));
}

/** restoreTriggerFiring: its "Desfazer", so the firing waits again. */
export function describeRestoreTriggerFiring(
  command: CommandOfType<'restoreTriggerFiring'>,
  names: EventLogNames,
): string {
  return sentences.restoredFiring(nameTriggerFiring(command.firingId, names));
}

/**
 * createManualEvent ("+ Evento"): a penalty or a notice, the car and the reason, or a
 * general notice, about no car (BAJAOVRLAY-67).
 */
export function describeCreateManualEvent(command: CommandOfType<'createManualEvent'>): string {
  const carNumber = command.carNumber;
  if (command.noticeKind === 'notice') {
    return carNumber === undefined
      ? sentences.typedGeneralNotice(command.reason)
      : sentences.typedNotice(carNumber, command.reason);
  }
  // Only a refused row has a penalty with no car (PENALTY_WITHOUT_CAR); it still reads.
  return carNumber === undefined
    ? sentences.typedPenaltyWithoutCar(command.reason)
    : sentences.typedPenalty(carNumber, command.reason);
}

/** updateEventRule ("Regras"). */
export function describeUpdateEventRule(command: CommandOfType<'updateEventRule'>): string {
  return sentences.changedEventRule(ptBREventLogReading.eventKindLabels[command.kind]);
}

/** recordDetectedEvents: what the detectors found, each by its kind and car. */
export function describeRecordDetectedEvents(
  command: CommandOfType<'recordDetectedEvents'>,
): string {
  const eventNames = command.events.map((detectedEvent) => nameDetectedEvent(detectedEvent));
  return sentences.detectedEvents(eventNames);
}

/** upsertEntity ("Salvar" in Cadastros), naming the record by what the operator reads. */
export function describeUpsertEntity(command: CommandOfType<'upsertEntity'>): string {
  switch (command.entityType) {
    case 'team':
      return sentences.savedTeam(command.record.carNumber, command.record.teamName);
    case 'person':
      return sentences.savedPerson(command.record.name);
    case 'sponsor':
      return sentences.savedSponsor(command.record.name);
    case 'scheduleSlot':
      return sentences.savedScheduleSlot(command.record.sessionName);
  }
}

/** deleteEntity: the record by its key, since it is gone. */
export function describeDeleteEntity(command: CommandOfType<'deleteEntity'>): string {
  switch (command.entityType) {
    case 'team':
      return sentences.deletedTeam(command.carNumber);
    case 'person':
      return sentences.deletedPerson(command.personId);
    case 'sponsor':
      return sentences.deletedSponsor(command.sponsorId);
    case 'scheduleSlot':
      return sentences.deletedScheduleSlot(command.slotId);
  }
}

/** An import as its row keeps it (trimmedPayloads.ts): how many of which kind. */
export function describeImportAsTheLogKeepsIt(importRow: ImportAsTheLogKeepsIt): string {
  switch (importRow.entityType) {
    case 'team':
      return sentences.importedTeams(importRow.recordCount);
    case 'person':
      return sentences.importedPeople(importRow.recordCount);
    case 'sponsor':
      return sentences.importedSponsors(importRow.recordCount);
    case 'scheduleSlot':
      return sentences.importedScheduleSlots(importRow.recordCount);
    default:
      // A refused import keeps its entityType as sent, which may name no kind at all.
      return sentences.importedRecords(importRow.recordCount);
  }
}

/** importEntities, whole (never so in the log, but a command all the same). */
export function describeImportEntities(command: CommandOfType<'importEntities'>): string {
  return describeImportAsTheLogKeepsIt({
    type: 'importEntities',
    entityType: command.entityType,
    recordCount: command.records.length,
  });
}

/** recordUploadedMedia: an image the upload route wrote. */
export function describeRecordUploadedMedia(command: CommandOfType<'recordUploadedMedia'>): string {
  return sentences.uploadedImage(command.media.fileName);
}

/** deleteMedia. */
export function describeDeleteMedia(command: CommandOfType<'deleteMedia'>): string {
  return sentences.deletedImage(command.mediaId);
}
